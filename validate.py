"""
Portfolio validation CLI — terminal-first, load once, query fast.

Commands:
    python validate.py validate              # schema checks only
    python validate.py summary               # portfolio-level totals
    python validate.py holdings              # all open positions
    python validate.py portfolio <name>      # single portfolio detail
    python validate.py prices                # show cached prices

Flags (all commands):
    -r / --refresh      force re-fetch live prices
    -x / --usd-inr N    override USD/INR rate
    -e / --export       write output to data/
"""

import argparse
import sys
from pathlib import Path

import pandas as pd

# ── Config ────────────────────────────────────────────────────────────────────

CACHE_FILE = Path("data/.cache.pkl")
CACHE_TTL  = 300
DATA_FILE  = Path("data/msp_v2.csv")
USD_PORTS  = {"Vested", "IndMoney US", "IndMoney Mummy"}


# ── Cache ─────────────────────────────────────────────────────────────────────

def _load_cache():
    from src.cache import Cache
    return Cache()


def _save_cache(cache) -> None:
    cache.save()


def load_data(force_refresh: bool = False) -> tuple:
    """Return (txns, holdings, realized, usd_inr) using the shared Cache."""
    from src.data_loader import load_transactions
    from src.portfolio import calculate_holdings, enrich_holdings
    from src.price_fetcher import get_current_prices, get_tickers_info, get_usd_inr_rate
    from src.schema import validate_transactions
    from src.cache import Cache

    cache = Cache()

    # ── FIFO layer ────────────────────────────────────────────────────────────
    if not cache.fifo_is_fresh(DATA_FILE):
        print(f"[load] {DATA_FILE}")
        txns = load_transactions(DATA_FILE)
        vr = validate_transactions(txns)
        if not vr.ok:
            print(vr)
            sys.exit(1)
        for w in vr.warnings:
            print(f"[warn] {w}")
        holdings_raw, realized = calculate_holdings(txns)
        cache.set_fifo(DATA_FILE, txns, holdings_raw, realized)
        force_refresh = True
        print(f"[load] {len(txns)} transactions -> {len(holdings_raw)} positions")
    else:
        txns, holdings_raw, realized = cache.get_fifo()
        print(f"[cache:fifo] {len(txns)} transactions, {len(holdings_raw)} positions")

    # ── Prices + FX layer ─────────────────────────────────────────────────────
    if force_refresh or not cache.is_fresh("prices"):
        symbols = list(holdings_raw["yf_symbol"].unique())
        print(f"[fetch] prices for {len(symbols)} symbols...")
        prices  = get_current_prices(symbols)
        usd_inr = get_usd_inr_rate()
        cache.set("prices", prices)
        cache.set("fx", usd_inr)
        print(f"[fetch] done — USD/INR={usd_inr:.4f}")
    else:
        prices  = cache.get("prices")
        usd_inr = cache.get("fx") or 85.5
        print(f"[cache:prices] age {int(cache.age('prices') or 0)}s — USD/INR={usd_inr:.4f}")

    # ── Info layer ────────────────────────────────────────────────────────────
    if not cache.is_fresh("info"):
        symbols = list(holdings_raw["yf_symbol"].unique())
        print(f"[fetch] ticker info for {len(symbols)} symbols...")
        info = get_tickers_info(symbols)
        cache.set("info", info)
    else:
        info = cache.get("info")
        print(f"[cache:info] age {int(cache.age('info') or 0)}s")

    holdings = enrich_holdings(holdings_raw, prices, info)
    if "name" in txns.columns and "name" not in holdings.columns:
        name_map = txns.groupby("yf_symbol")["name"].first()
        holdings["name"] = holdings["yf_symbol"].map(name_map).fillna("")

    return txns, holdings, realized, usd_inr


# ── Formatting ────────────────────────────────────────────────────────────────

def _fmt_inr(x):
    if x is None or (isinstance(x, float) and pd.isna(x)): return "N/A"
    if abs(x) >= 1e7: return f"Rs {x/1e7:.2f} Cr"
    if abs(x) >= 1e5: return f"Rs {x/1e5:.2f} L"
    return f"Rs {x:,.0f}"

def _fmt_usd(x):
    if x is None or (isinstance(x, float) and pd.isna(x)): return "N/A"
    return f"${x:,.2f}"

def _to_inr(row, col, usd_inr):
    v = row[col]
    if v is None or (isinstance(v, float) and pd.isna(v)): return 0.0
    return v * usd_inr if row["currency"] == "USD" else v

def _to_usd(row, col, usd_inr):
    v = row[col]
    if v is None or (isinstance(v, float) and pd.isna(v)): return 0.0
    return v / usd_inr if row["currency"] == "INR" else v


# ── Commands ──────────────────────────────────────────────────────────────────

def cmd_validate(args):
    """Run schema validation only — no prices needed."""
    from src.data_loader import load_transactions
    from src.schema import validate_transactions
    print(f"[validate] {DATA_FILE}")
    txns = load_transactions(DATA_FILE)
    result = validate_transactions(txns)
    print(result)
    if args.export:
        out = Path("data/validation_report.txt")
        out.write_text(str(result))
        print(f"[export] {out}")


def cmd_summary(args):
    """Portfolio-level invested / current / gain table."""
    txns, holdings, realized, usd_inr = load_data(args.refresh)
    if args.usd_inr:
        usd_inr = args.usd_inr
        print(f"[override] USD/INR = {usd_inr}")

    rows = []
    for port, g in holdings.groupby("portfolio"):
        if port in USD_PORTS:
            inv  = g["total_invested"].sum()
            cur  = g["current_value"].sum()
            ccy  = "USD"
            fmt  = _fmt_usd
        else:
            inv  = g.apply(lambda r: _to_inr(r, "total_invested", usd_inr), axis=1).sum()
            cur  = g.apply(lambda r: _to_inr(r, "current_value",  usd_inr), axis=1).sum()
            ccy  = "INR"
            fmt  = _fmt_inr
        gain = cur - inv
        pct  = gain / inv * 100 if inv else 0
        rows.append(dict(portfolio=port, ccy=ccy, invested=inv,
                         current=cur, gain=gain, pct=pct, fmt=fmt))

    rows.sort(key=lambda r: -r["invested"])
    print()
    print(f"{'Portfolio':<20} {'Ccy':>4} {'Invested':>14} {'Current':>14} {'Gain/Loss':>14} {'Return':>8}")
    print("-" * 78)
    for r in rows:
        sign = "+" if r["gain"] >= 0 else ""
        print(f"{r['portfolio']:<20} {r['ccy']:>4} {r['fmt'](r['invested']):>14} "
              f"{r['fmt'](r['current']):>14} {r['fmt'](r['gain']):>14} {sign}{r['pct']:.1f}%")
    print("-" * 78)

    if args.export:
        df = pd.DataFrame([{k: v for k, v in r.items() if k != "fmt"} for r in rows])
        out = Path("data/summary.csv")
        df.to_csv(out, index=False)
        print(f"[export] {out}")


def cmd_holdings(args):
    """All open positions across all portfolios."""
    txns, holdings, realized, usd_inr = load_data(args.refresh)
    if args.usd_inr:
        usd_inr = args.usd_inr

    in_usd = holdings["portfolio"].isin(USD_PORTS)
    holdings["inv_disp"] = holdings.apply(
        lambda r: _to_usd(r, "total_invested", usd_inr) if r["portfolio"] in USD_PORTS
                  else _to_inr(r, "total_invested", usd_inr), axis=1)
    holdings["cur_disp"] = holdings.apply(
        lambda r: _to_usd(r, "current_value", usd_inr) if r["portfolio"] in USD_PORTS
                  else _to_inr(r, "current_value", usd_inr), axis=1)
    holdings["pnl_disp"] = holdings["cur_disp"] - holdings["inv_disp"]
    holdings["pnl_pct"]  = (holdings["pnl_disp"] / holdings["inv_disp"] * 100).round(1)
    holdings["ccy"]      = holdings["portfolio"].apply(lambda p: "USD" if p in USD_PORTS else "INR")

    cols = ["symbol", "portfolio", "ccy", "quantity", "avg_cost",
            "current_price", "inv_disp", "cur_disp", "pnl_disp", "pnl_pct"]
    print()
    print(f"{'Symbol':<14} {'Portfolio':<16} {'Ccy':>4} {'Qty':>10} "
          f"{'AvgCost':>10} {'LTP':>10} {'Invested':>12} {'Current':>12} {'P&L':>12} {'P&L%':>7}")
    print("-" * 107)
    for _, r in holdings.sort_values("inv_disp", ascending=False).iterrows():
        fmt  = _fmt_usd if r["ccy"] == "USD" else _fmt_inr
        ltp  = r["current_price"] if not pd.isna(r["current_price"]) else 0
        sign = "+" if r["pnl_disp"] >= 0 else ""
        print(f"{r['symbol']:<14} {r['portfolio']:<16} {r['ccy']:>4} {r['quantity']:>10.3f} "
              f"{r['avg_cost']:>10.2f} {ltp:>10.2f} {fmt(r['inv_disp']):>12} "
              f"{fmt(r['cur_disp']):>12} {fmt(r['pnl_disp']):>12} {sign}{r['pnl_pct']:.1f}%")
    print("-" * 107)

    if args.export:
        out = Path("data/holdings.csv")
        holdings[cols].to_csv(out, index=False)
        print(f"[export] {out}")


def cmd_portfolio(args):
    """Drill into a single portfolio."""
    txns, holdings, realized, usd_inr = load_data(args.refresh)
    if args.usd_inr:
        usd_inr = args.usd_inr

    name = args.name
    g = holdings[holdings["portfolio"] == name]
    if g.empty:
        available = sorted(holdings["portfolio"].unique())
        print(f"Portfolio '{name}' not found.\nAvailable: {available}")
        sys.exit(1)

    in_usd = name in USD_PORTS
    fmt    = _fmt_usd if in_usd else _fmt_inr
    conv   = (lambda r, c: _to_usd(r, c, usd_inr)) if in_usd else (lambda r, c: _to_inr(r, c, usd_inr))

    print()
    print(f"  Portfolio : {name}  ({'USD' if in_usd else 'INR'})")
    print(f"  Positions : {len(g)}")
    print()
    print(f"{'Symbol':<14} {'Qty':>10} {'AvgCost':>10} {'LTP':>10} "
          f"{'Invested':>12} {'Current':>12} {'P&L':>12} {'P&L%':>7}")
    print("-" * 95)
    for _, r in g.sort_values("total_invested", ascending=False).iterrows():
        inv  = conv(r, "total_invested")
        cur  = conv(r, "current_value")
        pnl  = cur - inv
        pct  = pnl / inv * 100 if inv else 0
        ltp  = r["current_price"] if not pd.isna(r["current_price"]) else 0
        sign = "+" if pnl >= 0 else ""
        print(f"{r['symbol']:<14} {r['quantity']:>10.3f} {r['avg_cost']:>10.2f} {ltp:>10.2f} "
              f"{fmt(inv):>12} {fmt(cur):>12} {fmt(pnl):>12} {sign}{pct:.1f}%")
    print("-" * 95)
    total_inv = g.apply(lambda r: conv(r, "total_invested"), axis=1).sum()
    total_cur = g.apply(lambda r: conv(r, "current_value"),  axis=1).sum()
    total_pnl = total_cur - total_inv
    total_pct = total_pnl / total_inv * 100 if total_inv else 0
    sign = "+" if total_pnl >= 0 else ""
    print(f"{'TOTAL':<14} {'':<10} {'':<10} {'':<10} "
          f"{fmt(total_inv):>12} {fmt(total_cur):>12} {fmt(total_pnl):>12} {sign}{total_pct:.1f}%")

    if args.export:
        out = Path(f"data/portfolio_{name.replace(' ', '_')}.csv")
        g.to_csv(out, index=False)
        print(f"[export] {out}")


def cmd_prices(args):
    """Show cached prices for all symbols."""
    cache = _load_cache()
    prices = cache.get("prices", {})
    usd_inr = cache.get("usd_inr", "N/A")
    age = int(time.time() - cache.get("prices_ts", 0))
    print(f"\nCached prices (age: {age}s) — USD/INR: {usd_inr}\n")
    missing = [(s, v) for s, v in prices.items() if v is None]
    found   = [(s, v) for s, v in prices.items() if v is not None]
    for sym, price in sorted(found):
        print(f"  {sym:<25} {price:>12.4f}")
    if missing:
        print(f"\n  Missing ({len(missing)}): {[s for s, _ in missing]}")


# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        prog="validate.py",
        description="Portfolio validation CLI"
    )
    sub = parser.add_subparsers(dest="command")

    def add_common(p):
        p.add_argument("-r", "--refresh",  action="store_true", help="Force price refresh")
        p.add_argument("-x", "--usd-inr",  type=float, metavar="RATE", help="Override USD/INR")
        p.add_argument("-e", "--export",   action="store_true", help="Export output to data/")

    p_val  = sub.add_parser("validate",  help="Schema validation only")
    p_val.add_argument("-e", "--export", action="store_true")

    p_sum  = sub.add_parser("summary",   help="Portfolio totals")
    add_common(p_sum)

    p_hld  = sub.add_parser("holdings",  help="All open positions")
    add_common(p_hld)

    p_port = sub.add_parser("portfolio", help="Single portfolio detail")
    p_port.add_argument("name", help="Portfolio name")
    add_common(p_port)

    p_px   = sub.add_parser("prices",    help="Show cached prices")

    args = parser.parse_args()

    # default to summary if no command given
    if not args.command:
        args.command = "summary"
        args.refresh = False
        args.usd_inr = None
        args.export  = False

    dispatch = {
        "validate":  cmd_validate,
        "summary":   cmd_summary,
        "holdings":  cmd_holdings,
        "portfolio": cmd_portfolio,
        "prices":    cmd_prices,
    }
    dispatch[args.command](args)


if __name__ == "__main__":
    main()
