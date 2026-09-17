"""
Background price refresh loop.

Keeps the shared prices/prev_closes/fx cache layers (src/cache.py) warm on a
fixed 2-min cadence, independent of any incoming request. Without this,
engine.build() only refreshes prices lazily — whichever request happens to
land after the TTL expires pays the live yfinance round-trip. With this,
that fetch already happened in the background, so build() just reads the
warm cache and a request returns in ~1-2s instead of waiting on yfinance.
"""

from __future__ import annotations

import asyncio
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from src.cache import Cache, get_all_known_symbols

_REFRESH_SECONDS = 120.0

# Dedicated single-worker pool for this loop's own asyncio.to_thread-equivalent hop off the
# event loop. Previously used the bare `asyncio.to_thread(...)` default, which shares Python's
# one small implicit pool (sized ~cpu_count+4) with chart fetches (history.py) and every Deep
# Research generation (gemini.py) — this loop only ever has one call in flight at a time (it
# awaits between iterations), so reserving it a pool of its own guarantees this always-on
# background job never has to wait behind an unrelated feature's burst of activity, and vice
# versa. The actual price-fetch work inside _refresh_once() already runs on price_fetcher.py's
# own separate 12-worker pool — this one just governs getting _refresh_once() off the loop.
_executor = ThreadPoolExecutor(max_workers=1)


def _known_symbols() -> list[str]:
    symbols = get_all_known_symbols()
    if symbols:
        return symbols
    # Cold boot — nothing cached yet. Seed from the bundled demo file so the
    # very first request also lands on a warm cache instead of a cold fetch.
    from src.data_loader import load_transactions
    txns = load_transactions(Path("data/demo_msp_v2.csv"))
    return sorted(txns["yf_symbol"].dropna().unique().tolist())


def _refresh_once() -> None:
    from src.price_fetcher import get_prices_and_prev_close, get_usd_inr_rate, symbols_needing_price_fetch

    symbols = _known_symbols()
    if not symbols:
        return
    cache = Cache()
    # Skip symbols whose market is closed and already has a price captured since the most
    # recent close (weekends, evenings, or the other market's symbols while this one's shut)
    # — the price can't have moved, so there's nothing to gain from re-fetching it every tick.
    to_fetch = symbols_needing_price_fetch(
        symbols, current_prices=cache.get_stale("prices"), prev_closes=cache.get_stale("prev_closes")
    )
    prices, prev_closes = get_prices_and_prev_close(to_fetch)
    usd_inr = get_usd_inr_rate()

    # A partial/failed fetch (hard timeout, batch error) returns None for whichever
    # symbols didn't come back in time — merge over the last-known-good cache instead
    # of replacing it outright, so one bad cycle doesn't wipe prices for symbols the
    # fresh fetch simply missed (that wipe was the cause of portfolio value randomly
    # cratering until the next successful refresh or a manual sync).
    merged_prices      = {**(cache.get_stale("prices") or {}),      **{s: p for s, p in prices.items() if p is not None}}
    merged_prev_closes = {**(cache.get_stale("prev_closes") or {}), **{s: p for s, p in prev_closes.items() if p is not None}}

    cache.set("prices", merged_prices)
    cache.set("prev_closes", merged_prev_closes)
    cache.set("fx", usd_inr)

    from backend import alerts_engine
    alerts_engine.evaluate(merged_prices)


async def price_refresh_loop() -> None:
    loop = asyncio.get_running_loop()
    while True:
        try:
            await loop.run_in_executor(_executor, _refresh_once)
        except Exception as e:
            print(f"[price_refresh] background refresh failed: {e}")
        await asyncio.sleep(_REFRESH_SECONDS)
