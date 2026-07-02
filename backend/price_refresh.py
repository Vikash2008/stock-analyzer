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
from pathlib import Path

from src.cache import Cache

_REFRESH_SECONDS = 120.0


def _known_symbols() -> list[str]:
    symbols = Cache().get("known_symbols")
    if symbols:
        return list(symbols)
    # Cold boot — nothing cached yet. Seed from the bundled demo file so the
    # very first request also lands on a warm cache instead of a cold fetch.
    from src.data_loader import load_transactions
    txns = load_transactions(Path("data/demo_msp_v2.csv"))
    return sorted(txns["yf_symbol"].dropna().unique().tolist())


def _refresh_once() -> None:
    from src.price_fetcher import get_prices_and_prev_close, get_usd_inr_rate

    symbols = _known_symbols()
    if not symbols:
        return
    cache = Cache()
    prices, prev_closes = get_prices_and_prev_close(symbols)
    usd_inr = get_usd_inr_rate()
    cache.set("prices", prices)
    cache.set("prev_closes", prev_closes)
    cache.set("fx", usd_inr)


async def price_refresh_loop() -> None:
    while True:
        try:
            await asyncio.to_thread(_refresh_once)
        except Exception as e:
            print(f"[price_refresh] background refresh failed: {e}")
        await asyncio.sleep(_REFRESH_SECONDS)
