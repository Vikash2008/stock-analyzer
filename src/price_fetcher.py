import json
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError
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


_QUOTE_CHUNK = 50
_QUOTE_URL = "https://query1.finance.yahoo.com/v7/finance/quote"
_QUOTE_TIMEOUT = 8  # seconds — passed to yfinance's own per-request timeout where it's honored
_HARD_TIMEOUT = 10  # seconds — outer wall-clock cap; yfinance's cookie-fetch step ignores the
                     # timeout param entirely in some code paths (always 30s), so this thread-pool
                     # wrapper is the only way to actually bound worst-case latency.
_executor = ThreadPoolExecutor(max_workers=8)  # extra headroom — abandoned/hung calls occupy a
                                                # worker until their underlying network call gives
                                                # up on its own; too few workers would queue fresh
                                                # requests behind those stragglers


def _with_hard_timeout(fn, *args, timeout=_HARD_TIMEOUT):
    """Run fn in a worker thread and give up waiting after `timeout`s.
    The abandoned thread may keep running in the background (Python has no clean
    way to kill a thread), but the caller is freed to fall back immediately."""
    future = _executor.submit(fn, *args)
    try:
        return future.result(timeout=timeout)
    except FutureTimeoutError:
        raise TimeoutError(f"{fn.__name__} exceeded {timeout}s")


def _fetch_quote_batch(symbols: List[str]) -> Tuple[Dict[str, Optional[float]], Dict[str, Optional[float]]]:
    """Fetch last price + previous close via Yahoo's lightweight quote endpoint."""
    t = yf.Ticker(symbols[0])
    d = t._data
    # Establish cookie/crumb directly with a short timeout — avoids fast_info's extra
    # (unused) network round trip and its unbounded default timeout.
    d._get_cookie_and_crumb(timeout=_QUOTE_TIMEOUT)

    prices: Dict[str, Optional[float]] = {s: None for s in symbols}
    prev_closes: Dict[str, Optional[float]] = {s: None for s in symbols}
    for i in range(0, len(symbols), _QUOTE_CHUNK):
        chunk = symbols[i:i + _QUOTE_CHUNK]
        resp = d.get(_QUOTE_URL, params={"symbols": ",".join(chunk)}, timeout=_QUOTE_TIMEOUT)
        results = resp.json().get("quoteResponse", {}).get("result", [])
        for r in results:
            sym = r.get("symbol")
            if sym in prices:
                prices[sym] = r.get("regularMarketPrice")
                prev_closes[sym] = r.get("regularMarketPreviousClose")
    return prices, prev_closes


def get_prices_and_prev_close(
    symbols: List[str],
) -> Tuple[Dict[str, Optional[float]], Dict[str, Optional[float]]]:
    """
    Batch-fetch current price and previous-session close.
    Returns (prices, prev_closes) — both keyed by yf_symbol.
    Tries Yahoo's lightweight quote endpoint first (single small JSON response per
    chunk); falls back to the old 5-day OHLCV download if that endpoint errors or
    gets locked down further.
    """
    if not symbols:
        return {}, {}
    try:
        return _with_hard_timeout(_fetch_quote_batch, symbols)
    except Exception:
        pass

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
    # Lightweight quote endpoint first — hard-bounded via _with_hard_timeout, avoids
    # fast_info's unbounded default (was causing long stalls on flaky networks).
    try:
        prices, _ = _with_hard_timeout(_fetch_quote_batch, ["INR=X"])
        rate = prices.get("INR=X")
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
    return 95.5
