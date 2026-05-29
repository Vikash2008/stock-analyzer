export type SectorKey =
  | 'Banking' | 'Finance' | 'Healthcare' | 'IT'
  | 'Growth'  | 'Tech'    | 'Smallcap'   | 'Equity' | 'Consumer' | 'Other'

export const SECTOR_COLOR: Record<SectorKey, string> = {
  Banking:    '#3b82f6',
  Finance:    '#8b5cf6',
  Healthcare: '#22c55e',
  IT:         '#06b6d4',
  Growth:     '#f97316',
  Tech:       '#38bdf8',
  Smallcap:   '#f59e0b',
  Equity:     '#10b981',
  Consumer:   '#ec4899',
  Other:      '#94a3b8',
}

const SYMBOL_SECTOR: Record<string, SectorKey> = {
  // ── Banking ────────────────────────────────────────────
  'AXISBANK.NS':   'Banking',
  'ICICIBANK.NS':  'Banking',
  'IDFCFIRSTB.NS': 'Banking',
  'SBIN.NS':       'Banking',
  'MAHABANK.NS':   'Banking',
  'FEDERALBNK.NS': 'Banking',
  'HDFCBANK.NS':   'Banking',
  'KOTAKBANK.NS':  'Banking',
  'BANKBEES.NS':   'Banking',   // Nifty Bank BeES ETF
  'BANKBARODA.NS': 'Banking',
  'CANBK.NS':      'Banking',
  'BANDHANBNK.NS': 'Banking',
  'INDUSINDBK.NS': 'Banking',
  'EQUITASBNK.NS': 'Banking',
  'AUBANK.NS':     'Banking',
  'CSBBANK.NS':    'Banking',
  'CUB.NS':        'Banking',
  'UJJIVANSFB.NS': 'Banking',
  'PNB.NS':        'Banking',
  'ESAFSFB.NS':    'Banking',

  // ── Finance ────────────────────────────────────────────
  'BAJFINANCE.NS': 'Finance',
  'AAVAS.NS':      'Finance',
  'APTUS.NS':      'Finance',
  'ARMANFIN.NS':   'Finance',
  'SBICARD.NS':    'Finance',
  'HDFCLIFE.NS':   'Finance',
  'SBILIFE.NS':    'Finance',
  'ANGELONE.NS':   'Finance',
  'CDSL.NS':       'Finance',
  'HDFCAMC.NS':    'Finance',
  'NAM-INDIA.NS':  'Finance',
  'NUVAMA.NS':     'Finance',
  'JIOFIN.NS':     'Finance',
  'BSE.NS':        'Finance',
  'CAMS.NS':       'Finance',
  'WEALTH.NS':     'Finance',
  'BAJAJFINSV.NS': 'Finance',
  'MANAPPURAM.NS': 'Finance',
  'M&MFIN.NS':     'Finance',
  'ABSLAMC.NS':    'Finance',
  '5PAISA.NS':     'Finance',
  'SAMMAANCAP.NS': 'Finance',
  'LICI.NS':       'Finance',
  'POLICYBZR.NS':  'Finance',
  'PAYTM.NS':      'Finance',
  'TATAINVEST.NS': 'Finance',
  'IBREALEST.NS':  'Finance',

  // ── Healthcare ─────────────────────────────────────────
  'LALPATHLAB.NS': 'Healthcare',
  'NH.NS':         'Healthcare',
  'MAXHEALTH.NS':  'Healthcare',
  'MEDANTA.NS':    'Healthcare',
  'APOLLOHOSP.NS': 'Healthcare',
  'FORTIS.NS':     'Healthcare',
  'SUPRIYA.NS':    'Healthcare',
  'YATHARTH.NS':   'Healthcare',
  'HEALTHY.NS':    'Healthcare',
  'DIVISLAB.NS':   'Healthcare',
  'GLAND.NS':      'Healthcare',
  'ZYDUSLIFE.NS':  'Healthcare',
  'ZYDUSWELL.NS':  'Healthcare',
  'AMRUTANJAN.NS': 'Healthcare',

  // ── IT ─────────────────────────────────────────────────
  'ITBEES.NS':     'IT',
  'AFFLE.NS':      'IT',
  '0P0001784G.BO': 'IT',   // Tata Digital India Dir Gr
  '0P0000XVXV.BO': 'IT',   // Aditya BSL Digital India Dir Gr
  'INFY.NS':       'IT',
  'TCS.NS':        'IT',
  'KPITTECH.NS':   'IT',
  'TATAELXSI.NS':  'IT',
  'HAPPSTMNDS.NS': 'IT',
  'TECHM.NS':      'IT',

  // ── Growth ─────────────────────────────────────────────
  'ETERNAL.NS':    'Growth',
  'SWIGGY.NS':     'Growth',
  'RATEGAIN.NS':   'Growth',
  'DSSL.NS':       'Growth',
  'NETWEB.NS':     'Growth',
  'LAXMIMACH.NS':  'Growth',
  'INDIAMART.NS':  'Growth',
  'DREAMFOLKS.NS': 'Growth',
  'IRCTC.NS':      'Growth',
  'EASEMYTRIP.NS': 'Growth',

  // ── Tech (US stocks + US-tracking ETFs/MFs) ────────────
  'META':          'Tech',
  'AMZN':          'Tech',
  'AAPL':          'Tech',
  'MSFT':          'Tech',
  'GOOGL':         'Tech',
  'TSLA':          'Tech',
  'ADBE':          'Tech',
  'PATH':          'Tech',
  'NVDA':          'Tech',
  'SMCI':          'Tech',
  'COIN':          'Tech',
  'PLTR':          'Tech',
  'SMH':           'Tech',
  'TSM':           'Tech',
  'CRWD':          'Tech',
  'PANW':          'Tech',
  'NFLX':          'Tech',
  'AVGO':          'Tech',
  'DASH':          'Tech',
  'ASML':          'Tech',
  'MELI':          'Tech',
  'IREN':          'Tech',
  'IONQ':          'Tech',
  'NBIS':          'Tech',
  'NOW':           'Tech',
  'INTC':          'Tech',
  'SOUN':          'Tech',
  'FIG':           'Tech',
  'MON100.NS':     'Tech',  // Motilal Oswal NASDAQ 100 ETF
  'MAFANG.NS':     'Tech',  // Mirae Asset NYSE FANG+ ETF
  '0P0001JMZB.BO': 'Tech',  // Motilal Oswal S&P 500 Index Dir Gr
  '0P0001NCLP.BO': 'Tech',  // ICICI Pru NASDAQ 100 Index Dir Gr

  // ── Smallcap (MFs) ─────────────────────────────────────
  '0P0000XVFY.BO': 'Smallcap', // Nippon India Small Cap Dir Gr
  '0P0000XVAA.BO': 'Smallcap', // HDFC Small Cap Dir Gr
  '0P00011MAX.BO': 'Smallcap', // Axis Small Cap Fund Dir Gr
  '0P0000XVJR.BO': 'Smallcap', // SBI Contra Dir Gr
  '0P0001EUZZ.BO': 'Smallcap', // Tata Small Cap Fund Dir Gr
  '0P0001F5O4.BO': 'Smallcap', // Bank of India Small Cap Dir Gr
  '0P0000XW24.BO': 'Smallcap', // DSP Small Cap Dir Gr
  'DELTACORP.NS':  'Smallcap',
  'TARSONS.NS':    'Smallcap',
  'GREENPANEL.NS': 'Smallcap',
  'ORIENTELEC.NS': 'Smallcap',
  'PVRINOX.NS':    'Smallcap',

  // ── Equity (diversified/ELSS MFs) ──────────────────────
  '0P0000XW2T.BO': 'Equity',   // DSP ELSS Tax Saver Dir Gr
  '0P00017844.BO': 'Equity',   // Mirae Asset ELSS Tax Saver Dir Gr
  '0P0000YWL1.BO': 'Equity',   // Parag Parikh Long Term Equity Direct Growth
  'NIFTYBEES.NS':  'Other',    // Nifty 50 BeES ETF (same ^NSEI benchmark as Other)

  // ── Consumer (FMCG + Consumer Durables) ───────────────────────
  'HINDUNILVR.NS': 'Consumer',
  'ASIANPAINT.NS': 'Consumer',
  'DMART.NS':      'Consumer',
  'PAGEIND.NS':    'Consumer',
  'EMAMILTD.NS':   'Consumer',
  'HAVELLS.NS':    'Consumer',
  'WHIRLPOOL.NS':  'Consumer',
  'BERGEPAINT.NS': 'Consumer',
  'MANYAVAR.NS':   'Consumer',
  'SYMPHONY.NS':   'Consumer',
  'TTKPRESTIG.NS': 'Consumer',
  'VGUARD.NS':     'Consumer',
  'MARICO.NS':     'Consumer',
  'ITC.NS':        'Consumer',
  'VOLTAS.NS':     'Consumer',
  'NYKAA.NS':      'Consumer',

  // ── Other ──────────────────────────────────────────────
  'INDIGOPNTS.NS': 'Other',
  'JYOTIRES.BO':   'Other',
  'PIIND.NS':      'Other',
}

export const SECTOR_BENCHMARK: Record<SectorKey, string> = {
  Banking:    '^NSEBANK',
  Finance:    'NIFTY_FIN_SERVICE.NS',
  Healthcare: '^CNXPHARMA',
  IT:         '^CNXIT',
  Growth:     '^CRSLDX',
  Tech:       '^NDX',
  Smallcap:   'NIFTY_MIDCAP_100.NS',
  Equity:     '^NSEI',
  Consumer:   '^CNXFMCG',
  Other:      '^NSEI',
}

export const BENCHMARK_LABEL: Record<string, string> = {
  '^NSEBANK':   'Nifty Bank',
  'NIFTY_FIN_SERVICE.NS': 'Nifty Fin Svc',
  '^CNXPHARMA':           'Nifty Pharma',
  '^CNXIT':     'Nifty IT',
  '^CRSLDX':    'Nifty 500',
  '^NDX':       'NASDAQ 100',
  'NIFTY_MIDCAP_100.NS': 'Nifty Mid 100',
  '^CNXFMCG':   'Nifty FMCG',
  '^NSEI':      'Nifty 50',
}

export function getSectorForHolding(yf_symbol: string): SectorKey {
  return SYMBOL_SECTOR[yf_symbol] ?? 'Other'
}

// ── Market Cap ─────────────────────────────────────────────────────────────────

export type MarketCapKey = 'Large Cap' | 'Mid Cap' | 'Small Cap' | 'US Stocks'

export const MARKET_CAP_COLOR: Record<MarketCapKey, string> = {
  'Large Cap':  '#3b82f6',
  'Mid Cap':    '#8b5cf6',
  'Small Cap':  '#f97316',
  'US Stocks':  '#38bdf8',
}

const SYMBOL_MARKET_CAP: Record<string, MarketCapKey> = {
  // ── Large Cap ─────────────────────────────────────────────
  'ICICIBANK.NS':  'Large Cap',
  'AXISBANK.NS':   'Large Cap',
  'SBIN.NS':       'Large Cap',
  'BAJFINANCE.NS': 'Large Cap',
  'HDFCLIFE.NS':   'Large Cap',
  'SBILIFE.NS':    'Large Cap',
  'HDFCAMC.NS':    'Large Cap',
  'APOLLOHOSP.NS': 'Large Cap',
  'ETERNAL.NS':    'Large Cap',
  'JIOFIN.NS':     'Large Cap',
  'MAXHEALTH.NS':  'Large Cap',
  'FORTIS.NS':     'Large Cap',
  'HEALTHY.NS':    'Large Cap',
  'ITBEES.NS':     'Large Cap',
  '0P0001784G.BO': 'Large Cap',  // Tata Digital India Dir Gr
  '0P0000XVXV.BO': 'Large Cap',  // Aditya BSL Digital India Dir Gr
  '0P0000XW2T.BO': 'Large Cap',  // DSP ELSS Tax Saver Dir Gr
  '0P00017844.BO': 'Large Cap',  // Mirae Asset ELSS Tax Saver Dir Gr
  '0P0000YWL1.BO': 'Large Cap',  // Parag Parikh Long Term Equity Dir Gr
  'HDFCBANK.NS':   'Large Cap',
  'KOTAKBANK.NS':  'Large Cap',
  'BANKBEES.NS':   'Large Cap',
  'NIFTYBEES.NS':  'Large Cap',
  'INDUSINDBK.NS': 'Large Cap',
  'BANKBARODA.NS': 'Large Cap',
  'CANBK.NS':      'Large Cap',
  'PNB.NS':        'Large Cap',
  'LICI.NS':       'Large Cap',
  'BAJAJFINSV.NS': 'Large Cap',
  'DIVISLAB.NS':   'Large Cap',
  'ZYDUSLIFE.NS':  'Large Cap',
  'INFY.NS':       'Large Cap',
  'TCS.NS':        'Large Cap',
  'HINDUNILVR.NS': 'Large Cap',
  'ASIANPAINT.NS': 'Large Cap',
  'DMART.NS':      'Large Cap',
  'RELIANCE.NS':   'Large Cap',
  'ITC.NS':        'Large Cap',
  'HAL.NS':        'Large Cap',
  'HAVELLS.NS':    'Large Cap',
  'MARICO.NS':     'Large Cap',

  // ── Mid Cap ────────────────────────────────────────────────
  'IDFCFIRSTB.NS': 'Mid Cap',
  'MAHABANK.NS':   'Mid Cap',
  'FEDERALBNK.NS': 'Mid Cap',
  'SBICARD.NS':    'Mid Cap',
  'ANGELONE.NS':   'Mid Cap',
  'CDSL.NS':       'Mid Cap',
  'NAM-INDIA.NS':  'Mid Cap',
  'NUVAMA.NS':     'Mid Cap',
  'BSE.NS':        'Mid Cap',
  'CAMS.NS':       'Mid Cap',
  'AAVAS.NS':      'Mid Cap',
  'APTUS.NS':      'Mid Cap',
  'LALPATHLAB.NS': 'Mid Cap',
  'NH.NS':         'Mid Cap',
  'MEDANTA.NS':    'Mid Cap',
  'AFFLE.NS':      'Mid Cap',
  'SWIGGY.NS':     'Mid Cap',
  'INDIGOPNTS.NS': 'Mid Cap',
  'PIIND.NS':      'Mid Cap',
  'BANDHANBNK.NS': 'Mid Cap',
  'AUBANK.NS':     'Mid Cap',
  'CUB.NS':        'Mid Cap',
  'MANAPPURAM.NS': 'Mid Cap',
  'M&MFIN.NS':     'Mid Cap',
  'ABSLAMC.NS':    'Mid Cap',
  'POLICYBZR.NS':  'Mid Cap',
  'PAYTM.NS':      'Mid Cap',
  'GLAND.NS':      'Mid Cap',
  'ZYDUSWELL.NS':  'Mid Cap',
  'KPITTECH.NS':   'Mid Cap',
  'TATAELXSI.NS':  'Mid Cap',
  'HAPPSTMNDS.NS': 'Mid Cap',
  'EMAMILTD.NS':   'Mid Cap',
  'PAGEIND.NS':    'Mid Cap',
  'BERGEPAINT.NS': 'Mid Cap',
  'ASTRAL.NS':     'Mid Cap',
  'WHIRLPOOL.NS':  'Mid Cap',
  'TATAINVEST.NS': 'Mid Cap',
  'MANYAVAR.NS':   'Mid Cap',
  'VOLTAS.NS':     'Mid Cap',
  'INDIAMART.NS':  'Mid Cap',
  'PVRINOX.NS':    'Mid Cap',
  'NYKAA.NS':      'Mid Cap',

  // ── Small Cap ─────────────────────────────────────────────
  'ARMANFIN.NS':   'Small Cap',
  'SUPRIYA.NS':    'Small Cap',
  'YATHARTH.NS':   'Small Cap',
  'DSSL.NS':       'Small Cap',
  'NETWEB.NS':     'Small Cap',
  'RATEGAIN.NS':   'Small Cap',
  'JYOTIRES.BO':   'Small Cap',
  'WEALTH.NS':     'Small Cap',
  'EQUITASBNK.NS': 'Small Cap',
  'CSBBANK.NS':    'Small Cap',
  'UJJIVANSFB.NS': 'Small Cap',
  'ESAFSFB.NS':    'Small Cap',
  '5PAISA.NS':     'Small Cap',
  'SAMMAANCAP.NS': 'Small Cap',
  'AMRUTANJAN.NS': 'Small Cap',
  'LAXMIMACH.NS':  'Small Cap',
  'VGUARD.NS':     'Small Cap',
  'SYMPHONY.NS':   'Small Cap',
  'ORIENTELEC.NS': 'Small Cap',
  'TTKPRESTIG.NS': 'Small Cap',
  'IBREALEST.NS':  'Small Cap',
  'TARSONS.NS':    'Small Cap',
  'GREENPANEL.NS': 'Small Cap',
  'FINEORG.NS':    'Small Cap',
  'DELTACORP.NS':  'Small Cap',
  'DREAMFOLKS.NS': 'Small Cap',
  'EASEMYTRIP.NS': 'Small Cap',
  'RAJESHEXPO.NS': 'Small Cap',
  '0P0000XVFY.BO': 'Small Cap',  // Nippon India Small Cap Dir Gr
  '0P0000XVAA.BO': 'Small Cap',  // HDFC Small Cap Dir Gr
  '0P00011MAX.BO': 'Small Cap',  // Axis Small Cap Fund Dir Gr
  '0P0000XVJR.BO': 'Small Cap',  // SBI Contra Dir Gr
  '0P0001EUZZ.BO': 'Small Cap',  // Tata Small Cap Fund Dir Gr
  '0P0001F5O4.BO': 'Small Cap',  // Bank of India Small Cap Dir Gr
  '0P0000XW24.BO': 'Small Cap',  // DSP Small Cap Dir Gr

  // ── US Stocks (direct + India-listed US-tracking) ─────────
  'META': 'US Stocks', 'AMZN': 'US Stocks', 'AAPL': 'US Stocks',
  'MSFT': 'US Stocks', 'GOOGL':'US Stocks', 'TSLA': 'US Stocks',
  'ADBE': 'US Stocks', 'PATH': 'US Stocks', 'NVDA': 'US Stocks',
  'SMCI': 'US Stocks', 'COIN': 'US Stocks', 'PLTR': 'US Stocks',
  'SMH':  'US Stocks', 'TSM':  'US Stocks', 'CRWD': 'US Stocks',
  'PANW': 'US Stocks', 'NFLX': 'US Stocks', 'AVGO': 'US Stocks',
  'DASH': 'US Stocks', 'ASML': 'US Stocks', 'MELI': 'US Stocks',
  'IREN': 'US Stocks', 'IONQ': 'US Stocks', 'NBIS': 'US Stocks',
  'NOW':  'US Stocks',
  'INTC': 'US Stocks',
  'SOUN': 'US Stocks',
  'FIG':  'US Stocks',
  'MON100.NS':     'US Stocks',  // Motilal Oswal NASDAQ 100 ETF
  'MAFANG.NS':     'US Stocks',  // Mirae Asset NYSE FANG+ ETF
  '0P0001JMZB.BO': 'US Stocks',  // Motilal Oswal S&P 500 Index Dir Gr
  '0P0001NCLP.BO': 'US Stocks',  // ICICI Pru NASDAQ 100 Index Dir Gr
}

export function getMarketCapForHolding(yf_symbol: string): MarketCapKey {
  return SYMBOL_MARKET_CAP[yf_symbol] ?? 'Mid Cap'
}
