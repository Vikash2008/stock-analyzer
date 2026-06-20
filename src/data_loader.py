import pandas as pd
from pathlib import Path
from typing import Union

# `portfolio` is practically mandatory for this app — without it every transaction is
# treated as one combined portfolio, which defeats the multi-broker design — so it's
# required here even though the FIFO engine itself can technically run without it.
REQUIRED_COLUMNS = {"date", "symbol", "exchange", "type", "quantity", "price", "portfolio"}
VALID_TYPES = {"BUY", "SELL", "DIVIDEND"}

EXCHANGE_SUFFIXES = {
    "NSE": ".NS",
    "BSE": ".BO",
    "NYSE": "",
    "NASDAQ": "",
    "US": "",
}


def load_transactions(source: Union[str, Path, object]) -> pd.DataFrame:
    """Load and validate transactions from a CSV or Excel file / file-like object.

    Single schema only — date, symbol, exchange, type, quantity, price, portfolio
    required; charges/currency/yf_symbol/tags/name/buy_fx_rate optional/derived. A raw
    broker export needs reshaping into this schema first — see
    `scripts/convert_broker_export.py`.
    """
    name = getattr(source, "name", str(source)).lower()
    if name.endswith((".xlsx", ".xls")):
        df = pd.read_excel(source)
    else:
        df = pd.read_csv(source)

    df.columns = df.columns.str.strip().str.lower().str.replace(" ", "_", regex=False)

    missing = REQUIRED_COLUMNS - set(df.columns)
    if missing:
        raise ValueError(f"Missing required columns: {', '.join(sorted(missing))}")

    df["date"] = pd.to_datetime(df["date"], dayfirst=True, errors="raise")
    df["quantity"] = pd.to_numeric(df["quantity"], errors="coerce")
    df["price"] = pd.to_numeric(df["price"], errors="coerce")
    df["charges"] = pd.to_numeric(
        df.get("charges", pd.Series(0, index=df.index)), errors="coerce"
    ).fillna(0)
    df["type"] = df["type"].str.strip().str.upper()
    df["symbol"] = df["symbol"].str.strip().str.upper()
    df["exchange"] = df["exchange"].str.strip().str.upper()

    bad_types = set(df["type"].unique()) - VALID_TYPES
    if bad_types:
        raise ValueError(f"Unrecognised transaction types: {bad_types}. Use BUY, SELL, DIVIDEND.")

    if "yf_symbol" not in df.columns:
        df["yf_symbol"] = df.apply(
            lambda r: r["symbol"] + EXCHANGE_SUFFIXES.get(r["exchange"], ""), axis=1
        )

    if "currency" not in df.columns:
        df["currency"] = df["exchange"].apply(
            lambda x: "INR" if x in ("NSE", "BSE") else "USD"
        )

    # Bucket/Label assignments ("Asset Class=Stocks;Type=Indian Stocks"), if present
    if "tags" in df.columns:
        df["tags"] = df["tags"].fillna("").astype(str).str.strip()
    else:
        df["tags"] = ""

    return df.sort_values("date").reset_index(drop=True)
