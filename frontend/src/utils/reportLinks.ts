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
      indian: `Explain {name}'s core business model and how it makes money. Cover: main revenue streams and their mix (%), key products or services, primary customer segments, and geographic footprint. Then assess the competitive moat — is it brand, cost structure, switching costs, network effects, regulatory licence, or IP? Include current market share estimates and recent strategic direction (last 12 months). Use a table for revenue segment mix if available. Also note: (1) promoter holding % and any recent changes; (2) top customer or geographic concentration if any single segment exceeds 15% of revenue; (3) any recent key management changes in the last 12 months.

Data requirement: Use the latest available annual report (FY2026 if filed, else FY2025), the most recent quarterly results, and the latest investor presentation. Do not use data from filings older than the most recently published one — search BSE/NSE and the company's IR page to confirm the latest filing available as of today.`,
      us:     `Explain {name}'s core business model and how it makes money. Cover: main revenue streams and their mix (%), key products or services, primary customer segments, and global geographic footprint. Then assess the competitive moat — is it brand, cost structure, switching costs, network effects, regulatory licence, or IP? Include current market share estimates, recent strategic direction (last 12 months), and any key platform or ecosystem advantages. Use a table for revenue segment mix if available. Also note: (1) whether founder-led or professionally managed and any recent C-suite changes; (2) top customer concentration risk if any single customer exceeds 10% of revenue; (3) platform lock-in or ecosystem dependency risks.

Data requirement: Use the latest available 10-K annual filing, most recent 10-Q, and any post-earnings investor presentations or earnings call transcripts. Search SEC EDGAR to confirm the most recently filed document available as of today — do not rely on data from older filings when newer ones exist.`,
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
      indian: `What is the 3-5 year outlook for the industry {name} ({symbol}) operates in? Cover: total addressable market size and projected CAGR, key structural tailwinds, headwinds or disruption risks, India-specific regulatory environment (SEBI, RBI, sector regulator), and how macro factors (interest rates, inflation, INR/USD) affect this sector. Name 2-3 trends that will define the sector over the next 3 years. Also cover: whether the sector is in early-growth, maturing, or consolidating phase; and competitive structure — fragmented or concentrated (estimate top-3 players' combined market share).

Data requirement: Prioritise the most recently published industry reports, government data (MCA, RBI, SEBI, sector-specific regulators), and analyst sector notes from 2025-2026. For any market-size or CAGR figure cited, state the publication year and source so the recency can be verified.`,
      us:     `What is the 3-5 year outlook for the industry {name} ({symbol}) operates in? Cover: total addressable market size and projected CAGR, key structural tailwinds, headwinds or disruption risks, US/global regulatory environment (FTC, SEC, sector-specific), and how macro factors (Fed rates, USD strength, inflation) affect this sector. Name 2-3 trends that will define the sector over the next 3 years. Also cover: whether the sector is in early-growth, maturing, or consolidating phase; and competitive structure — fragmented or concentrated (estimate top-3 players' combined market share).

Data requirement: Prioritise the most recently published industry reports, government data, and analyst sector notes from 2025-2026. For any market-size or CAGR figure cited, state the publication year and source so the recency can be verified.`,
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
      indian: `Summarize {name}'s ({symbol}) most recent quarterly results — state the exact quarter and fiscal year (e.g. Q3 FY25). Use the company's official BSE/NSE filing or earnings press release as the primary source; cite which filing you used.

Data requirement: Search BSE/NSE corporate announcements explicitly for the most recently published quarterly results as of today's date. If Q4 FY2026 or any newer quarter has been filed, use that — do not default to an older quarter when a newer filing is available.

## Metrics Scorecard
Table with columns: **Metric** | **Actual** | **Analyst Est.** | **YoY%** | **QoQ%**
Rows: Revenue (₹ Cr), EBITDA (₹ Cr), PAT (₹ Cr), EPS (diluted ₹), Gross Margin%, EBITDA Margin%, PAT Margin%
For banks/NBFCs: replace EBITDA with NIM%; add rows for GNPA%, NNPA%, PCR%

## Segment Performance
Table with columns: **Segment** | **Revenue (₹ Cr)** | **YoY%** | **Margin%**

## What Went Well
2–3 specific positives with exact figures and the period they relate to.

## What Was Weak or Concerning
2–3 specific negatives or misses with exact figures.

## Management Guidance
Next quarter and full-year outlook. Explicitly flag any changes vs previous guidance.

## Analyst Reactions
For each post-results change: Firm | Old Rating → New Rating | Old Target → New Target (₹) | Date

## Verdict
One line: Very Strong / Strong / Mixed / Weak — and the single most important reason.`,
      us:     `Summarize {name}'s ({symbol}) most recent quarterly earnings — state the exact quarter (e.g. Q2 FY2025 / fiscal Q3 2025). Use the company's SEC 10-Q or official earnings press release as the primary source; cite which filing you used.

Data requirement: Search SEC EDGAR and the company's IR page for the most recently filed 10-Q or earnings press release as of today's date. Do not default to an older quarter if a newer filing is available.

## Metrics Scorecard
Table with columns: **Metric** | **Actual** | **Analyst Est.** | **YoY%** | **QoQ%**
Rows: Revenue ($M), Operating Income ($M), Net Income ($M), EPS (diluted $), Gross Margin%, Operating Margin%, Net Margin%
Distinguish GAAP from non-GAAP figures where both are reported. For tech companies, include stock-based compensation as % of revenue.

## Segment Performance
Table with columns: **Segment** | **Revenue ($M)** | **YoY%** | **Margin%**

## What Went Well
2–3 specific positives with exact figures and the period they relate to.

## What Was Weak or Concerning
2–3 specific negatives or misses with exact figures.

## Management Guidance
Next quarter and full-year outlook. Explicitly flag any changes vs previous guidance.

## Analyst Reactions
For each post-results change: Firm | Old Rating → New Rating | Old Target → New Target ($) | Date

## Verdict
One line: Very Strong / Strong / Mixed / Weak — and the single most important reason.`,
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
      indian: `Analyze {name}'s ({symbol}) current valuation on the NSE/BSE. Provide: trailing PE, forward PE, Price/Book, EV/EBITDA, and Price/Sales — each compared against (1) its own 5-year historical average, (2) sector median for Indian peers, and (3) Nifty 50 benchmark. Ensure all multiples reference the same reporting period (state it explicitly). Is the stock at a premium or discount and why? Provide a bull/base/bear target price range (12-month) with the key assumption driving each scenario. State the current CMP and your base-case intrinsic value estimate using at least one method (PE-based target or earnings yield), with the implied upside/downside %.

Data requirement: Use the current live market price and the most recently available trailing/forward financials. If Q4 FY2026 or the latest annual results have been published, base all multiples on those figures — do not use FY2024 or older as the base when newer data is available.`,
      us:     `Analyze {name}'s ({symbol}) current valuation. Provide: trailing PE, forward PE, Price/Book, EV/EBITDA, EV/Revenue, and PEG ratio — each compared against (1) its own 5-year historical average, (2) direct sector peers, and (3) S&P 500 median. Ensure all multiples reference the same reporting period (state it explicitly). Is the stock at a premium or discount and why? Provide a bull/base/bear target price range (12-month) with the key assumption driving each scenario. State the current price and your base-case intrinsic value estimate using at least one method (DCF, PE-based, or EV/EBITDA comps), with the implied upside/downside %.

Data requirement: Use the current live market price and the most recently available trailing/forward financials. If the latest annual (10-K) or quarterly (10-Q) results have been published, base all multiples on those figures — do not use older filings when more recent data is available.`,
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
      indian: `Create a peer comparison table for {name} ({symbol}) vs its 4-5 closest Indian-listed competitors. Table columns: **Company** | **MCap (₹Cr)** | **Rev Growth 1Y** | **Operating Margin** | **PE (TTM)** | **ROE** | **Debt/Equity** | **Div Yield**. All figures must reference the same reporting period — state which period you are using. Below the table, write 3-4 bullet points summarizing where {name} leads, where it lags, and the single most important differentiator vs the peer group. Add one final bullet: which peer is gaining market share fastest and why, and which is losing ground.

Data requirement: Use the most recently reported figures for every company in the table — latest available quarterly or annual results as of today. Do not mix reporting periods across companies without explicitly noting it. Confirm the period label in the table header.`,
      us:     `Create a peer comparison table for {name} ({symbol}) vs its 4-5 closest competitors. Table columns: **Company** | **MCap ($B)** | **Rev Growth 1Y** | **Operating Margin** | **PE (TTM)** | **EV/EBITDA** | **ROIC** | **Net Cash/Debt**. All figures must reference the same reporting period — state which period you are using. Below the table, write 3-4 bullet points summarizing where {name} leads, where it lags, and the single most important differentiator vs the peer group. Add one final bullet: which peer is gaining market share fastest and why, and which is losing ground.

Data requirement: Use the most recently reported figures for every company in the table — latest available quarterly or annual results as of today. Do not mix reporting periods across companies without explicitly noting it. Confirm the period label in the table header.`,
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
      indian: `Analyze {name}'s financial health and trends over the most recent 3 fiscal years (use the latest available — if FY25 data is out, use FY23–FY25; do not default to older periods). Use the company's annual report or Screener.in as the primary source. Cover: revenue CAGR, gross and operating margin trajectory, net profit (PAT) CAGR, free cash flow (FCF) generation and FCF margin, debt-to-equity trend, interest coverage ratio, working capital days (debtor/inventory/creditor), return on capital employed (ROCE) trend, and capex as % of revenue (3-year trend). Flag if FCF materially diverges from PAT (signals accrual quality concerns). Use a 3-year trend table for key metrics.

Data requirement: If FY2026 annual results are published, use FY2024–FY2026 as the 3-year window. If only FY2025 is the latest, use FY2023–FY2025. Confirm which annual filing you are using as the most recent source — search BSE/NSE and Screener.in to verify the latest available annual report as of today.`,
      us:     `Analyze {name}'s financial health and trends over the most recent 3 fiscal years (use the latest available — if FY25 data is out, use FY23–FY25; do not default to older periods). Use SEC 10-K filings as the primary source. Cover: revenue CAGR, gross and operating margin trajectory, net income CAGR, free cash flow generation and FCF yield, net debt or net cash position, debt-to-equity trend, interest coverage ratio, return on equity (ROE) and return on invested capital (ROIC) trends, capex as % of revenue (3-year trend), and buyback yield (TTM). Flag if FCF materially diverges from net income (accrual quality concern). Use a 3-year trend table for key metrics.

Data requirement: If FY2026 annual results (10-K) are filed, use FY2024–FY2026 as the 3-year window. Search SEC EDGAR to confirm the most recently filed 10-K available as of today — do not use FY2023 or earlier as the endpoint when a newer 10-K exists.`,
    },
  },
  {
    id:          'news',
    emoji:       '🚨',
    label:       'News, Sentiment & Red Flags',
    description: 'Last 90 days — highlights, events, risks, insider activity',
    color: {
      bg:         'bg-green-100',
      border:     'border-green-300',
      accentHex:  '#16a34a',
      btnSolid:   'bg-green-600 text-white shadow-sm',
      btnOutline: 'bg-green-100 text-green-700 border border-green-300',
    },
    query: {
      indian: `Summarize {name} ({symbol}) over the last 90 days. Use BSE/NSE exchange announcements, company press releases, Economic Times Markets, and Moneycontrol as primary sources — do not use random blogs or unverified aggregators.

Data requirement: Search BSE/NSE corporate announcements first — these are the authoritative source for filings, board decisions, and regulatory disclosures. Prioritise items published in the 90-day window ending today; do not include events older than 90 days from today's date.

## Key Business Highlights (Last 3 Months)
Product launches, new partnerships, geographic expansions, major order wins or losses, capacity additions, joint ventures — with dates.

## Corporate & Regulatory Events
Major corporate announcements, management changes, SEBI or regulatory actions, promoter stake changes or pledging activity — with dates.

## Analyst Activity
For each rating change in the period: **Firm** | **Old Rating → New Rating** | **Old Target → New Target (₹)** | **Date**

## Red Flags
Any litigation, governance concerns, accounting irregularities, order cancellations, or significant insider selling worth monitoring.

## Sentiment Rating
Overall: Positive / Neutral / Cautious / Negative — one sentence reason.`,
      us:     `Summarize {name} ({symbol}) over the last 90 days. Use SEC filings, company press releases, Reuters, Bloomberg, and WSJ as primary sources — do not use random blogs or unverified aggregators.

Data requirement: Search SEC EDGAR for 8-K filings and Form 4 insider transactions first — these are the authoritative source. Prioritise items published in the 90-day window ending today; do not include events older than 90 days from today's date.

## Key Business Highlights (Last 3 Months)
Product launches, new partnerships, geographic expansions, major contract wins or losses, M&A activity — with dates.

## Corporate & Regulatory Events
Major corporate announcements, management changes, SEC/FTC/regulatory actions, insider buying or selling (Form 4 filings) — with dates.

## Analyst Activity
For each rating change in the period: **Firm** | **Old Rating → New Rating** | **Old Target → New Target ($)** | **Date**

## Red Flags
Any litigation, governance concerns, accounting irregularities, product recalls, antitrust risk, or large insider selling worth monitoring.

## Sentiment Rating
Overall: Positive / Neutral / Cautious / Negative — one sentence reason.`,
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
      indian: `Provide a technical analysis overview for {name} ({symbol} on NSE). Include: current trend (uptrend/downtrend/sideways with timeframe), key support levels (2-3), key resistance levels (2-3), 50-day and 200-day moving average positioning (price vs MA, golden or death cross status), RSI (14-day) reading and interpretation, MACD status (bullish or bearish cross, histogram expanding or contracting), Bollinger Band positioning (near upper band, lower band, or mid-band), recent volume trend, proximity to 52-week high/low or all-time high, and your overall setup assessment. Provide a specific actionable setup: entry zone, stop-loss level, target price, and risk:reward ratio (e.g. 1:2.5). State the invalidation level for any bullish thesis.

Data requirement: Use the current live price and today's technical indicator readings. Reference the most recent RSI, MACD, and moving average values — do not use charts or indicator readings that are more than 1-2 days old.`,
      us:     `Provide a technical analysis overview for {name} ({symbol}). Include: current trend (uptrend/downtrend/sideways with timeframe), key support levels (2-3), key resistance levels (2-3), 50-day and 200-day moving average positioning (price vs MA, golden or death cross status), RSI (14-day) reading and interpretation, MACD status (bullish or bearish cross, histogram expanding or contracting), Bollinger Band positioning (near upper band, lower band, or mid-band), recent volume trend and any notable patterns (breakout, consolidation, distribution), proximity to 52-week high/low or all-time high, and your overall setup assessment. Provide a specific actionable setup: entry zone, stop-loss level, target price, and risk:reward ratio (e.g. 1:2.5). State the invalidation level for any bullish thesis.

Data requirement: Use the current live price and today's technical indicator readings. Reference the most recent RSI, MACD, and moving average values — do not use charts or indicator readings that are more than 1-2 days old.`,
    },
  },
]

function buildQuery(template: string, name: string, symbol = ''): string {
  return template.replace(/\{name\}/g, name).replace(/\{symbol\}/g, symbol)
}

const FORMAT_SUFFIX = `

Formatting rules (strict):
- Use markdown tables with **bold column headers** for any structured data — prefer tables over bullet lists for 3+ data points
- Use ## section headers to organize content
- Lead every data point with the exact figure before any explanation
- No preamble or filler phrases ("Here is…", "Based on…", "It is worth noting…", "To summarize…", "In conclusion…")
- Numbers over words; round all figures to 1 decimal place
- For Indian stocks: use ₹ crores as the unit; for US stocks: use $ millions or billions

Data integrity rules (strict):
- Always state the source period for every figure (e.g. FY24, Q3 FY25, TTM as of Mar 2025) — never leave a number without its period
- Always use the most recently available data as of today — if FY25 results are published, use FY25 as the base year; do NOT default to older periods when newer data exists
- If a data point is unavailable, write "N/A — not disclosed" rather than omitting it
- When multiple figures for the same metric appear across different sources, use the company's official filing as the authoritative source and state which filing you used

Source rules (strict):
- For Indian stocks: use only BSE/NSE exchange filings, company annual reports and investor presentations, SEBI disclosures, Screener.in, Moneycontrol, Economic Times Markets, RBI data
- For US stocks: use only SEC EDGAR filings, company IR pages, Yahoo Finance, Bloomberg, Reuters, WSJ
- Do NOT use random blogs, opinion aggregators, or unverified third-party sites for financial figures`

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

  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const datePrefix = `Today's date: ${today}. Always use the most recently available data — search for filings, results, and news published up to ${today}.\n\n`

  if (sectionId === 'results' && isIndian && apiUrl) {
    const filingUrl = `${apiUrl}/api/filing/${symbol}/text`
    return `${datePrefix}The following URL contains the plain text of ${name}'s latest quarterly earnings filing:\n${filingUrl}\n\nAnalyze this filing as a buy-side analyst — no preamble, output directly:\n- Executive summary (3 lines)\n- Quarter scorecard table: Revenue, Net Profit, EPS, Key Margins — with YoY% and QoQ% columns\n- Segment performance table\n- What went well (exact numbers)\n- What was weak / concerning (exact numbers)\n- Management guidance\n- Key risks\n- Verdict: Very Strong / Strong / Mixed / Weak${FORMAT_SUFFIX}`
  }

  const template = isIndian ? section.query.indian : section.query.us
  return datePrefix + buildQuery(template, name, symbol) + FORMAT_SUFFIX
}
