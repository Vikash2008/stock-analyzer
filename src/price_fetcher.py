import json
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import pandas as pd
import yfinance as yf

_NAMES_FILE = Path("data/names.json")
_static_names: Dict[str, dict] = {}
if _NAMES_FILE.exists():
    try:
        _static_names = json.loads(_NAMES_FILE.read_text(encoding="utf-8"))
    except Exception:
        pass


def get_prices_and_prev_close(
    symbols: List[str],
) -> Tuple[Dict[str, Optional[float]], Dict[str, Optional[float]]]:
    """
    Batch-fetch current price and previous-session close in one download.
    Returns (prices, prev_closes) — both keyed by yf_symbol.
    prev_close is None when fewer than 2 trading days exist in the window.
    """
    if not symbols:
        return {}, {}
    try:
        raw = yf.download(
            symbols,
            period="5d",
            auto_adjust=True,
            progress=False,
            threads=True,
        )
        close = raw["Close"] if "Close" in raw else raw

        if isinstance(close, pd.Series):
            close = close.to_frame(name=symbols[0])
        elif isinstance(close.columns, pd.MultiIndex):
            close = close.droplevel(0, axis=1)

        prices: Dict[str, Optional[float]] = {}
        prev_closes: Dict[str, Optional[float]] = {}
        for sym in symbols:
            try:
                series = close[sym].dropna() if sym in close.columns else pd.Series()
                prices[sym]      = float(series.iloc[-1]) if len(series) >= 1 else None
                prev_closes[sym] = float(series.iloc[-2]) if len(series) >= 2 else None
            except Exception:
                prices[sym] = None
                prev_closes[sym] = None
        return prices, prev_closes
    except Exception:
        return {s: None for s in symbols}, {s: None for s in symbols}


def get_current_prices(symbols: List[str]) -> Dict[str, Optional[float]]:
    """Batch-fetch the latest close price for each yfinance symbol."""
    prices, _ = get_prices_and_prev_close(symbols)
    return prices


def get_tickers_info(symbols: List[str]) -> Dict[str, dict]:
    """
    Fetch sector / company-name metadata for all symbols.
    Uses fast_info for speed; falls back to full .info on failure.
    """
    result: Dict[str, dict] = {}
    missing = []
    for sym in symbols:
        if sym in _static_names:
            result[sym] = _static_names[sym]
        else:
            missing.append(sym)

    for sym in missing:
        try:
            t = yf.Ticker(sym)
            fi = t.fast_info
            name = (
                getattr(fi, "display_name", None)
                or getattr(fi, "short_name", None)
            )
            info = t.info
            result[sym] = {
                "sector":   info.get("sector")   or "Unknown",
                "industry": info.get("industry") or "Unknown",
                "name":     info.get("longName") or info.get("shortName") or name or None,
            }
        except Exception:
            result[sym] = {"sector": "Unknown", "industry": "Unknown", "name": None}
    return result


def get_usd_inr_rate() -> float:
    """Return live USD/INR rate, trying multiple methods, falling back to 85.5."""
    for ticker in ("INR=X", "USDINR=X"):
        try:
            info = yf.Ticker(ticker).fast_info
            rate = getattr(info, "last_price", None) or getattr(info, "regular_market_price", None)
            if rate and 70 < rate < 120:
                return float(rate)
        except Exception:
            pass
    for ticker in ("INR=X", "USDINR=X"):
        try:
            raw = yf.download(ticker, period="5d", auto_adjust=True, progress=False)
            close = raw["Close"] if "Close" in raw else raw
            if hasattr(close, "squeeze"):
                close = close.squeeze()
            series = close.dropna()
            if not series.empty:
                rate = float(series.iloc[-1])
                if 70 < rate < 120:
                    return rate
        except Exception:
            pass
    return 85.5
