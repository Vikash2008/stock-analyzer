"""
Frozen transaction schema and validation checks.

Schema version: 1
Last frozen: 2026-05-17
"""

import pandas as pd
from dataclasses import dataclass, field
from typing import List

# ── Frozen schema definition ──────────────────────────────────────────────────

SCHEMA_VERSION = 1

REQUIRED_COLUMNS = {
    "date", "symbol", "exchange", "type",
    "quantity", "price", "charges",
    "yf_symbol", "currency",
}

OPTIONAL_COLUMNS = {"portfolio", "name"}

VALID_EXCHANGES  = {"NSE", "BSE", "US"}
VALID_TYPES      = {"BUY", "SELL", "DIVIDEND"}
VALID_CURRENCIES = {"INR", "USD"}

EXCHANGE_SUFFIX_MAP = {
    "NSE": ".NS",
    "BSE": ".BO",
    "US":  "",
}

EXCHANGE_CURRENCY_MAP = {
    "NSE": "INR",
    "BSE": "INR",
    "US":  "USD",
}


# ── Validation result ─────────────────────────────────────────────────────────

@dataclass
class ValidationResult:
    errors:   List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return len(self.errors) == 0

    def __str__(self) -> str:
        lines = []
        if self.ok:
            lines.append("PASS — no schema errors")
        else:
            lines.append(f"FAIL — {len(self.errors)} error(s)")
        for e in self.errors:
            lines.append(f"  [ERROR]   {e}")
        for w in self.warnings:
            lines.append(f"  [WARNING] {w}")
        return "\n".join(lines)


# ── Individual checks ─────────────────────────────────────────────────────────

def _check_columns(df: pd.DataFrame, result: ValidationResult) -> None:
    missing = REQUIRED_COLUMNS - set(df.columns)
    if missing:
        result.errors.append(f"Missing required columns: {sorted(missing)}")

    unknown = set(df.columns) - REQUIRED_COLUMNS - OPTIONAL_COLUMNS
    if unknown:
        result.warnings.append(f"Unexpected columns (ignored): {sorted(unknown)}")


def _check_nulls(df: pd.DataFrame, result: ValidationResult) -> None:
    for col in REQUIRED_COLUMNS:
        if col not in df.columns:
            continue
        n = df[col].isna().sum()
        if n:
            result.errors.append(f"Column '{col}' has {n} null value(s)")


def _check_categoricals(df: pd.DataFrame, result: ValidationResult) -> None:
    if "exchange" in df.columns:
        bad = set(df["exchange"].dropna().unique()) - VALID_EXCHANGES
        if bad:
            result.errors.append(f"Invalid exchange values: {bad}. Allowed: {VALID_EXCHANGES}")

    if "type" in df.columns:
        bad = set(df["type"].dropna().unique()) - VALID_TYPES
        if bad:
            result.errors.append(f"Invalid type values: {bad}. Allowed: {VALID_TYPES}")

    if "currency" in df.columns:
        bad = set(df["currency"].dropna().unique()) - VALID_CURRENCIES
        if bad:
            result.errors.append(f"Invalid currency values: {bad}. Allowed: {VALID_CURRENCIES}")


def _check_numerics(df: pd.DataFrame, result: ValidationResult) -> None:
    if "quantity" in df.columns:
        bad = df["quantity"] <= 0
        if bad.any():
            cols = ["date", "symbol", "portfolio", "quantity"] if "portfolio" in df.columns \
                   else ["date", "symbol", "quantity"]
            result.errors.append(
                f"{bad.sum()} row(s) have quantity <= 0:\n"
                + df[bad][cols].to_string(index=False)
            )

    if "price" in df.columns:
        bad = df["price"] < 0
        if bad.any():
            result.errors.append(f"{bad.sum()} row(s) have price < 0")

    if "charges" in df.columns:
        bad = df["charges"] < 0
        if bad.any():
            result.errors.append(f"{bad.sum()} row(s) have charges < 0")


def _check_dates(df: pd.DataFrame, result: ValidationResult) -> None:
    if "date" not in df.columns:
        return
    today = pd.Timestamp.today().normalize()
    future = df["date"] > today
    if future.any():
        result.errors.append(
            f"{future.sum()} row(s) have future dates:\n"
            + df[future][["date", "symbol"]].to_string(index=False)
        )
    very_old = df["date"] < pd.Timestamp("2000-01-01")
    if very_old.any():
        result.warnings.append(f"{very_old.sum()} row(s) have dates before 2000 — verify intentional")


def _check_yf_symbol_format(df: pd.DataFrame, result: ValidationResult) -> None:
    if "yf_symbol" not in df.columns or "exchange" not in df.columns:
        return
    for exc, suffix in EXCHANGE_SUFFIX_MAP.items():
        mask = df["exchange"] == exc
        if not mask.any():
            continue
        if suffix:
            bad = mask & ~df["yf_symbol"].str.endswith(suffix)
        else:
            bad = mask & (
                df["yf_symbol"].str.endswith(".NS") |
                df["yf_symbol"].str.endswith(".BO")
            )
        if bad.any():
            result.errors.append(
                f"{bad.sum()} {exc} row(s) have incorrect yf_symbol suffix "
                f"(expected '{suffix}' or none for US)"
            )


def _check_currency_exchange_alignment(df: pd.DataFrame, result: ValidationResult) -> None:
    if "currency" not in df.columns or "exchange" not in df.columns:
        return
    for exc, expected_ccy in EXCHANGE_CURRENCY_MAP.items():
        mask = df["exchange"] == exc
        bad = mask & (df["currency"] != expected_ccy)
        if bad.any():
            result.errors.append(
                f"{bad.sum()} row(s) have exchange={exc} but currency != {expected_ccy}"
            )


def _check_sell_overflow(df: pd.DataFrame, result: ValidationResult) -> None:
    """Warn if any symbol+portfolio has more SELL quantity than BUY quantity."""
    if "type" not in df.columns:
        return
    group_cols = ["yf_symbol", "portfolio"] if "portfolio" in df.columns else ["yf_symbol"]
    buys  = df[df["type"] == "BUY"].groupby(group_cols)["quantity"].sum()
    sells = df[df["type"] == "SELL"].groupby(group_cols)["quantity"].sum()
    combined = pd.DataFrame({"bought": buys, "sold": sells}).fillna(0)
    overflows = combined[combined["sold"] > combined["bought"] + 1e-6]
    if not overflows.empty:
        result.warnings.append(
            f"{len(overflows)} symbol(s) have SELL qty > BUY qty (check for missing BUYs):\n"
            + overflows.to_string()
        )


def _check_duplicates(df: pd.DataFrame, result: ValidationResult) -> None:
    key_cols = ["date", "yf_symbol", "type", "quantity", "price"]
    if "portfolio" in df.columns:
        key_cols.append("portfolio")
    key_cols = [c for c in key_cols if c in df.columns]
    dupes = df.duplicated(subset=key_cols, keep=False)
    if dupes.any():
        result.warnings.append(
            f"{dupes.sum()} row(s) are exact duplicates on {key_cols} — "
            "expected if Equity is a master portfolio, otherwise investigate"
        )


# ── Public entry point ────────────────────────────────────────────────────────

def validate_transactions(df: pd.DataFrame) -> ValidationResult:
    """Run all schema checks and return a ValidationResult."""
    result = ValidationResult()
    _check_columns(df, result)
    if result.errors:
        return result   # no point continuing if columns are missing
    _check_nulls(df, result)
    _check_categoricals(df, result)
    _check_numerics(df, result)
    _check_dates(df, result)
    _check_yf_symbol_format(df, result)
    _check_currency_exchange_alignment(df, result)
    _check_sell_overflow(df, result)
    _check_duplicates(df, result)
    return result
