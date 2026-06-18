"""
Exchange-aware staleness check for chart history caching.

Two trading windows, each on its own clock:
  - Indian (NSE/BSE):   Asia/Kolkata   09:15-15:30
  - US (NYSE/NASDAQ):   America/New_York 09:30-16:00

No holiday calendar, no early-close days — a holiday is treated as a normal
trading day, which just costs one harmless no-op fetch (yfinance returns no
new row), never incorrect data.
"""

from __future__ import annotations

from datetime import time as dtime

import pandas as pd

_WEEKEND = {5, 6}  # Saturday, Sunday

_INDIAN_TZ, _INDIAN_OPEN, _INDIAN_CLOSE = "Asia/Kolkata", dtime(9, 15), dtime(15, 30)
_US_TZ, _US_OPEN, _US_CLOSE = "America/New_York", dtime(9, 30), dtime(16, 0)

_LIVE_REFRESH_SECONDS = 1800.0  # 30 min — matches frontend auto-refresh cadence


def is_indian_symbol(yf_symbol: str) -> bool:
    sym = yf_symbol.upper()
    return sym.endswith(".NS") or sym.endswith(".BO")


def _exchange_params(yf_symbol: str) -> tuple[str, dtime, dtime]:
    if is_indian_symbol(yf_symbol):
        return _INDIAN_TZ, _INDIAN_OPEN, _INDIAN_CLOSE
    return _US_TZ, _US_OPEN, _US_CLOSE


def is_market_open(yf_symbol: str, now_utc: pd.Timestamp | None = None) -> bool:
    now_utc = now_utc or pd.Timestamp.now("UTC")
    tz, open_t, close_t = _exchange_params(yf_symbol)
    local_now = now_utc.tz_convert(tz)
    if local_now.weekday() in _WEEKEND:
        return False
    open_dt  = local_now.normalize() + pd.Timedelta(hours=open_t.hour,  minutes=open_t.minute)
    close_dt = local_now.normalize() + pd.Timedelta(hours=close_t.hour, minutes=close_t.minute)
    return open_dt <= local_now <= close_dt


def last_close_before(now_utc: pd.Timestamp, yf_symbol: str) -> pd.Timestamp:
    """Most recent exchange close at-or-before `now_utc`, returned in UTC."""
    tz, _, close_t = _exchange_params(yf_symbol)
    local_now = now_utc.tz_convert(tz)
    candidate = local_now.normalize() + pd.Timedelta(hours=close_t.hour, minutes=close_t.minute)
    if local_now < candidate:
        candidate -= pd.Timedelta(days=1)
    while candidate.weekday() in _WEEKEND:
        candidate -= pd.Timedelta(days=1)
    return candidate.tz_convert("UTC")


def is_stale(
    yf_symbol: str,
    last_fetch_ts: float,
    last_bar_date: str | None,
    now_utc: pd.Timestamp | None = None,
) -> bool:
    """
    True if a fresh fetch is needed.

    Market open  -> stale once 30 min have passed since the last fetch (mirrors
                     the frontend's own 30-min auto-refresh tick).
    Market closed -> stale only if we haven't captured a bar since the most
                     recent close — once captured, stays fresh until the next close,
                     no matter how often the frontend asks in between.
    """
    now_utc = now_utc or pd.Timestamp.now("UTC")
    if not last_bar_date:
        return True
    if is_market_open(yf_symbol, now_utc):
        return (now_utc.timestamp() - last_fetch_ts) >= _LIVE_REFRESH_SECONDS
    close = last_close_before(now_utc, yf_symbol)
    bar_date = pd.Timestamp(last_bar_date, tz="UTC")
    return close.normalize() > bar_date.normalize()
