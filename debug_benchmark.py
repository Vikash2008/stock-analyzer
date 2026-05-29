#!/usr/bin/env python3
"""
debug_benchmark.py
Replicates useBenchmarkXirr.ts for the Indian Stocks segment.

Prints per-holding, per-sector, and overall XIRRs — both open-only and
open+closed cashflow bases — so we can see exactly where the alpha gap
comes from.

Run from repo root:
    python debug_benchmark.py
"""

import sys, math
from collections import defaultdict
from datetime import date, datetime
import yfinance as yf
from scipy.optimize import brentq

sys.path.insert(0, '.')
from src.engine import build

# ── Config ────────────────────────────────────────────────────────────────────

INDIAN_STOCK_PORTS = {'Zerodha', 'AngelOne', 'Groww', 'IndMoney Ind', 'Upstox'}

# US-tracking ETFs held in Indian portfolios (Zerodha).
# getSegmentType() classifies these as 'us_stock', so the UI excludes them from
# the Indian stocks segment. Mirror that here so the numbers match the UI.
US_ETF_SYMS = {'MON100.NS', 'MAFANG.NS'}

# Synced exactly with frontend/src/utils/sectors.ts
SYMBOL_SECTOR = {
    # Banking
    'AXISBANK.NS': 'Banking', 'ICICIBANK.NS': 'Banking', 'IDFCFIRSTB.NS': 'Banking',
    'SBIN.NS': 'Banking', 'MAHABANK.NS': 'Banking', 'FEDERALBNK.NS': 'Banking',
    'HDFCBANK.NS': 'Banking', 'KOTAKBANK.NS': 'Banking', 'BANKBEES.NS': 'Banking',
    'BANKBARODA.NS': 'Banking', 'CANBK.NS': 'Banking', 'BANDHANBNK.NS': 'Banking',
    'INDUSINDBK.NS': 'Banking', 'EQUITASBNK.NS': 'Banking', 'AUBANK.NS': 'Banking',
    'CSBBANK.NS': 'Banking', 'CUB.NS': 'Banking', 'UJJIVANSFB.NS': 'Banking',
    'PNB.NS': 'Banking', 'ESAFSFB.NS': 'Banking',
    # Finance
    'BAJFINANCE.NS': 'Finance', 'AAVAS.NS': 'Finance', 'APTUS.NS': 'Finance',
    'ARMANFIN.NS': 'Finance', 'SBICARD.NS': 'Finance', 'HDFCLIFE.NS': 'Finance',
    'SBILIFE.NS': 'Finance', 'ANGELONE.NS': 'Finance', 'CDSL.NS': 'Finance',
    'HDFCAMC.NS': 'Finance', 'NAM-INDIA.NS': 'Finance', 'NUVAMA.NS': 'Finance',
    'JIOFIN.NS': 'Finance', 'BSE.NS': 'Finance', 'CAMS.NS': 'Finance',
    'WEALTH.NS': 'Finance', 'BAJAJFINSV.NS': 'Finance', 'MANAPPURAM.NS': 'Finance',
    'M&MFIN.NS': 'Finance', 'ABSLAMC.NS': 'Finance', '5PAISA.NS': 'Finance',
    'SAMMAANCAP.NS': 'Finance', 'LICI.NS': 'Finance', 'POLICYBZR.NS': 'Finance',
    'PAYTM.NS': 'Finance', 'TATAINVEST.NS': 'Finance', 'IBREALEST.NS': 'Finance',
    # Healthcare
    'LALPATHLAB.NS': 'Healthcare', 'NH.NS': 'Healthcare', 'MAXHEALTH.NS': 'Healthcare',
    'MEDANTA.NS': 'Healthcare', 'APOLLOHOSP.NS': 'Healthcare', 'FORTIS.NS': 'Healthcare',
    'SUPRIYA.NS': 'Healthcare', 'YATHARTH.NS': 'Healthcare', 'HEALTHY.NS': 'Healthcare',
    'DIVISLAB.NS': 'Healthcare', 'GLAND.NS': 'Healthcare', 'ZYDUSLIFE.NS': 'Healthcare',
    'ZYDUSWELL.NS': 'Healthcare', 'AMRUTANJAN.NS': 'Healthcare',
    # IT
    'ITBEES.NS': 'IT', 'AFFLE.NS': 'IT',
    '0P0001784G.BO': 'IT', '0P0000XVXV.BO': 'IT',
    'INFY.NS': 'IT', 'TCS.NS': 'IT', 'KPITTECH.NS': 'IT',
    'TATAELXSI.NS': 'IT', 'HAPPSTMNDS.NS': 'IT', 'TECHM.NS': 'IT',
    # Growth
    'ETERNAL.NS': 'Growth', 'SWIGGY.NS': 'Growth', 'RATEGAIN.NS': 'Growth',
    'DSSL.NS': 'Growth', 'NETWEB.NS': 'Growth',
    'LAXMIMACH.NS': 'Growth', 'INDIAMART.NS': 'Growth', 'DREAMFOLKS.NS': 'Growth',
    'IRCTC.NS': 'Growth', 'EASEMYTRIP.NS': 'Growth',
    # Tech (US stocks + US-tracking ETFs in Indian portfolios)
    'MON100.NS': 'Tech', 'MAFANG.NS': 'Tech',
    '0P0001JMZB.BO': 'Tech', '0P0001NCLP.BO': 'Tech',
    # Smallcap
    '0P0000XVFY.BO': 'Smallcap', '0P0000XVAA.BO': 'Smallcap',
    '0P00011MAX.BO': 'Smallcap', '0P0000XVJR.BO': 'Smallcap',
    '0P0001EUZZ.BO': 'Smallcap', '0P0001F5O4.BO': 'Smallcap',
    '0P0000XW24.BO': 'Smallcap',
    'DELTACORP.NS': 'Smallcap', 'TARSONS.NS': 'Smallcap',
    'GREENPANEL.NS': 'Smallcap', 'ORIENTELEC.NS': 'Smallcap', 'PVRINOX.NS': 'Smallcap',
    # Equity (diversified/ELSS MFs)
    '0P0000XW2T.BO': 'Equity', '0P00017844.BO': 'Equity', '0P0000YWL1.BO': 'Equity',
    # Consumer (FMCG + Consumer Durables)
    'HINDUNILVR.NS': 'Consumer', 'ASIANPAINT.NS': 'Consumer', 'DMART.NS': 'Consumer',
    'PAGEIND.NS': 'Consumer', 'EMAMILTD.NS': 'Consumer', 'HAVELLS.NS': 'Consumer',
    'WHIRLPOOL.NS': 'Consumer', 'BERGEPAINT.NS': 'Consumer', 'MANYAVAR.NS': 'Consumer',
    'SYMPHONY.NS': 'Consumer', 'TTKPRESTIG.NS': 'Consumer', 'VGUARD.NS': 'Consumer',
    'MARICO.NS': 'Consumer', 'ITC.NS': 'Consumer', 'VOLTAS.NS': 'Consumer',
    'NYKAA.NS': 'Consumer',
    # Other (explicit — includes NIFTYBEES since same ^NSEI benchmark as Other)
    'NIFTYBEES.NS': 'Other',
    'INDIGOPNTS.NS': 'Other', 'JYOTIRES.BO': 'Other', 'PIIND.NS': 'Other',
}

SECTOR_BENCHMARK = {
    'Banking': '^NSEBANK', 'Finance': 'NIFTY_FIN_SERVICE.NS',
    'Healthcare': '^CNXPHARMA', 'IT': '^CNXIT', 'Growth': '^CRSLDX',
    'Tech': '^NDX', 'Smallcap': 'NIFTY_MIDCAP_100.NS', 'Equity': '^NSEI',
    'Consumer': '^CNXFMCG', 'Other': '^NSEI',
}

def get_sector(yf_symbol):
    return SYMBOL_SECTOR.get(yf_symbol, 'Other')

# ── XIRR ─────────────────────────────────────────────────────────────────────

def compute_xirr(cashflows):
    """cashflows: list of (datetime, amount). Returns rate or None."""
    if len(cashflows) < 2:
        return None
    t0 = cashflows[0][0]
    def npv(r):
        total = 0.0
        for dt, amt in cashflows:
            years = (dt - t0).days / 365.25
            denom = (1 + r) ** years
            if denom == 0:
                return float('inf')
            total += amt / denom
        return total
    try:
        return brentq(npv, -0.9999, 500.0, maxiter=2000, xtol=1e-8)
    except Exception:
        return None

def fmt_xirr(r):
    if r is None:
        return '   N/A  '
    return f'{r*100:+7.2f}%'

# ── Benchmark price fetcher ───────────────────────────────────────────────────

_bench_cache = {}

def get_bench_prices(sym, start_date_str):
    if sym in _bench_cache:
        return _bench_cache[sym]
    print(f"  Fetching benchmark {sym}...")
    try:
        hist = yf.Ticker(sym).history(start=start_date_str, auto_adjust=True)
        prices = {}
        if not hist.empty:
            for idx, row in hist.iterrows():
                d = idx.date() if hasattr(idx, 'date') else idx
                prices[str(d)] = float(row['Close'])
        _bench_cache[sym] = prices
        return prices
    except Exception as e:
        print(f"  WARN: {sym} fetch failed: {e}")
        _bench_cache[sym] = {}
        return {}

def price_on_or_before(prices, target_str):
    best = None
    for d in sorted(prices):
        if d <= target_str:
            best = prices[d]
        else:
            break
    return best

# ── Core benchmark computation ────────────────────────────────────────────────

def compute_benchmark(txns_df, holdings_df, realized_df, scope_label, usd_inr):
    """
    txns_df:    all transactions to include (open + closed or open-only)
    holdings_df: current open holdings (for terminal value)
    returns: dict with sector results + overall
    """
    today = datetime.combine(date.today(), datetime.min.time())

    # Find earliest date for benchmark fetch
    all_dates = txns_df['date'].dropna().sort_values()
    start_date = str(all_dates.iloc[0])[:10] if len(all_dates) > 0 else '2019-01-01'

    # Pre-fetch all needed benchmark histories
    needed_benchmarks = set()
    for _, tx in txns_df.iterrows():
        sector = get_sector(tx['yf_symbol'])
        needed_benchmarks.add(SECTOR_BENCHMARK[sector])
    for bs in needed_benchmarks:
        get_bench_prices(bs, start_date)

    # Per (portfolio:symbol) state
    qty_held   = defaultdict(float)
    units_held = defaultdict(float)  # benchmark units
    key_meta   = {}                  # key -> {sector, bench_sym, yf_symbol}

    # Cashflow buckets
    sector_actual  = defaultdict(list)
    sector_bench   = defaultdict(list)
    overall_actual = []
    overall_bench  = []

    # Per-holding bucket (yf_symbol level, merged across portfolios)
    holding_actual = defaultdict(list)
    holding_bench  = defaultdict(list)

    # Process transactions chronologically
    for _, tx in txns_df.sort_values('date').iterrows():
        port     = tx['portfolio']
        sym      = tx['symbol']
        yf_sym   = tx['yf_symbol']
        tx_type  = tx['type']
        qty      = float(tx['quantity'])
        price    = float(tx['price'])
        charges  = float(tx['charges']) if not (isinstance(tx['charges'], float) and math.isnan(tx['charges'])) else 0.0
        date_str = str(tx['date'])[:10]
        tx_date  = datetime.strptime(date_str, '%Y-%m-%d')

        sector   = get_sector(yf_sym)
        bench_sym = SECTOR_BENCHMARK[sector]
        bench_prices = get_bench_prices(bench_sym, start_date)
        bench_p  = price_on_or_before(bench_prices, date_str)

        key = f"{port}:{sym}"
        if key not in key_meta:
            key_meta[key] = {'sector': sector, 'bench_sym': bench_sym, 'yf_symbol': yf_sym}

        amount = qty * price + charges  # INR (all Indian stocks)

        if tx_type == 'BUY':
            qty_held[key]   += qty
            if bench_p:
                units_held[key] += amount / bench_p

            cf = (tx_date, -amount)
            sector_actual[sector].append(cf)
            sector_bench[sector].append(cf)
            overall_actual.append(cf)
            overall_bench.append(cf)
            holding_actual[yf_sym].append(cf)
            holding_bench[yf_sym].append(cf)

        elif tx_type == 'SELL':
            prev_qty = qty_held[key]
            if prev_qty <= 0:
                continue
            frac = min(qty / prev_qty, 1.0)
            qty_held[key] = max(0, prev_qty - qty)

            sell_amt = qty * price - charges
            sector_actual[sector].append((tx_date, sell_amt))
            overall_actual.append((tx_date, sell_amt))
            holding_actual[yf_sym].append((tx_date, sell_amt))

            if bench_p:
                prev_units = units_held[key]
                units_sold = frac * prev_units
                units_held[key] = max(0, prev_units - units_sold)
                bench_sell = units_sold * bench_p
                sector_bench[sector].append((tx_date, bench_sell))
                overall_bench.append((tx_date, bench_sell))
                holding_bench[yf_sym].append((tx_date, bench_sell))

    # Terminal values from open holdings
    sector_val = defaultdict(float)
    for _, h in holdings_df.iterrows():
        s = get_sector(h['yf_symbol'])
        sector_val[s] += h['disp_current']

    total_act_term = 0
    for s, v in sector_val.items():
        if v > 0:
            sector_actual[s].append((today, v))
            total_act_term += v
    if total_act_term > 0:
        overall_actual.append((today, total_act_term))

    # Benchmark terminal: remaining units × current bench price
    for key, units in units_held.items():
        if units <= 0:
            continue
        meta = key_meta.get(key)
        if not meta:
            continue
        bench_prices = get_bench_prices(meta['bench_sym'], start_date)
        if not bench_prices:
            continue
        cur_bench = bench_prices[max(bench_prices.keys())]
        tv = units * cur_bench
        sector_bench[meta['sector']].append((today, tv))
        overall_bench.append((today, tv))
        holding_bench[meta['yf_symbol']].append((today, tv))

    # Compute XIRRs
    results = {}
    print(f"\n{'='*70}")
    print(f"  SCOPE: {scope_label}")
    print(f"{'='*70}")

    # Per-sector
    print(f"\n  {'Sector':<14}  {'Actual XIRR':>12}  {'Bench XIRR':>11}  {'Alpha':>8}  {'#CFs act':>9}  {'#CFs bench':>10}")
    print(f"  {'-'*14}  {'-'*12}  {'-'*11}  {'-'*8}  {'-'*9}  {'-'*10}")
    sector_results = {}
    for sector in sorted(set(list(sector_actual.keys()) + list(sector_bench.keys()))):
        a_cfs = sector_actual.get(sector, [])
        b_cfs = sector_bench.get(sector, [])
        a_xirr = compute_xirr(a_cfs)
        b_xirr = compute_xirr(b_cfs)
        alpha = (a_xirr - b_xirr) if (a_xirr is not None and b_xirr is not None) else None
        sector_results[sector] = (a_xirr, b_xirr, alpha)
        print(f"  {sector:<14}  {fmt_xirr(a_xirr):>12}  {fmt_xirr(b_xirr):>11}  {fmt_xirr(alpha):>8}  {len(a_cfs):>9}  {len(b_cfs):>10}")

    # Overall
    oa = compute_xirr(overall_actual)
    ob = compute_xirr(overall_bench)
    alpha_ov = (oa - ob) if (oa is not None and ob is not None) else None
    print(f"\n  {'OVERALL':<14}  {fmt_xirr(oa):>12}  {fmt_xirr(ob):>11}  {fmt_xirr(alpha_ov):>8}  {len(overall_actual):>9}  {len(overall_bench):>10}")

    results['sectors'] = sector_results
    results['overall'] = (oa, ob, alpha_ov)
    results['holding_actual'] = holding_actual
    results['holding_bench']  = holding_bench
    return results


def print_holding_detail(holdings_df, txns_df, usd_inr):
    """Print per-holding XIRR (open positions only, terminal = disp_current)."""
    today = datetime.combine(date.today(), datetime.min.time())
    print(f"\n{'='*70}")
    print(f"  PER-HOLDING XIRR (open positions, terminal = live price)")
    print(f"{'='*70}")
    print(f"\n  {'Symbol':<20}  {'Sector':<12}  {'XIRR':>8}  {'Invested':>10}  {'Current':>10}")
    print(f"  {'-'*20}  {'-'*12}  {'-'*8}  {'-'*10}  {'-'*10}")

    holding_rows = []
    for _, h in holdings_df.iterrows():
        yf_sym = h['yf_symbol']
        sector = get_sector(yf_sym)
        port   = h['portfolio']

        htxns = txns_df[
            (txns_df['yf_symbol'] == yf_sym) &
            (txns_df['portfolio'] == port) &
            (txns_df['type'].isin(['BUY', 'SELL']))
        ].sort_values('date')

        cfs = []
        for _, tx in htxns.iterrows():
            dt  = datetime.strptime(str(tx['date'])[:10], '%Y-%m-%d')
            qty = float(tx['quantity'])
            prc = float(tx['price'])
            chg = float(tx['charges']) if not (isinstance(tx['charges'], float) and math.isnan(tx['charges'])) else 0.0
            if tx['type'] == 'BUY':
                cfs.append((dt, -(qty * prc + chg)))
            else:
                cfs.append((dt, qty * prc - chg))

        # terminal
        cur = float(h['disp_current'])
        if cur > 0:
            cfs.append((today, cur))

        xirr = compute_xirr(cfs)
        inv  = float(h['disp_invested'])
        holding_rows.append((sector, yf_sym, xirr, inv, cur))

    holding_rows.sort(key=lambda r: (r[0], -(r[3] or 0)))
    cur_sector = None
    for sector, yf_sym, xirr, inv, cur in holding_rows:
        if sector != cur_sector:
            print(f"\n  --- {sector} ---")
            cur_sector = sector
        print(f"  {yf_sym:<20}  {sector:<12}  {fmt_xirr(xirr):>8}  {inv/1e5:>9.2f}L  {cur/1e5:>9.2f}L")


def print_closed_holdings(realized_df, txns_df):
    """Show closed positions: what sector they're in, their XIRR."""
    today = datetime.combine(date.today(), datetime.min.time())

    # Find symbols that are in realized but have no open holding
    open_yf = set(realized_df['yf_symbol'].unique()) if 'yf_symbol' in realized_df.columns else set()
    # We'll work from transactions directly

    # Get all (portfolio, symbol) pairs from transactions
    all_keys = txns_df.groupby(['portfolio', 'symbol', 'yf_symbol'])['quantity'].sum().reset_index()

    print(f"\n{'='*70}")
    print(f"  CLOSED POSITIONS included in benchmark calc (key source of surprise)")
    print(f"{'='*70}")
    print(f"\n  {'yf_symbol':<22}  {'Portfolio':<16}  {'Sector':<12}  {'XIRR':>8}  {'Invested':>10}")
    print(f"  {'-'*22}  {'-'*16}  {'-'*12}  {'-'*8}  {'-'*10}")

    closed_count = 0
    for _, row in all_keys.iterrows():
        port   = row['portfolio']
        sym    = row['symbol']
        yf_sym = row['yf_symbol']
        sector = get_sector(yf_sym)

        htxns = txns_df[
            (txns_df['yf_symbol'] == yf_sym) &
            (txns_df['portfolio'] == port) &
            (txns_df['type'].isin(['BUY', 'SELL']))
        ].sort_values('date')

        total_qty = 0.0
        total_inv = 0.0
        cfs = []
        for _, tx in htxns.iterrows():
            dt  = datetime.strptime(str(tx['date'])[:10], '%Y-%m-%d')
            qty = float(tx['quantity'])
            prc = float(tx['price'])
            chg = float(tx['charges']) if not (isinstance(tx['charges'], float) and math.isnan(tx['charges'])) else 0.0
            if tx['type'] == 'BUY':
                total_qty += qty
                total_inv += qty * prc + chg
                cfs.append((dt, -(qty * prc + chg)))
            else:
                total_qty -= qty
                cfs.append((dt, qty * prc - chg))

        if total_qty > 0.001:
            continue  # open position — skip

        closed_count += 1
        xirr = compute_xirr(cfs)
        print(f"  {yf_sym:<22}  {port:<16}  {sector:<12}  {fmt_xirr(xirr):>8}  {total_inv/1e5:>9.2f}L")

    if closed_count == 0:
        print("  (none found)")


def print_unclassified_summary(txns_df):
    """
    Show all yf_symbols that defaulted to 'Other' because they are NOT in SYMBOL_SECTOR.
    These are the silent alpha-killers — benchmarked against ^NSEI with no intentional classification.
    """
    print(f"\n{'='*70}")
    print(f"  UNCLASSIFIED SYMBOLS (defaulted to Other/^NSEI benchmark)")
    print(f"  These are NOT in SYMBOL_SECTOR — any alpha vs ^NSEI here affects overall")
    print(f"{'='*70}")

    # Find all unique yf_symbols across Indian stock txns
    syms = txns_df['yf_symbol'].unique()
    unclassified = sorted([s for s in syms if s not in SYMBOL_SECTOR])

    if not unclassified:
        print("  None — all symbols are explicitly classified. Good!")
        return

    print(f"\n  {'yf_symbol':<22}  {'Invested (L)':>12}  {'Open?':>6}")
    print(f"  {'-'*22}  {'-'*12}  {'-'*6}")

    for sym in unclassified:
        sym_txns = txns_df[txns_df['yf_symbol'] == sym]
        total_qty = 0.0
        total_inv = 0.0
        for _, tx in sym_txns.iterrows():
            qty = float(tx['quantity'])
            prc = float(tx['price'])
            chg = float(tx['charges']) if not (isinstance(tx['charges'], float) and math.isnan(tx['charges'])) else 0.0
            if tx['type'] == 'BUY':
                total_qty += qty
                total_inv += qty * prc + chg
            elif tx['type'] == 'SELL':
                total_qty -= qty
        is_open = total_qty > 0.001
        print(f"  {sym:<22}  {total_inv/1e5:>12.2f}  {'OPEN' if is_open else 'closed':>6}")

    print(f"\n  Total unclassified: {len(unclassified)} symbols")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("Loading portfolio bundle (cache)...")
    bundle = build(currency='INR', force_refresh_prices=False)

    # Filter to Indian stock portfolios
    txns_all = bundle.transactions
    hold_all = bundle.holdings
    real_all = bundle.realized

    txns_ind = txns_all[
        txns_all['portfolio'].isin(INDIAN_STOCK_PORTS) &
        txns_all['type'].isin(['BUY', 'SELL']) &
        ~txns_all['yf_symbol'].isin(US_ETF_SYMS)
    ].copy()

    hold_ind = hold_all[hold_all['portfolio'].isin(INDIAN_STOCK_PORTS)].copy()
    real_ind = real_all[real_all['portfolio'].isin(INDIAN_STOCK_PORTS)].copy() if len(real_all) > 0 else real_all

    usd_inr = bundle.usd_inr
    print(f"USD/INR: {usd_inr:.2f}")
    print(f"Transactions (Indian stocks): {len(txns_ind)}")
    print(f"Open holdings (Indian stocks): {len(hold_ind)}")

    # Phase 1: Per-holding XIRR
    print_holding_detail(hold_ind, txns_ind, usd_inr)

    # Phase 2: Closed positions
    print_closed_holdings(real_ind, txns_ind)

    # Phase 2b: Unclassified symbols (defaulted to Other)
    print_unclassified_summary(txns_ind)

    # Phase 3a: Sector + overall XIRR — open positions only
    # Build open-only transactions (only yf_symbols that have open holdings)
    open_yf_syms = set(hold_ind['yf_symbol'].unique())
    txns_open_only = txns_ind[txns_ind['yf_symbol'].isin(open_yf_syms)]
    results_open = compute_benchmark(
        txns_open_only, hold_ind, real_ind,
        "OPEN POSITIONS ONLY", usd_inr
    )

    # Phase 3b: Sector + overall XIRR — open + closed (as frontend does)
    results_all = compute_benchmark(
        txns_ind, hold_ind, real_ind,
        "OPEN + CLOSED POSITIONS (frontend behaviour)", usd_inr
    )

    # Phase 4: Summary diff
    print(f"\n{'='*70}")
    print(f"  ALPHA COMPARISON: open-only vs open+closed")
    print(f"{'='*70}")
    print(f"\n  {'Sector':<14}  {'Alpha (open-only)':>18}  {'Alpha (open+closed)':>20}  {'Diff':>8}")
    print(f"  {'-'*14}  {'-'*18}  {'-'*20}  {'-'*8}")
    all_sectors = sorted(set(list(results_open['sectors'].keys()) + list(results_all['sectors'].keys())))
    for s in all_sectors:
        a_open = results_open['sectors'].get(s, (None, None, None))[2]
        a_all  = results_all['sectors'].get(s, (None, None, None))[2]
        diff = (a_all - a_open) if (a_open is not None and a_all is not None) else None
        print(f"  {s:<14}  {fmt_xirr(a_open):>18}  {fmt_xirr(a_all):>20}  {fmt_xirr(diff):>8}")

    oa_open = results_open['overall'][2]
    oa_all  = results_all['overall'][2]
    diff_ov = (oa_all - oa_open) if (oa_open is not None and oa_all is not None) else None
    print(f"  {'OVERALL':<14}  {fmt_xirr(oa_open):>18}  {fmt_xirr(oa_all):>20}  {fmt_xirr(diff_ov):>8}")

    print()


if __name__ == '__main__':
    main()
