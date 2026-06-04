export interface SectionConfig {
  id:          string
  emoji:       string
  label:       string
  description: string
  query:       { indian: string; us: string }
  color: {
    bg:         string
    border:     string
    accentHex:  string
    btnSolid:   string
    btnOutline: string
  }
}

export const SECTIONS: SectionConfig[] = [
  {
    id:          'business',
    emoji:       '🏢',
    label:       'Business Overview & Moat',
    description: 'Revenue model, competitive moat, key products',
    color: {
      bg:         'bg-blue-100',
      border:     'border-blue-300',
      accentHex:  '#1d4ed8',
      btnSolid:   'bg-blue-700 text-white shadow-sm',
      btnOutline: 'bg-blue-100 text-blue-800 border border-blue-300',
    },
    query: {
      indian: `Explain {name}'s core business model and how it makes money. Cover: main revenue streams and their mix (%), key products or services, primary customer segments, and geographic footprint. Then assess the competitive moat — is it brand, cost structure, switching costs, network effects, regulatory licence, or IP? Include current market share estimates and recent strategic direction (last 12 months). Use a table for revenue segment mix if available.`,
      us:     `Explain {name}'s core business model and how it makes money. Cover: main revenue streams and their mix (%), key products or services, primary customer segments, and global geographic footprint. Then assess the competitive moat — is it brand, cost structure, switching costs, network effects, regulatory licence, or IP? Include current market share estimates, recent strategic direction (last 12 months), and any key platform or ecosystem advantages. Use a table for revenue segment mix if available.`,
    },
  },
  {
    id:          'industry',
    emoji:       '🌐',
    label:       'Industry Outlook & Macro',
    description: 'Sector tailwinds, TAM, regulatory environment',
    color: {
      bg:         'bg-sky-100',
      border:     'border-sky-300',
      accentHex:  '#0284c7',
      btnSolid:   'bg-sky-600 text-white shadow-sm',
      btnOutline: 'bg-sky-100 text-sky-700 border border-sky-300',
    },
    query: {
      indian: `What is the 3-5 year outlook for the industry {name} ({symbol}) operates in? Cover: total addressable market size and projected CAGR, key structural tailwinds, headwinds or disruption risks, India-specific regulatory environment (SEBI, RBI, sector regulator), and how macro factors (interest rates, inflation, INR/USD) affect this sector. Name 2-3 trends that will define the sector over the next 3 years.`,
      us:     `What is the 3-5 year outlook for the industry {name} ({symbol}) operates in? Cover: total addressable market size and projected CAGR, key structural tailwinds, headwinds or disruption risks, US/global regulatory environment (FTC, SEC, sector-specific), and how macro factors (Fed rates, USD strength, inflation) affect this sector. Name 2-3 trends that will define the sector over the next 3 years.`,
    },
  },
  {
    id:          'results',
    emoji:       '📊',
    label:       'Latest Earnings & Guidance',
    description: 'Most recent quarter — numbers, guidance, highlights',
    color: {
      bg:         'bg-teal-100',
      border:     'border-teal-300',
      accentHex:  '#0d9488',
      btnSolid:   'bg-teal-600 text-white shadow-sm',
      btnOutline: 'bg-teal-100 text-teal-700 border border-teal-300',
    },
    query: {
      indian: `{name} {symbol} latest quarter earnings results: revenue PAT NIM margins EPS YoY QoQ segment performance management guidance key risks analyst verdict`,
      us:     `Summarize {name}'s ({symbol}) most recent quarterly earnings (state the quarter). Include: revenue (actual vs analyst estimate and YoY growth), net income, operating margin, EPS (actual vs estimate), segment performance breakdown, management guidance for next quarter and full year, and notable analyst reactions post-earnings. Flag any major beats, misses, or guidance cuts. Use a table for the key metrics.`,
    },
  },
  {
    id:          'valuation',
    emoji:       '⚖️',
    label:       'Valuation Metrics',
    description: 'PE vs peers vs history, bull/base/bear range',
    color: {
      bg:         'bg-indigo-100',
      border:     'border-indigo-300',
      accentHex:  '#4f46e5',
      btnSolid:   'bg-indigo-600 text-white shadow-sm',
      btnOutline: 'bg-indigo-100 text-indigo-700 border border-indigo-300',
    },
    query: {
      indian: `Analyze {name}'s ({symbol}) current valuation on the NSE/BSE. Provide: trailing PE, forward PE, Price/Book, EV/EBITDA, and Price/Sales — each compared against (1) its own 5-year historical average, (2) sector median for Indian peers, and (3) Nifty 50 benchmark. Is the stock at a premium or discount and why? Provide a bull/base/bear target price range with the key assumption driving each scenario.`,
      us:     `Analyze {name}'s ({symbol}) current valuation. Provide: trailing PE, forward PE, Price/Book, EV/EBITDA, EV/Revenue, and PEG ratio — each compared against (1) its own 5-year historical average, (2) direct sector peers, and (3) S&P 500 median. Is the stock at a premium or discount and why? Provide a bull/base/bear target price range (12-month) with the key assumption driving each scenario.`,
    },
  },
  {
    id:          'peers',
    emoji:       '🔬',
    label:       'Peer Comparison Matrix',
    description: '4–5 direct competitors across key metrics',
    color: {
      bg:         'bg-cyan-100',
      border:     'border-cyan-300',
      accentHex:  '#0891b2',
      btnSolid:   'bg-cyan-600 text-white shadow-sm',
      btnOutline: 'bg-cyan-100 text-cyan-700 border border-cyan-300',
    },
    query: {
      indian: `Create a peer comparison table for {name} ({symbol}) vs its 4-5 closest Indian-listed competitors. Table columns: Company | MCap (₹Cr) | Rev Growth 1Y | Operating Margin | PE (TTM) | ROE | Debt/Equity | Div Yield. Below the table, write 3-4 bullet points summarizing where {name} leads, where it lags, and the single most important differentiator vs the peer group.`,
      us:     `Create a peer comparison table for {name} ({symbol}) vs its 4-5 closest competitors. Table columns: Company | MCap ($B) | Rev Growth 1Y | Operating Margin | PE (TTM) | EV/EBITDA | ROE | Net Cash/Debt. Below the table, write 3-4 bullet points summarizing where {name} leads, where it lags, and the single most important differentiator vs the peer group.`,
    },
  },
  {
    id:          'financial',
    emoji:       '🏦',
    label:       'Financial Health & Trends',
    description: 'Balance sheet, FCF, margins over 3 years',
    color: {
      bg:         'bg-emerald-100',
      border:     'border-emerald-300',
      accentHex:  '#059669',
      btnSolid:   'bg-emerald-600 text-white shadow-sm',
      btnOutline: 'bg-emerald-100 text-emerald-700 border border-emerald-300',
    },
    query: {
      indian: `Analyze {name}'s financial health and trends over the last 3 years. Cover: revenue CAGR, gross and operating margin trajectory, net profit CAGR, free cash flow (FCF) generation and FCF margin, debt-to-equity trend, interest coverage ratio, working capital days (debtor/inventory/creditor), and return on capital employed (ROCE) trend. Flag any deterioration or improvement. Use a 3-year trend table for key metrics.`,
      us:     `Analyze {name}'s financial health and trends over the last 3 years. Cover: revenue CAGR, gross and operating margin trajectory, net income CAGR, free cash flow generation and FCF yield, net debt or net cash position, debt-to-equity trend, interest coverage ratio, and return on equity (ROE) and return on invested capital (ROIC) trends. Flag any deterioration or improvement. Use a 3-year trend table for key metrics.`,
    },
  },
  {
    id:          'news',
    emoji:       '🚨',
    label:       'News, Sentiment & Red Flags',
    description: 'Last 90 days — events, risks, insider activity',
    color: {
      bg:         'bg-green-100',
      border:     'border-green-300',
      accentHex:  '#16a34a',
      btnSolid:   'bg-green-600 text-white shadow-sm',
      btnOutline: 'bg-green-100 text-green-700 border border-green-300',
    },
    query: {
      indian: `Summarize the most significant news and events for {name} ({symbol}) over the last 90 days. Cover: major corporate announcements, management changes, SEBI/regulatory actions, promoter buying or pledging activity, analyst rating changes (upgrades/downgrades), and any emerging risks or red flags (litigation, governance, accounting concerns, order cancellations). Rate overall sentiment as Positive, Neutral, Cautious, or Negative with a one-line reason.`,
      us:     `Summarize the most significant news and events for {name} ({symbol}) over the last 90 days. Cover: major corporate announcements, management changes, SEC/regulatory actions, insider buying or selling activity, analyst rating changes (upgrades/downgrades with target price moves), and any emerging risks or red flags (litigation, governance, accounting concerns, product recalls, antitrust). Rate overall sentiment as Positive, Neutral, Cautious, or Negative with a one-line reason.`,
    },
  },
  {
    id:          'technical',
    emoji:       '📈',
    label:       'Technical Analysis Setup',
    description: 'Trend, support/resistance, RSI, moving averages',
    color: {
      bg:         'bg-blue-50',
      border:     'border-blue-200',
      accentHex:  '#2563eb',
      btnSolid:   'bg-blue-600 text-white shadow-sm',
      btnOutline: 'bg-blue-50 text-blue-700 border border-blue-200',
    },
    query: {
      indian: `Provide a technical analysis overview for {name} ({symbol} on NSE). Include: current trend (uptrend/downtrend/sideways with timeframe), key support levels (2-3), key resistance levels (2-3), 50-day and 200-day moving average positioning (price vs MA, golden or death cross status), RSI (14-day) reading and interpretation, recent volume trend, and your overall setup assessment — favorable entry, exit, or wait zone? State the invalidation level for any bullish thesis.`,
      us:     `Provide a technical analysis overview for {name} ({symbol}). Include: current trend (uptrend/downtrend/sideways with timeframe), key support levels (2-3), key resistance levels (2-3), 50-day and 200-day moving average positioning (price vs MA, golden or death cross status), RSI (14-day) reading and interpretation, recent volume trend and any notable patterns (breakout, consolidation, distribution), and your overall setup assessment — favorable entry, exit, or wait. State the invalidation level for any bullish thesis.`,
    },
  },
]

function buildQuery(template: string, name: string, symbol = ''): string {
  return template.replace(/\{name\}/g, name).replace(/\{symbol\}/g, symbol)
}

const FORMAT_SUFFIX = '\n\nFormatting rules (strict): use markdown tables with bold column headers for any structured data; use ## bold section headers to organize content; bullet points for lists, numbered lists for rankings; lead every data point with the exact figure before explanation; no preamble ("Here is...", "Based on..."); crisp and dense — numbers over words; for Indian stocks use ₹ crores as the unit, for US stocks use $ millions or billions; round all figures to 1 decimal place.'

export function buildGeminiPrompt(
  name: string,
  sectionId: string,
  isIndian: boolean,
  yf_symbol = '',
  apiUrl = ''
): string {
  const section = SECTIONS.find(s => s.id === sectionId)
  if (!section) return name
  const symbol = yf_symbol.replace(/\.(NS|BO)$/i, '')

  if (sectionId === 'results' && isIndian && apiUrl) {
    const filingUrl = `${apiUrl}/api/filing/${symbol}/text`
    return `The following URL contains the plain text of ${name}'s latest quarterly earnings filing:\n${filingUrl}\n\nAnalyze this filing as a buy-side analyst — no preamble, output directly:\n- Executive summary (3 lines)\n- Quarter scorecard table: Revenue, Net Profit, EPS, Key Margins — with YoY% and QoQ% columns\n- Segment performance table\n- What went well (exact numbers)\n- What was weak / concerning (exact numbers)\n- Management guidance\n- Key risks\n- Verdict: Very Strong / Strong / Mixed / Weak${FORMAT_SUFFIX}`
  }

  const template = isIndian ? section.query.indian : section.query.us
  return buildQuery(template, name, symbol) + FORMAT_SUFFIX
}
