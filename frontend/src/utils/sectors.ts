export type SectorKey =
  | 'Banking' | 'Finance' | 'Healthcare' | 'IT'
  | 'Growth'  | 'Tech'    | 'Smallcap'   | 'Equity' | 'Consumer' | 'Global' | 'Other'

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
  Global:     '#6366f1',  // S&P 500 US-themed MFs
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
  // MF — Banking & Finance sector funds
  '0P00011MKZ.BO': 'Finance',  // ABSL Banking & Finance Dir Gr
  '0P00015HLN.BO': 'Finance',  // SBI Banking & Financial Services Dir Gr

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
  // MF — Pharma sector funds
  '0P0000XVFK.BO': 'Healthcare', // Nippon India Pharma Dir Gr

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
  // MF — IT/Technology sector funds
  '0P0000XUZ6.BO': 'IT',   // ICICI Pru Technology Dir Gr
  '0P0000XW5R.BO': 'IT',   // Franklin India Technology Dir Gr

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

  // ── Tech (direct US stocks + India-listed NASDAQ-tracking) ─────
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
  '0P0001NCLP.BO': 'Tech',  // ICICI Pru NASDAQ 100 Index Dir Gr

  // ── Global (S&P 500 US-themed MFs) ─────────────────────
  '0P0001JMZB.BO': 'Global', // Motilal Oswal S&P 500 Index Dir Gr
  '0P0000XUZC.BO': 'Global', // ICICI Pru US Bluechip Equity Dir Gr
  '0P0000XW5X.BO': 'Global', // Franklin India Feeder Franklin US Opp Dir Gr
  '0P00016GW1.BO': 'Global', // Nippon India US Equity Opp Dir Gr

  // ── Smallcap (small cap MFs + stocks, and mid cap MFs) ────────
  // Small cap stocks
  'DELTACORP.NS':  'Smallcap',
  'TARSONS.NS':    'Smallcap',
  'GREENPANEL.NS': 'Smallcap',
  'ORIENTELEC.NS': 'Smallcap',
  'PVRINOX.NS':    'Smallcap',
  // Small cap MFs (open)
  '0P0000XVFY.BO': 'Smallcap', // Nippon India Small Cap Dir Gr
  '0P0000XVAA.BO': 'Smallcap', // HDFC Small Cap Dir Gr
  '0P0001EUZZ.BO': 'Smallcap', // Tata Small Cap Fund Dir Gr
  '0P0001F5O4.BO': 'Smallcap', // Bank of India Small Cap Dir Gr
  '0P0000XW24.BO': 'Smallcap', // DSP Small Cap Dir Gr
  // Small cap MFs (closed)
  '0P00011MAX.BO': 'Smallcap', // Axis Small Cap Fund Dir Gr
  '0P0000XV6I.BO': 'Smallcap', // Kotak Small Cap Dir Gr
  '0P0000XVY6.BO': 'Smallcap', // ABSL Small Cap Dir Gr
  '0P0000XW4J.BO': 'Smallcap', // Quant Small Cap Dir Gr
  '0P0001FKEE.BO': 'Smallcap', // Canara Robeco Small Cap Dir Gr
  // Mid cap MFs (benchmark NIFTY_MIDCAP_100 same as Smallcap)
  '0P0000XV82.BO': 'Smallcap', // HSBC/L&T Midcap Dir Gr
  '0P0000XVUH.BO': 'Smallcap', // Axis Mid Cap Dir Gr
  '0P0000XW2M.BO': 'Smallcap', // DSP Midcap Dir Gr
  '0P0000XW8F.BO': 'Smallcap', // HDFC Midcap Opp Dir Gr
  '0P00011MAT.BO': 'Smallcap', // PGIM India Midcap Opp Dir Gr
  '0P0000XV5R.BO': 'Smallcap', // Kotak Emerging Equity Dir Gr
  '0P0000XW5J.BO': 'Smallcap', // Franklin India Prima (Mid/Small) Dir Gr

  // ── Equity (diversified/ELSS/flexicap/large cap MFs) ──────────
  // Open MFs (already classified)
  '0P0000XW2T.BO': 'Equity',   // DSP ELSS Tax Saver Dir Gr
  '0P00017844.BO': 'Equity',   // Mirae Asset ELSS Tax Saver Dir Gr
  '0P0000YWL1.BO': 'Equity',   // Parag Parikh Long Term Equity Dir Gr
  // Contra fund (benchmark ^NSEI, not small cap)
  '0P0000XVJR.BO': 'Equity',   // SBI Contra Dir Gr
  // Large cap / bluechip MFs
  '0P0000XVA0.BO': 'Equity',   // Mirae Asset Large Cap Dir Gr
  '0P0000XVTL.BO': 'Equity',   // Axis Bluechip Dir Gr
  '0P0000XVJQ.BO': 'Equity',   // SBI Bluechip Dir Gr
  '0P0000XW0O.BO': 'Equity',   // Canara Robeco Bluechip Dir Gr
  '0P0000XWAT.BO': 'Equity',   // ICICI Pru Bluechip Dir Gr
  '0P0000XVYQ.BO': 'Equity',   // BNP Paribas Large Cap Dir Gr
  '0P0000XVE4.BO': 'Equity',   // Nippon India Index Nifty 50 Dir Gr
  '0P0000XW7T.BO': 'Equity',   // HDFC Index Nifty 50 Dir Gr
  // Flexicap / multi-cap / focused / contra MFs
  '0P00005V62.BO': 'Equity',   // ABSL Flexi Cap Dir Gr
  '0P0000XVWD.BO': 'Equity',   // ABSL Flexicap Dir Gr
  '0P0000XV6O.BO': 'Equity',   // Kotak Flexicap Dir Gr
  '0P0000XV5I.BO': 'Equity',   // Kotak Bluechip Dir Gr
  '0P0000XV5Q.BO': 'Equity',   // Kotak Contra Dir Gr
  '0P0000XVCR.BO': 'Equity',   // Sundaram Focused Dir Gr
  '0P0000XVJT.BO': 'Equity',   // SBI Focused Equity Dir Gr
  '0P0000XVTR.BO': 'Equity',   // Axis Focused Dir Gr
  '0P0000XVGR.BO': 'Equity',   // Invesco India Contra Dir Gr
  '0P0000XVGS.BO': 'Equity',   // Invesco India Large & Mid Cap Dir Gr
  '0P0000XVSO.BO': 'Equity',   // UTI Flexi Cap Dir Gr
  '0P0000XW00.BO': 'Equity',   // Canara Robeco Equity Diversified Dir Gr
  '0P00012ZRM.BO': 'Equity',   // Motilal Oswal Flexicap Dir Gr
  '0P0000XVOJ.BO': 'Equity',   // Tata Large & Mid Cap Dir Gr
  '0P0000XVM6.BO': 'Equity',   // Sundaram Large & Mid Cap Dir Gr
  '0P0000XV57.BO': 'Equity',   // Edelweiss Large & Mid Cap Dir Gr
  '0P0001CN9D.BO': 'Equity',   // Edelweiss Recently Listed IPO Dir Gr
  // ELSS / Tax Saver MFs
  '0P0000XVYC.BO': 'Equity',   // ABSL ELSS Tax Relief 96 Dir Gr
  '0P0000XV6Q.BO': 'Equity',   // Kotak ELSS Tax Saver Dir Gr
  '0P0000XVCZ.BO': 'Equity',   // Sundaram Tax Saver Dir Gr
  '0P0000XVG0.BO': 'Equity',   // Nippon India ELSS Tax Saver Dir Gr
  '0P0000XVSQ.BO': 'Equity',   // UTI Long Term Equity Dir Gr
  '0P0000XVU7.BO': 'Equity',   // Axis Long Term Equity Dir Gr
  '0P0000XW04.BO': 'Equity',   // Canara Robeco Equity Tax Saver Dir Gr
  '0P0000XW9U.BO': 'Equity',   // L&T Tax Saver Dir Gr
  '0P000159Q0.BO': 'Equity',   // Motilal Oswal ELSS Tax Saver Dir Gr

  // ── Consumer (FMCG + Consumer Durables) ──────────────────────
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
  'NIFTYBEES.NS':  'Other',    // Nifty 50 BeES ETF (same ^NSEI benchmark as Other)
  'INDIGOPNTS.NS': 'Other',
  'JYOTIRES.BO':   'Other',
  'PIIND.NS':      'Other',
  // MF — debt/liquid funds (not meaningful to benchmark vs equity index)
  '0P0000XVUB.BO': 'Other',   // Axis Liquid Dir Gr
  '0P0000XVY0.BO': 'Other',   // ABSL Short Term Dir Gr
  // MF — international / infrastructure (no good Indian benchmark)
  '0P0000XV5G.BO': 'Other',   // Edelweiss Greater China Equity Off-shore Dir Gr
  '0P0000XW4O.BO': 'Other',   // Quant Infrastructure Dir Gr
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
  Global:     '^GSPC',
  Other:      '^NSEI',
}

export const BENCHMARK_LABEL: Record<string, string> = {
  '^NSEBANK':              'Nifty Bank',
  'NIFTY_FIN_SERVICE.NS':  'Nifty Fin Svc',
  '^CNXPHARMA':            'Nifty Pharma',
  '^CNXIT':                'Nifty IT',
  '^CRSLDX':               'Nifty 500',
  '^NDX':                  'NASDAQ 100',
  'NIFTY_MIDCAP_100.NS':   'Nifty Mid 100',
  '^CNXFMCG':              'Nifty FMCG',
  '^NSEI':                 'Nifty 50',
  '^GSPC':                 'S&P 500',
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
  // MF — large cap / bluechip / index / flexicap / focused / ELSS / contra
  '0P0000XVA0.BO': 'Large Cap',  // Mirae Asset Large Cap Dir Gr
  '0P0000XVTL.BO': 'Large Cap',  // Axis Bluechip Dir Gr
  '0P0000XVJQ.BO': 'Large Cap',  // SBI Bluechip Dir Gr
  '0P0000XW0O.BO': 'Large Cap',  // Canara Robeco Bluechip Dir Gr
  '0P0000XWAT.BO': 'Large Cap',  // ICICI Pru Bluechip Dir Gr
  '0P0000XVYQ.BO': 'Large Cap',  // BNP Paribas Large Cap Dir Gr
  '0P0000XVE4.BO': 'Large Cap',  // Nippon India Index Nifty 50 Dir Gr
  '0P0000XW7T.BO': 'Large Cap',  // HDFC Index Nifty 50 Dir Gr
  '0P00005V62.BO': 'Large Cap',  // ABSL Flexi Cap Dir Gr
  '0P0000XVWD.BO': 'Large Cap',  // ABSL Flexicap Dir Gr
  '0P0000XV6O.BO': 'Large Cap',  // Kotak Flexicap Dir Gr
  '0P0000XV5I.BO': 'Large Cap',  // Kotak Bluechip Dir Gr
  '0P0000XV5Q.BO': 'Large Cap',  // Kotak Contra Dir Gr
  '0P0000XVCR.BO': 'Large Cap',  // Sundaram Focused Dir Gr
  '0P0000XVJT.BO': 'Large Cap',  // SBI Focused Equity Dir Gr
  '0P0000XVTR.BO': 'Large Cap',  // Axis Focused Dir Gr
  '0P0000XVGR.BO': 'Large Cap',  // Invesco India Contra Dir Gr
  '0P0000XVGS.BO': 'Large Cap',  // Invesco India Large & Mid Cap Dir Gr
  '0P0000XVSO.BO': 'Large Cap',  // UTI Flexi Cap Dir Gr
  '0P0000XW00.BO': 'Large Cap',  // Canara Robeco Equity Diversified Dir Gr
  '0P00012ZRM.BO': 'Large Cap',  // Motilal Oswal Flexicap Dir Gr
  '0P0000XVOJ.BO': 'Large Cap',  // Tata Large & Mid Cap Dir Gr
  '0P0000XVM6.BO': 'Large Cap',  // Sundaram Large & Mid Cap Dir Gr
  '0P0000XV57.BO': 'Large Cap',  // Edelweiss Large & Mid Cap Dir Gr
  '0P0001CN9D.BO': 'Large Cap',  // Edelweiss Recently Listed IPO Dir Gr
  '0P0000XVYC.BO': 'Large Cap',  // ABSL ELSS Tax Relief 96 Dir Gr
  '0P0000XV6Q.BO': 'Large Cap',  // Kotak ELSS Tax Saver Dir Gr
  '0P0000XVCZ.BO': 'Large Cap',  // Sundaram Tax Saver Dir Gr
  '0P0000XVG0.BO': 'Large Cap',  // Nippon India ELSS Tax Saver Dir Gr
  '0P0000XVSQ.BO': 'Large Cap',  // UTI Long Term Equity Dir Gr
  '0P0000XVU7.BO': 'Large Cap',  // Axis Long Term Equity Dir Gr
  '0P0000XW04.BO': 'Large Cap',  // Canara Robeco Equity Tax Saver Dir Gr
  '0P0000XW9U.BO': 'Large Cap',  // L&T Tax Saver Dir Gr
  '0P000159Q0.BO': 'Large Cap',  // Motilal Oswal ELSS Tax Saver Dir Gr
  '0P0000XVJR.BO': 'Large Cap',  // SBI Contra Dir Gr
  // MF — sector funds (large cap oriented)
  '0P0000XUZ6.BO': 'Large Cap',  // ICICI Pru Technology Dir Gr
  '0P0000XW5R.BO': 'Large Cap',  // Franklin India Technology Dir Gr
  '0P0000XVFK.BO': 'Large Cap',  // Nippon India Pharma Dir Gr
  '0P00011MKZ.BO': 'Large Cap',  // ABSL Banking & Finance Dir Gr
  '0P00015HLN.BO': 'Large Cap',  // SBI Banking & Financial Services Dir Gr

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
  // MF — mid cap funds
  '0P0000XV82.BO': 'Mid Cap',   // HSBC/L&T Midcap Dir Gr
  '0P0000XVUH.BO': 'Mid Cap',   // Axis Mid Cap Dir Gr
  '0P0000XW2M.BO': 'Mid Cap',   // DSP Midcap Dir Gr
  '0P0000XW8F.BO': 'Mid Cap',   // HDFC Midcap Opp Dir Gr
  '0P00011MAT.BO': 'Mid Cap',   // PGIM India Midcap Opp Dir Gr
  '0P0000XV5R.BO': 'Mid Cap',   // Kotak Emerging Equity Dir Gr
  '0P0000XW5J.BO': 'Mid Cap',   // Franklin India Prima Dir Gr

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
  '0P0001EUZZ.BO': 'Small Cap',  // Tata Small Cap Fund Dir Gr
  '0P0001F5O4.BO': 'Small Cap',  // Bank of India Small Cap Dir Gr
  '0P0000XW24.BO': 'Small Cap',  // DSP Small Cap Dir Gr
  '0P0000XV6I.BO': 'Small Cap',  // Kotak Small Cap Dir Gr
  '0P0000XVY6.BO': 'Small Cap',  // ABSL Small Cap Dir Gr
  '0P0000XW4J.BO': 'Small Cap',  // Quant Small Cap Dir Gr
  '0P0001FKEE.BO': 'Small Cap',  // Canara Robeco Small Cap Dir Gr

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
  '0P0000XUZC.BO': 'US Stocks',  // ICICI Pru US Bluechip Equity Dir Gr
  '0P0000XW5X.BO': 'US Stocks',  // Franklin India Feeder Franklin US Opp Dir Gr
  '0P00016GW1.BO': 'US Stocks',  // Nippon India US Equity Opp Dir Gr
}

export function getMarketCapForHolding(yf_symbol: string): MarketCapKey {
  return SYMBOL_MARKET_CAP[yf_symbol] ?? 'Mid Cap'
}
