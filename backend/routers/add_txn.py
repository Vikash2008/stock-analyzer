"""
POST /api/portfolio/add-txn?csv_hash={hash}

Appends one or more transaction rows (one per portfolio in body.portfolios) to
the existing transaction log, rebuilds the FIFO via engine.build(), and returns
the updated portfolio bundle + the new normalized standard-format CSV + its hash.
"""

from __future__ import annotations

import hashlib
import io
from pathlib import Path

import pandas as pd
from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from src.cache import Cache
from src.data_loader import EXCHANGE_SUFFIXES, load_transactions
from src.engine import build
from backend.serializers import serialize_bundle

router = APIRouter()

_DATA_FILE   = Path("data/demo_msp_v2.csv")
# currency/buy_fx_rate/name/yf_symbol/charges are all regenerable on the next load (derived
# from exchange, re-fetched from yfinance, or simply not load-bearing) — dropped so the
# exported backup CSV matches the same minimal schema the app now requires on import.
_EXPORT_COLS = [
    "date", "symbol", "exchange", "type", "quantity", "price", "portfolio", "tags",
]


def parse_tags(s) -> dict[str, str]:
    """'Asset Class=Stocks;Type=Indian Stocks' -> {'Asset Class': 'Stocks', 'Type': 'Indian Stocks'}"""
    if s is None:
        return {}
    try:
        if pd.isna(s):
            return {}
    except (TypeError, ValueError):
        pass
    s = str(s).strip()
    if not s:
        return {}
    return dict(p.split("=", 1) for p in s.split(";") if "=" in p)


def encode_tags(d: dict[str, str]) -> str:
    return ";".join(f"{k}={v}" for k, v in d.items() if v)


class AddTxnRequest(BaseModel):
    date:       str          # YYYY-MM-DD
    symbol:     str          # clean symbol, e.g. "RELIANCE" or "AMZN"
    exchange:   str          # NSE / BSE / NYSE / NASDAQ / US
    type:       str          # BUY / SELL
    quantity:   float
    price:      float
    portfolios: list[str]    # one row is inserted per portfolio; must have ≥1 entry
    currency:   str  = "INR"
    charges:    float = 0.0
    name:       str  = ""
    tags:       dict[str, str] | None = None   # Bucket -> Label assignments for the new row(s)


@router.post("/api/portfolio/add-txn")
async def add_transaction(
    body: AddTxnRequest,
    csv_hash: str = Query("demo"),
):
    cache  = Cache()
    cached = cache.get_fifo(csv_hash)

    if cached is not None:
        existing_txns: pd.DataFrame = cached[0].copy()
    elif csv_hash == "demo":
        existing_txns = load_transactions(_DATA_FILE)
    else:
        return JSONResponse(
            status_code=404,
            content={"error": "Portfolio not in cache. Please re-import your CSV first."},
        )

    # Derive yf_symbol and currency from exchange
    exchange_up = body.exchange.strip().upper()
    suffix      = EXCHANGE_SUFFIXES.get(exchange_up, "")
    yf_sym      = f"{body.symbol.strip().upper()}{suffix}"
    currency    = body.currency.strip().upper() if body.currency else (
        "INR" if exchange_up in ("NSE", "BSE") else "USD"
    )

    # Build one row per portfolio
    new_rows = [
        {
            "date":        pd.Timestamp(body.date),
            "symbol":      body.symbol.strip().upper(),
            "exchange":    exchange_up,
            "type":        body.type.strip().upper(),
            "quantity":    float(body.quantity),
            "price":       float(body.price),
            "charges":     float(body.charges),
            "portfolio":   port,
            "currency":    currency,
            "buy_fx_rate": 1.0,   # engine._fill_usd_fx_rates backfills real rate for USD BUYs
            "name":        body.name or "",
            "yf_symbol":   yf_sym,
            "tags":        encode_tags(body.tags) if body.tags else "",
        }
        for port in body.portfolios
    ]

    new_df = pd.DataFrame(new_rows)

    # Align columns so concat doesn't error
    for col in new_df.columns:
        if col not in existing_txns.columns:
            existing_txns[col] = None
    for col in existing_txns.columns:
        if col not in new_df.columns:
            new_df[col] = None

    combined = (
        pd.concat([existing_txns, new_df], ignore_index=True)
        .sort_values("date")
        .reset_index(drop=True)
    )

    # Export to normalized standard-format CSV
    export_cols = [c for c in _EXPORT_COLS if c in combined.columns]
    buf = io.StringIO()
    combined[export_cols].to_csv(buf, index=False, date_format="%Y-%m-%d")
    new_csv = buf.getvalue()

    # engine.build() handles FIFO recompute, FX rate backfill, price caching
    new_hash = hashlib.md5(new_csv.encode()).hexdigest()
    bundle   = build(csv_content=new_csv)
    data     = serialize_bundle(bundle)
    data["csv_hash"] = new_hash

    return JSONResponse(content={"portfolio": data, "csv": new_csv, "csv_hash": new_hash})


class TagAssignment(BaseModel):
    portfolio: str
    symbol:    str | None = None   # omitted = bulk push (whole portfolio); present = override one holding
    bucket:    str
    label:     str


class SetTagsRequest(BaseModel):
    assignments: list[TagAssignment]


@router.post("/api/portfolio/set-tags")
async def set_tags(
    body: SetTagsRequest,
    csv_hash: str = Query("demo"),
):
    """Merge Bucket->Label assignments into the `tags` column for matching rows — never
    overwrites the whole tags string, so a row's other Buckets survive."""
    cache  = Cache()
    cached = cache.get_fifo(csv_hash)

    if cached is not None:
        existing_txns: pd.DataFrame = cached[0].copy()
    elif csv_hash == "demo":
        existing_txns = load_transactions(_DATA_FILE)
    else:
        return JSONResponse(
            status_code=404,
            content={"error": "Portfolio not in cache. Please re-import your CSV first."},
        )

    if "tags" not in existing_txns.columns:
        existing_txns["tags"] = ""

    for a in body.assignments:
        mask = existing_txns["portfolio"] == a.portfolio
        if a.symbol is not None:
            mask &= existing_txns["symbol"] == a.symbol.strip().upper()
        for i in existing_txns[mask].index:
            tags = parse_tags(existing_txns.at[i, "tags"])
            tags[a.bucket] = a.label
            existing_txns.at[i, "tags"] = encode_tags(tags)

    export_cols = [c for c in _EXPORT_COLS if c in existing_txns.columns]
    buf = io.StringIO()
    existing_txns[export_cols].to_csv(buf, index=False, date_format="%Y-%m-%d")
    new_csv = buf.getvalue()

    new_hash = hashlib.md5(new_csv.encode()).hexdigest()
    bundle   = build(csv_content=new_csv)
    data     = serialize_bundle(bundle)
    data["csv_hash"] = new_hash

    return JSONResponse(content={"portfolio": data, "csv": new_csv, "csv_hash": new_hash})


class MergeTagsRequest(BaseModel):
    old_csv: str   # previously imported CSV (source of existing Bucket/Label tags); "" if none
    new_csv: str   # freshly uploaded CSV (e.g. a re-exported broker tradebook) — usually untagged


@router.post("/api/portfolio/import-merge-tags")
async def import_merge_tags(body: MergeTagsRequest):
    """Re-importing a fresh broker export normally has no `tags` column, which would wipe
    every Bucket/Label assignment for symbols that are otherwise unchanged. Carry tags forward
    from the previous CSV by portfolio+symbol — a tag is conceptually scoped to a holding, not
    a specific transaction row, so this survives the new export having different individual
    rows (different dates, re-ordering, rounding) as long as the holding itself persists."""
    try:
        new_df = load_transactions(io.StringIO(body.new_csv))
    except Exception as e:
        return JSONResponse(status_code=400, content={"error": str(e)})

    if body.old_csv.strip():
        try:
            old_df = load_transactions(io.StringIO(body.old_csv))
        except Exception:
            old_df = None
        if old_df is not None and "tags" in old_df.columns:
            key_cols = ["portfolio", "symbol"] if "portfolio" in old_df.columns else ["symbol"]
            tag_map: dict[tuple, str] = {}
            for _, row in old_df.iterrows():
                tags = row.get("tags", "")
                if not tags:
                    continue
                tag_map.setdefault(tuple(row[c] for c in key_cols), tags)

            if tag_map and all(c in new_df.columns for c in key_cols):
                def _fill_tag(row):
                    if row.get("tags"):
                        return row["tags"]
                    return tag_map.get(tuple(row[c] for c in key_cols), "")
                new_df["tags"] = new_df.apply(_fill_tag, axis=1)

    export_cols = [c for c in _EXPORT_COLS if c in new_df.columns]
    buf = io.StringIO()
    new_df[export_cols].to_csv(buf, index=False, date_format="%Y-%m-%d")
    return JSONResponse(content={"csv": buf.getvalue()})


class HoldingDeletion(BaseModel):
    portfolio: str
    symbol:    str | None = None   # omitted = delete every symbol in this portfolio
    # When the four fields below are also given, the mask narrows to one specific transaction
    # row instead of the whole symbol's history — there's no stable row ID in the CSV schema,
    # so an exact match on these fields is the only way to pin down a single row.
    date:      str   | None = None   # YYYY-MM-DD
    type:      str   | None = None   # BUY / SELL / DIVIDEND
    quantity:  float | None = None
    price:     float | None = None


class DeleteHoldingsRequest(BaseModel):
    deletions: list[HoldingDeletion]


@router.post("/api/portfolio/delete-holding")
async def delete_holding(
    body: DeleteHoldingsRequest,
    csv_hash: str = Query("demo"),
):
    """Permanently drop transaction rows matching each deletion. With only portfolio(+symbol)
    given, drops that whole symbol's (or portfolio's) full history. With date/type/quantity/
    price also given, narrows to one specific transaction row."""
    cache  = Cache()
    cached = cache.get_fifo(csv_hash)

    if cached is not None:
        existing_txns: pd.DataFrame = cached[0].copy()
    elif csv_hash == "demo":
        existing_txns = load_transactions(_DATA_FILE)
    else:
        return JSONResponse(
            status_code=404,
            content={"error": "Portfolio not in cache. Please re-import your CSV first."},
        )

    mask = pd.Series(False, index=existing_txns.index)
    for d in body.deletions:
        m = existing_txns["portfolio"] == d.portfolio
        if d.symbol is not None:
            m &= existing_txns["symbol"] == d.symbol.strip().upper()
        if d.date is not None:
            m &= existing_txns["date"].dt.normalize() == pd.Timestamp(d.date)
        if d.type is not None:
            m &= existing_txns["type"] == d.type.strip().upper()
        if d.quantity is not None:
            m &= (existing_txns["quantity"] - d.quantity).abs() < 1e-6
        if d.price is not None:
            m &= (existing_txns["price"] - d.price).abs() < 1e-6
        mask |= m
    remaining = existing_txns[~mask]

    export_cols = [c for c in _EXPORT_COLS if c in remaining.columns]
    buf = io.StringIO()
    remaining[export_cols].to_csv(buf, index=False, date_format="%Y-%m-%d")
    new_csv = buf.getvalue()

    new_hash = hashlib.md5(new_csv.encode()).hexdigest()
    bundle   = build(csv_content=new_csv)
    data     = serialize_bundle(bundle)
    data["csv_hash"] = new_hash

    return JSONResponse(content={"portfolio": data, "csv": new_csv, "csv_hash": new_hash})
