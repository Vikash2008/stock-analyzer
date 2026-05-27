export type SectorKey =
  | 'Banking' | 'Finance' | 'Healthcare' | 'IT'
  | 'Growth'  | 'Tech'    | 'Smallcap'   | 'Equity' | 'Other'

export const SECTOR_COLOR: Record<SectorKey, string> = {
  Banking:    '#3b82f6',
  Finance:    '#8b5cf6',
  Healthcare: '#22c55e',
  IT:         '#06b6d4',
  Growth:     '#f97316',
  Tech:       '#38bdf8',
  Smallcap:   '#f59e0b',
  Equity:     '#10b981',
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

  // ── IT ─────────────────────────────────────────────────
  'ITBEES.NS':     'IT',
  'AFFLE.NS':      'IT',
  '0P0001784G.BO': 'IT',   // Tata Digital India Dir Gr
  '0P0000XVXV.BO': 'IT',   // Aditya BSL Digital India Dir Gr

  // ── Growth ─────────────────────────────────────────────
  'ETERNAL.NS':    'Growth',
  'SWIGGY.NS':     'Growth',
  'RATEGAIN.NS':   'Growth',
  'DSSL.NS':       'Growth',
  'NETWEB.NS':     'Growth',

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

  // ── Equity (diversified/ELSS MFs) ──────────────────────
  '0P0000XW2T.BO': 'Equity',   // DSP ELSS Tax Saver Dir Gr
  '0P00017844.BO': 'Equity',   // Mirae Asset ELSS Tax Saver Dir Gr
  '0P0000YWL1.BO': 'Equity',   // Parag Parikh Long Term Equity Direct Growth

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
  Smallcap:   '^NSMCAP250',
  Equity:     '^NSEI',
  Other:      '^NSEI',
}

export const BENCHMARK_LABEL: Record<string, string> = {
  '^NSEBANK':   'Nifty Bank',
  'NIFTY_FIN_SERVICE.NS': 'Nifty Fin Svc',
  '^CNXPHARMA':           'Nifty Pharma',
  '^CNXIT':     'Nifty IT',
  '^CRSLDX':    'Nifty 500',
  '^NDX':       'NASDAQ 100',
  '^NSMCAP250': 'Nifty SC 250',
  '^NSEI':      'Nifty 50',
}

export function getSectorForHolding(yf_symbol: string): SectorKey {
  return SYMBOL_SECTOR[yf_symbol] ?? 'Other'
}
