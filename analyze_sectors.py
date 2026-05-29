"""Quick sector analysis: Tech + Banking XIRR for Stocks portfolio view."""
from src.engine import build
from src.xirr import xirr as compute_xirr
import datetime
import pandas as pd

SKIP_PORTS = {'Equity', 'MF_Portfolio'}
USD_PORTS  = {'Vested', 'IndMoney US', 'IndMoney Mummy'}

bundle  = build(currency='INR')
usd_inr = bundle.usd_inr
print(f'USD/INR: {usd_inr:.2f}\n')

holdings    = bundle.holdings
txns_df     = pd.DataFrame(bundle.transactions)
realized_df = pd.DataFrame(bundle.realized)

# Ensure yf_symbol column exists on realized
if 'yf_symbol' not in realized_df.columns:
    sym_to_yf = dict(zip(txns_df['symbol'], txns_df['yf_symbol']))
    realized_df['yf_symbol'] = realized_df['symbol'].map(lambda s: sym_to_yf.get(s, s))

SYMBOL_SECTOR = {
    'AXISBANK.NS':'Banking','ICICIBANK.NS':'Banking','IDFCFIRSTB.NS':'Banking',
    'SBIN.NS':'Banking','MAHABANK.NS':'Banking','FEDERALBNK.NS':'Banking',
    'HDFCBANK.NS':'Banking','KOTAKBANK.NS':'Banking','BANKBEES.NS':'Banking',
    'BANKBARODA.NS':'Banking','CANBK.NS':'Banking','BANDHANBNK.NS':'Banking',
    'INDUSINDBK.NS':'Banking','EQUITASBNK.NS':'Banking','AUBANK.NS':'Banking',
    'CSBBANK.NS':'Banking','CUB.NS':'Banking','UJJIVANSFB.NS':'Banking',
    'PNB.NS':'Banking','ESAFSFB.NS':'Banking',
    'META':'Tech','AMZN':'Tech','AAPL':'Tech','MSFT':'Tech','GOOGL':'Tech',
    'TSLA':'Tech','ADBE':'Tech','PATH':'Tech','NVDA':'Tech','SMCI':'Tech',
    'COIN':'Tech','PLTR':'Tech','SMH':'Tech','TSM':'Tech','CRWD':'Tech',
    'PANW':'Tech','NFLX':'Tech','AVGO':'Tech','DASH':'Tech','ASML':'Tech',
    'MELI':'Tech','IREN':'Tech','IONQ':'Tech','NBIS':'Tech','NOW':'Tech',
    'INTC':'Tech','SOUN':'Tech','FIG':'Tech',
    'MON100.NS':'Tech','MAFANG.NS':'Tech',
    '0P0001JMZB.BO':'Tech','0P0001NCLP.BO':'Tech',
}

today = datetime.date.today()

def sector_of(yf):
    return SYMBOL_SECTOR.get(yf, 'Other')

def holding_xirr(sym, port, terminal_inr):
    mask = (txns_df['symbol'] == sym) & (txns_df['portfolio'] == port) & txns_df['type'].isin(['BUY','SELL'])
    cfs = []
    for _, t in txns_df[mask].iterrows():
        fx  = usd_inr if port in USD_PORTS else 1.0
        amt = t['quantity'] * t['price'] * fx + (t.get('charges') or 0) * fx
        d   = datetime.date.fromisoformat(str(t['date'])[:10])
        cfs.append((d, -amt if t['type'] == 'BUY' else amt))
    if terminal_inr > 0:
        cfs.append((today, terminal_inr))
    if len(cfs) < 2:
        return None
    try:
        r = compute_xirr(cfs)
        return r * 100 if r is not None else None
    except:
        return None

def closed_holding_xirr(sym, port):
    mask = (txns_df['symbol'] == sym) & (txns_df['portfolio'] == port) & txns_df['type'].isin(['BUY','SELL'])
    cfs = []
    for _, t in txns_df[mask].iterrows():
        fx  = usd_inr if port in USD_PORTS else 1.0
        amt = t['quantity'] * t['price'] * fx + (t.get('charges') or 0) * fx
        d   = datetime.date.fromisoformat(str(t['date'])[:10])
        cfs.append((d, -amt if t['type'] == 'BUY' else amt))
    if len(cfs) < 2:
        return None
    try:
        r = compute_xirr(cfs)
        return r * 100 if r is not None else None
    except:
        return None

def pooled_sector_xirr(sector, open_df, include_closed):
    cfs      = []
    terminal = 0.0
    open_keys = set()
    for _, h in open_df.iterrows():
        if sector_of(h['yf_symbol']) != sector:
            continue
        fx  = usd_inr if h['currency'] == 'USD' else 1.0
        cur = h['current_value'] * fx
        terminal += cur
        open_keys.add(h['symbol'])
        mask = (txns_df['symbol'] == h['symbol']) & (txns_df['portfolio'] == h['portfolio']) & txns_df['type'].isin(['BUY','SELL'])
        for _, t in txns_df[mask].iterrows():
            tfx = usd_inr if h['portfolio'] in USD_PORTS else 1.0
            amt = t['quantity'] * t['price'] * tfx + (t.get('charges') or 0) * tfx
            d   = datetime.date.fromisoformat(str(t['date'])[:10])
            cfs.append((d, -amt if t['type'] == 'BUY' else amt))

    if include_closed:
        closed_r = realized_df[~realized_df['portfolio'].isin(SKIP_PORTS)]
        closed_r = closed_r[closed_r['yf_symbol'].map(sector_of) == sector]
        closed_r = closed_r[~closed_r['symbol'].isin(open_keys)]
        for _, r in closed_r.iterrows():
            mask = (txns_df['symbol'] == r['symbol']) & (txns_df['portfolio'] == r['portfolio']) & txns_df['type'].isin(['BUY','SELL'])
            for _, t in txns_df[mask].iterrows():
                tfx = usd_inr if r['portfolio'] in USD_PORTS else 1.0
                amt = t['quantity'] * t['price'] * tfx + (t.get('charges') or 0) * tfx
                d   = datetime.date.fromisoformat(str(t['date'])[:10])
                cfs.append((d, -amt if t['type'] == 'BUY' else amt))

    if terminal > 0:
        cfs.append((today, terminal))
    if len(cfs) < 2:
        return None
    try:
        r = compute_xirr(cfs)
        return r * 100 if r is not None else None
    except:
        return None

h_df = holdings[~holdings['portfolio'].isin(SKIP_PORTS)].copy()

for sector in ['Tech', 'Banking']:
    print('=' * 70)
    print(f'  {sector.upper()} SECTOR')
    print('=' * 70)

    sec_h = h_df[h_df['yf_symbol'].map(sector_of) == sector]

    # Open positions
    print(f'\n  Open positions:')
    print(f'  {"Symbol":<14} {"Portfolio":<16} {"XIRR":>8}  {"Invested":>8}  {"Current":>8}  {"Ret":>7}')
    print(f'  {"-"*14} {"-"*16} {"-"*8}  {"-"*8}  {"-"*8}  {"-"*7}')
    total_inv = 0.0; total_cur = 0.0
    for _, h in sec_h.sort_values('total_invested', ascending=False).iterrows():
        fx  = usd_inr if h['currency'] == 'USD' else 1.0
        inv = h['total_invested'] * fx
        cur = h['current_value']  * fx
        total_inv += inv; total_cur += cur
        ret = (cur - inv) / inv * 100 if inv > 0 else 0
        xv  = holding_xirr(h['symbol'], h['portfolio'], cur)
        xs  = f'{xv:+.1f}%' if xv is not None else 'N/A'
        print(f'  {h["symbol"]:<14} {h["portfolio"]:<16} {xs:>8}  {inv/1e5:>7.2f}L  {cur/1e5:>7.2f}L  {ret:>+6.1f}%')
    tot_ret = (total_cur - total_inv) / total_inv * 100 if total_inv > 0 else 0
    print(f'  {"TOTAL":<14} {"":<16} {"":>8}  {total_inv/1e5:>7.2f}L  {total_cur/1e5:>7.2f}L  {tot_ret:>+6.1f}%')

    # Closed positions
    open_sym_set = set(sec_h['symbol'])
    closed_mask  = (
        ~realized_df['portfolio'].isin(SKIP_PORTS) &
        (realized_df['yf_symbol'].map(sector_of) == sector) &
        (~realized_df['symbol'].isin(open_sym_set))
    )
    closed_rows = realized_df[closed_mask]
    if len(closed_rows):
        print(f'\n  Closed positions:')
        print(f'  {"Symbol":<14} {"Portfolio":<16} {"XIRR":>8}  {"Realized":>8}  {"Cost":>8}  {"Ret":>7}')
        print(f'  {"-"*14} {"-"*16} {"-"*8}  {"-"*8}  {"-"*8}  {"-"*7}')
        seen = {}
        for _, r in closed_rows.iterrows():
            key = (r['symbol'], r['portfolio'])
            if key in seen:
                seen[key]['realized'] += r['realized_pnl']
                seen[key]['cost']     += r['quantity'] * r['buy_price']
            else:
                seen[key] = {'realized': r['realized_pnl'], 'cost': r['quantity'] * r['buy_price'],
                             'portfolio': r['portfolio'], 'symbol': r['symbol'],
                             'currency': r.get('currency', 'INR')}
        for key, v in sorted(seen.items(), key=lambda x: -abs(x[1]['cost'])):
            fx       = usd_inr if v['currency'] == 'USD' else 1.0
            realized = v['realized'] * fx
            cost     = v['cost']     * fx
            ret      = realized / cost * 100 if cost > 0 else 0
            xv       = closed_holding_xirr(v['symbol'], v['portfolio'])
            xs       = f'{xv:+.1f}%' if xv is not None else 'N/A'
            print(f'  {v["symbol"]:<14} {v["portfolio"]:<16} {xs:>8}  {realized/1e5:>+7.2f}L  {cost/1e5:>7.2f}L  {ret:>+6.1f}%')

    xirr_open = pooled_sector_xirr(sector, sec_h, include_closed=False)
    xirr_all  = pooled_sector_xirr(sector, sec_h, include_closed=True)
    print(f'\n  Sector XIRR  open-only  : {xirr_open:+.1f}%' if xirr_open is not None else '\n  Sector XIRR  open-only  : N/A')
    print(f'  Sector XIRR  open+closed: {xirr_all:+.1f}%'  if xirr_all  is not None else '  Sector XIRR  open+closed: N/A')
    print()
