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
_EXPORT_COLS = [
    "date", "symbol", "exchange", "type", "quantity", "price",
    "charges", "portfolio", "currency", "buy_fx_rate", "name", "yf_symbol",
]


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
