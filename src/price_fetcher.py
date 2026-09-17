import json
import threading
import time
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import pandas as pd
import requests
import yfinance as yf


class _TimeoutSession(requests.Session):
    """A requests.Session that enforces a default timeout on every call. yfinance's internal
    calls don't always pass their own `timeout=` kwarg through every code path (its cookie/crumb
    fetch is a known case — see _HARD_TIMEOUT below), which otherwise leaves those requests free
    to hang indefinitely on a stuck connection. Overriding `request()` here catches every outbound
    call made through this session regardless of which yfinance internal function issued it."""
    def request(self, *args, **kwargs):
        kwargs.setdefault("timeout", _QUOTE_TIMEOUT)
        return super().request(*args, **kwargs)


_http_session = _TimeoutSession()

_NAMES_FILE = Path("data/names.json")
_static_names: Dict[str, dict] = {}
if _NAMES_FILE.exists():
    try:
        _static_names = json.loads(_NAMES_FILE.read_text(encoding="utf-8"))
    except Exception:
        pass

_names_lock = threading.Lock()


def _persist_static_names() -> None:
    """Write the in-memory name cache back to disk so a resolved symbol's name/quote_type
    survives a process restart — previously only held in-memory, so every redeploy/restart
    silently forgot every name ever resolved and re-paid the slow per-symbol lookup below."""
    try:
        with _names_lock:
            _NAMES_FILE.write_text(json.dumps(_static_names, ensure_ascii=False), encoding="utf-8")
    except Exception:
        pass


def _harvest_names_from_quotes(resolved: Dict[str, Tuple[str, str]]) -> None:
    """Fold name/quoteType harvested from a price-quote response (see _fetch_quote_batch) into
    the shared name cache. Never overwrites an existing entry that already has a real
    sector/industry from the slower per-symbol .info path — only fills symbols with nothing
    cached yet, or a stale entry still missing name/quote_type."""
    changed = False
    for sym, (name, quote_type) in resolved.items():
        existing = _static_names.get(sym)
        if existing and existing.get("name") and existing.get("quote_type"):
            continue
        _static_names[sym] = {
            "sector":     (existing or {}).get("sector", "Unknown"),
            "industry":   (existing or {}).get("industry", "Unknown"),
            "name":       name,
            "quote_type": quote_type,
        }
        changed = True
    if changed:
        _persist_static_names()


_QUOTE_CHUNK = 50
_QUOTE_URL = "https://query1.finance.yahoo.com/v7/finance/quote"
_QUOTE_TIMEOUT = 8  # seconds — passed to yfinance's own per-request timeout where it's honored,
                     # and now also the default floor _TimeoutSession forces on every call above
_HARD_TIMEOUT = 10  # seconds — outer wall-clock cap; belt-and-suspenders alongside
                     # _TimeoutSession above, in case some code path constructs its own session
                     # or otherwise bypasses the one we pass in.
_executor = ThreadPoolExecutor(max_workers=12)  # raised from 8 — these are lightweight quote-JSON
                                                 # calls, not the heavier OHLCV downloads
                                                 # history.py's own concurrency cap is tuned for
                                                 # (see that file's comment on the 1GB VM's memory
                                                 # budget) — extra headroom so an abandoned/hung
                                                 # call occupying a worker doesn't queue fresh
                                                 # requests behind it as easily; the real fix for
                                                 # hangs themselves is _TimeoutSession above


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
    """Fetch last price + previous close via Yahoo's lightweight quote endpoint. This is the same
    endpoint _fetch_quote_names hits separately for name/quoteType — Yahoo actually returns those
    fields in this same response, so they're harvested here too (into _static_names, see
    _harvest_names_from_quotes) instead of paying for a second near-identical round-trip later.
    Runs on every 30-min price refresh across every held symbol, so this alone resolves most
    holdings' names for free — get_tickers_info() then only needs its own fetch for whatever this
    didn't cover (mainly closed/no-longer-held positions, which don't go through a price fetch)."""
    t = yf.Ticker(symbols[0], session=_http_session)
    d = t._data
    # Establish cookie/crumb directly with a short timeout — avoids fast_info's extra
    # (unused) network round trip and its unbounded default timeout.
    d._get_cookie_and_crumb(timeout=_QUOTE_TIMEOUT)

    prices: Dict[str, Optional[float]] = {s: None for s in symbols}
    prev_closes: Dict[str, Optional[float]] = {s: None for s in symbols}
    resolved_names: Dict[str, Tuple[str, str]] = {}
    for i in range(0, len(symbols), _QUOTE_CHUNK):
        chunk = symbols[i:i + _QUOTE_CHUNK]
        resp = d.get(_QUOTE_URL, params={"symbols": ",".join(chunk)}, timeout=_QUOTE_TIMEOUT)
        results = resp.json().get("quoteResponse", {}).get("result", [])
        for r in results:
            sym = r.get("symbol")
            if sym in prices:
                prices[sym] = r.get("regularMarketPrice")
                prev_closes[sym] = r.get("regularMarketPreviousClose")
            name = r.get("longName") or r.get("shortName")
            quote_type = r.get("quoteType")
            if sym and name and quote_type:
                resolved_names[sym] = name, quote_type
    if resolved_names:
        _harvest_names_from_quotes(resolved_names)
    return prices, prev_closes


_recent_fallback_failures: Dict[str, float] = {}  # yf_symbol -> unix time of last no-price result
_FALLBACK_COOLDOWN = 20 * 60  # seconds — a symbol that failed the slow fallback below is skipped
                               # from it for this long. Confirmed live: 9 consistently-unrecognized
                               # symbols in one portfolio pushed a single price refresh to 88s,
                               # because yfinance retries each failing symbol internally with no
                               # bound of its own — this stops us from re-paying that cost for the
                               # same known-bad symbols every ~30-min refresh cycle. Still retried
                               # via the cheap primary path (_fetch_quote_batch) every time, so a
                               # symbol recovers as soon as Yahoo's data does, without waiting out
                               # the full cooldown.


def _fetch_download_fallback(
    symbols: List[str],
) -> Tuple[Dict[str, Optional[float]], Dict[str, Optional[float]]]:
    """Old 5-day OHLCV download fallback, run inside _with_hard_timeout by the caller. yfinance
    retries each failing/delisted symbol internally before giving up — with no bound of its own,
    a handful of consistently-delisted symbols in one portfolio (confirmed live: 88s for one
    32-symbol request, 9 of them delisted) can stall the whole request for well over a minute."""
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


_last_fetched_at: Dict[str, float] = {}  # yf_symbol -> unix time of last confirmed live price


def _mark_fetched(prices: Dict[str, Optional[float]]) -> None:
    now = time.time()
    for s, p in prices.items():
        if p is not None:
            _last_fetched_at[s] = now


def symbols_needing_price_fetch(symbols: List[str], now_utc=None, current_prices: Optional[dict] = None) -> List[str]:
    """Drop symbols whose market is currently closed and already have a price captured
    since the most recent close — the price can't have moved since then, so refetching
    it every 2-min background tick (or on-demand refresh) on evenings/weekends, or for
    the other market's symbols while this one is closed, is pure wasted yfinance load.
    A symbol whose market is open, or that's never been fetched since its last close,
    still goes through so the closing price actually gets captured once.

    `_last_fetched_at` only proves a fetch *succeeded at some point* — it's in-memory
    and never invalidated if the actual price cache backing responses later loses that
    value (eviction, wipe, bug). Without also checking `current_prices`, a symbol whose
    cached price silently went missing would be skipped indefinitely (showing null)
    until the next market open, since nothing would ever re-trigger a fetch for it.
    Confirmed live 2026-09-17: 81/82 symbols wrongly skipped post-market-close this way."""
    from backend.market_hours import is_market_open, last_close_before
    now_utc = now_utc or pd.Timestamp.now("UTC")
    current_prices = current_prices or {}
    out = []
    for s in symbols:
        if is_market_open(s, now_utc):
            out.append(s)
            continue
        if current_prices.get(s) is None:
            out.append(s)
            continue
        last = _last_fetched_at.get(s)
        if last is None or last < last_close_before(now_utc, s).timestamp():
            out.append(s)
    return out


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
        prices, prev_closes = _with_hard_timeout(_fetch_quote_batch, symbols)
        _mark_fetched(prices)
        return prices, prev_closes
    except Exception:
        pass

    now = time.time()
    to_fetch  = [s for s in symbols if now - _recent_fallback_failures.get(s, 0) >= _FALLBACK_COOLDOWN]
    cooling   = [s for s in symbols if s not in to_fetch]

    try:
        prices, prev_closes = (
            _with_hard_timeout(_fetch_download_fallback, to_fetch, timeout=20) if to_fetch else ({}, {})
        )
    except Exception:
        prices, prev_closes = {s: None for s in to_fetch}, {s: None for s in to_fetch}

    for s in to_fetch:
        if prices.get(s) is None:
            _recent_fallback_failures[s] = now
        else:
            _recent_fallback_failures.pop(s, None)
    for s in cooling:
        prices.setdefault(s, None)
        prev_closes.setdefault(s, None)
    _mark_fetched(prices)
    return prices, prev_closes


def get_current_prices(symbols: List[str]) -> Dict[str, Optional[float]]:
    """Batch-fetch the latest close price for each yfinance symbol."""
    prices, _ = get_prices_and_prev_close(symbols)
    return prices


def _fetch_quote_names(symbols: List[str]) -> Dict[str, dict]:
    """Batch-fetch display name + quoteType via the same lightweight quote endpoint
    _fetch_quote_batch uses for prices. Far more reliable than per-symbol .info for
    Indian mutual fund tickers (0P-prefixed) — .info/fast_info routinely comes back
    empty for these, while this endpoint returns a proper longName. No sector/industry
    here though (not part of this endpoint's schema) — get_tickers_info still falls
    back to .info for that."""
    t = yf.Ticker(symbols[0], session=_http_session)
    d = t._data
    d._get_cookie_and_crumb(timeout=_QUOTE_TIMEOUT)

    out: Dict[str, dict] = {}
    for i in range(0, len(symbols), _QUOTE_CHUNK):
        chunk = symbols[i:i + _QUOTE_CHUNK]
        resp = d.get(_QUOTE_URL, params={"symbols": ",".join(chunk)}, timeout=_QUOTE_TIMEOUT)
        results = resp.json().get("quoteResponse", {}).get("result", [])
        for r in results:
            sym = r.get("symbol")
            if sym in symbols:
                out[sym] = {
                    "name":       r.get("longName") or r.get("shortName") or None,
                    "quote_type": r.get("quoteType") or None,
                }
    return out


def _infer_quote_type_from_symbol(sym: str) -> str:
    """Fallback when yfinance's quoteType is unavailable (throttled/failed request).
    Yahoo's own ticker convention assigns mutual fund instruments a 0P-prefixed fund
    identifier regardless of which broker/account holds it — an instrument fact, not a
    naming choice the user made for their accounts."""
    base = sym.split(".")[0]
    return "MUTUALFUND" if base.startswith("0P") else "EQUITY"


def _fetch_one_ticker_info(sym: str) -> Tuple[Optional[str], dict]:
    """One symbol's fast_info name + full .info dict, run inside _with_hard_timeout by the caller."""
    t = yf.Ticker(sym, session=_http_session)
    fi = t.fast_info
    name = getattr(fi, "display_name", None) or getattr(fi, "short_name", None)
    info = t.info
    return name, info


def get_tickers_info(symbols: List[str]) -> Dict[str, dict]:
    """
    Fetch sector / company-name metadata for all symbols.
    Uses fast_info for speed; falls back to full .info on failure.
    """
    result: Dict[str, dict] = {}
    missing = []
    for sym in symbols:
        cached = _static_names.get(sym)
        # Retry if quote_type or name is still missing. A symbol whose name never
        # resolved (most commonly Indian mutual funds — 0P-prefixed codes .info/
        # fast_info routinely fails on) used to get cached as name=None permanently,
        # since data/names.json has no expiry — every holding card for that symbol
        # then silently fell back to showing the raw symbol forever, even though a
        # later attempt (or the quote-endpoint fallback below) would have resolved it.
        if cached and cached.get("quote_type") and cached.get("name"):
            result[sym] = cached
        else:
            missing.append(sym)

    if not missing:
        return result

    # Batched + far more reliable than per-symbol .info for names (esp. mutual funds) —
    # try this first so the slower per-symbol loop below only needs to fill in sector/
    # industry (not part of this endpoint's schema) and can skip re-deriving name/quote_type
    # when this already succeeded. _HARD_TIMEOUT (10s) is tuned for a single price-fetch
    # chunk elsewhere in this module — a large portfolio's full symbol universe (open +
    # closed positions across every broker) routinely spans several hundred symbols, i.e.
    # multiple sequential _QUOTE_CHUNK batches inside _fetch_quote_names, so it needs a
    # timeout that scales with chunk count instead of that single-chunk default (which was
    # silently swallowing the whole batch on timeout and dumping everything onto the much
    # slower, much less reliable per-symbol .info loop below).
    chunks = (len(missing) + _QUOTE_CHUNK - 1) // _QUOTE_CHUNK
    try:
        quote_names = _with_hard_timeout(_fetch_quote_names, missing, timeout=max(_HARD_TIMEOUT, chunks * 10))
    except Exception:
        quote_names = {}

    for sym in missing:
        quoted = quote_names.get(sym) or {}
        name, info = None, {}
        for attempt in range(2):
            try:
                # _http_session bounds the underlying HTTP calls; _with_hard_timeout is a second
                # layer on top in case some internal yfinance path still opens its own connection
                # outside that session — this loop previously had neither, so a single throttled/
                # stuck symbol could block the whole request indefinitely.
                name, info = _with_hard_timeout(_fetch_one_ticker_info, sym, timeout=_QUOTE_TIMEOUT + 2)
                break
            except Exception:
                if attempt == 0:
                    time.sleep(0.5)  # brief backoff — Yahoo throttles long sequential .info runs
        result[sym] = {
            "sector":     info.get("sector")   or "Unknown",
            "industry":   info.get("industry") or "Unknown",
            "name":       info.get("longName") or info.get("shortName") or name or quoted.get("name") or None,
            "quote_type": info.get("quoteType") or quoted.get("quote_type") or _infer_quote_type_from_symbol(sym),
        }
        # Cache in-process so a repeated request for the same never-seen-before symbol (e.g.
        # several users' portfolios sharing a symbol not yet in the static file) doesn't
        # re-pay the yf.Ticker() cost every time within this process's lifetime. Only a
        # symbol that still has no name after both attempts stays a "missing" candidate on
        # the next call (see the freshness check above) instead of being frozen as-is.
        _static_names[sym] = result[sym]
    _persist_static_names()
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
    def _download_one(tk: str) -> pd.Series:
        raw = yf.download(tk, period="5d", auto_adjust=True, progress=False)
        close = raw["Close"] if "Close" in raw else raw
        if hasattr(close, "squeeze"):
            close = close.squeeze()
        return close.dropna()

    for ticker in ("INR=X", "USDINR=X"):
        try:
            series = _with_hard_timeout(_download_one, ticker, timeout=15)
            if not series.empty:
                rate = float(series.iloc[-1])
                if 70 < rate < 120:
                    return rate
        except Exception:
            pass
    return 95.5
