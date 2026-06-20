import pandas as pd
from pathlib import Path
from typing import Union

REQUIRED_COLUMNS = {"date", "symbol", "exchange", "type", "quantity", "price"}
VALID_TYPES = {"BUY", "SELL", "DIVIDEND"}

EXCHANGE_SUFFIXES = {
    "NSE": ".NS",
    "BSE": ".BO",
    "NYSE": "",
    "NASDAQ": "",
    "US": "",
}

# Columns that identify the MSP export format
_MSP_SIGNATURE = {"symbol", "shares owned", "cost per share", "transaction date", "type"}


def _is_msp_format(columns: set) -> bool:
    return _MSP_SIGNATURE.issubset(columns)


def _exchange_from_symbol(symbol: str, currency: str) -> str:
    if isinstance(symbol, str):
        if symbol.endswith(".NS"):
            return "NSE"
        if symbol.endswith(".BO"):
            return "BSE"
    if currency == "USD":
        return "US"
    return "NSE"


def _transform_msp(df: pd.DataFrame) -> pd.DataFrame:
    """Convert MSP-format export into the app's standard transaction schema."""
    out = pd.DataFrame()

    out["date"] = pd.to_datetime(df["transaction date"], dayfirst=False, errors="raise")
    out["quantity"] = pd.to_numeric(df["shares owned"], errors="coerce")
    out["price"] = pd.to_numeric(df["cost per share"], errors="coerce")
    out["charges"] = pd.to_numeric(df.get("commission", pd.Series(0, index=df.index)), errors="coerce").fillna(0)
    out["type"] = df["type"].str.strip().str.upper()
    raw_symbol = df["symbol"].str.strip()
    out["currency"] = df["currency"].fillna("INR").str.strip()

    # Some MSP exports (e.g. IndMoney US) put a company name in Symbol and the
    # actual ticker in Display Symbol.  Prefer Display Symbol when it is present,
    # non-empty, and looks like a ticker (no spaces).
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
    out["symbol"] = (
        out["yf_symbol"]
        .str.replace(r"\.(NS|BO)$", "", regex=True)
        .str.upper()
    )

    # Preserve portfolio tag if present
    if "portfolio" in df.columns:
        out["portfolio"] = df["portfolio"].fillna("").str.strip()

    # Bucket/Label assignments ("Asset Class=Stocks;Type=Indian Stocks"), if present
    out["tags"] = df["tags"].fillna("").str.strip() if "tags" in df.columns else ""

    # Preserve name for display
    if "name" in df.columns:
        out["name"] = df["name"].fillna("").str.strip()

    # INR/USD rate at time of each BUY — present in MSP exports as "Purchase Exchange Rate"
    out["buy_fx_rate"] = pd.to_numeric(
        df.get("purchase_exchange_rate", pd.Series(1.0, index=df.index)),
        errors="coerce",
    ).fillna(1.0)

    return out


def load_transactions(source: Union[str, Path, object]) -> pd.DataFrame:
    """Load and validate transactions from a CSV or Excel file / file-like object."""
    name = getattr(source, "name", str(source)).lower()
    if name.endswith((".xlsx", ".xls")):
        df = pd.read_excel(source)
    else:
        df = pd.read_csv(source)

    df.columns = df.columns.str.strip().str.lower().str.replace(" ", "_", regex=False)

    # Normalise to space-separated for MSP detection (column names may have spaces)
    cols_space = {c.replace("_", " ") for c in df.columns}

    if _is_msp_format(cols_space):
        df.columns = df.columns.str.replace("_", " ", regex=False)
        df = _transform_msp(df)
        # MSP transform produces a fully clean DataFrame — skip re-normalisation
        return df.sort_values("date").reset_index(drop=True)

    # ── Standard format processing ────────────────────────────────────────────
    missing = REQUIRED_COLUMNS - set(df.columns)
    if missing:
        raise ValueError(f"Missing required columns: {', '.join(sorted(missing))}")

    df["date"] = pd.to_datetime(df["date"], dayfirst=True, errors="raise")
    df["quantity"] = pd.to_numeric(df["quantity"], errors="coerce")
    df["price"] = pd.to_numeric(df["price"], errors="coerce")
    df["charges"] = pd.to_numeric(df.get("charges", 0), errors="coerce").fillna(0)
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
