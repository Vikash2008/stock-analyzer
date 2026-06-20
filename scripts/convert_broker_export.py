"""
Reshape a raw broker export (MSP-style: Id, Symbol, Name, Display Symbol, Exchange,
Portfolio, Currency, Shares Owned, Cost Per Share, Commission, Transaction Date,
Transaction Time, Purchase Exchange Rate, Type, Accounting, Accounting Execution Ids,
Notes) into the app's standard import/export schema (date, symbol, exchange, type,
quantity, price, portfolio, tags + optional currency/yf_symbol/buy_fx_rate/name/charges).

The app's own `src/data_loader.py` no longer auto-detects/transforms this raw shape —
run this script once per fresh broker export before importing it into the app.

Usage:
    python scripts/convert_broker_export.py <input.csv> <output.csv>
"""

from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

# Same trimmed schema the app's own export produces (backend/routers/add_txn.py's
# _EXPORT_COLS) — currency/yf_symbol/buy_fx_rate/name/charges are all regenerable on
# load, so there's no reason for this script's output to carry them either.
_EXPORT_COLS = ["date", "symbol", "exchange", "type", "quantity", "price", "portfolio", "tags"]


def _exchange_from_symbol(symbol: str, currency: str) -> str:
    if isinstance(symbol, str):
        if symbol.endswith(".NS"):
            return "NSE"
        if symbol.endswith(".BO"):
            return "BSE"
    if currency == "USD":
        return "US"
    return "NSE"


def convert(df: pd.DataFrame) -> pd.DataFrame:
    """Convert a raw MSP-format broker export into the app's standard schema."""
    df.columns = df.columns.str.strip().str.lower().str.replace("_", " ", regex=False)

    out = pd.DataFrame()

    out["date"] = pd.to_datetime(df["transaction date"], dayfirst=False, errors="raise")
    out["quantity"] = pd.to_numeric(df["shares owned"], errors="coerce")
    out["price"] = pd.to_numeric(df["cost per share"], errors="coerce")
    out["charges"] = pd.to_numeric(df.get("commission", pd.Series(0, index=df.index)), errors="coerce").fillna(0)
    out["type"] = df["type"].str.strip().str.upper()
    raw_symbol = df["symbol"].str.strip()
    out["currency"] = df["currency"].fillna("INR").str.strip()

    # Some MSP exports (e.g. IndMoney US) put a company name in Symbol and the
    # actual ticker in Display Symbol. Prefer Display Symbol when present, non-empty,
    # and looks like a ticker (no spaces).
    display_col = df.get("display symbol", pd.Series("", index=df.index))
    display_raw = display_col.fillna("").str.strip()
    effective_symbol = [
        s if (s.endswith(".NS") or s.endswith(".BO")) else
        (d if (d and " " not in d) else s)
        for d, s in zip(display_raw, raw_symbol)
    ]

    out["exchange"] = [
        _exchange_from_symbol(sym, cur)
        for sym, cur in zip(effective_symbol, out["currency"])
    ]

    # US symbols must be uppercase for yfinance; Indian symbols keep their suffix as-is
    out["yf_symbol"] = [
        s.upper() if not (s.endswith(".NS") or s.endswith(".BO")) else s
        for s in effective_symbol
    ]

    # Strip suffix to get a clean display symbol
    out["symbol"] = out["yf_symbol"].str.replace(r"\.(NS|BO)$", "", regex=True).str.upper()

    if "portfolio" in df.columns:
        out["portfolio"] = df["portfolio"].fillna("").str.strip()

    # Bucket/Label assignments ("Asset Class=Stocks;Type=Indian Stocks"), if present
    out["tags"] = df["tags"].fillna("").str.strip() if "tags" in df.columns else ""

    if "name" in df.columns:
        out["name"] = df["name"].fillna("").str.strip()

    # INR/USD rate at time of each BUY — present in MSP exports as "Purchase Exchange Rate"
    out["buy_fx_rate"] = pd.to_numeric(
        df.get("purchase exchange rate", pd.Series(1.0, index=df.index)),
        errors="coerce",
    ).fillna(1.0)

    out = out.sort_values("date").reset_index(drop=True)
    export_cols = [c for c in _EXPORT_COLS if c in out.columns]
    return out[export_cols]


def main() -> None:
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)

    in_path, out_path = Path(sys.argv[1]), Path(sys.argv[2])
    df = pd.read_csv(in_path)
    converted = convert(df)
    converted.to_csv(out_path, index=False, date_format="%Y-%m-%d")
    print(f"Wrote {len(converted)} rows to {out_path}")


if __name__ == "__main__":
    main()
