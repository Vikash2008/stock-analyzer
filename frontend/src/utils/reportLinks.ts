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
      indian: `Analyze {name}'s ({symbol}) intrinsic value — lead with forward-looking and growth-adjusted methods. For high-growth companies, trailing PE vs historical average is misleading; DCF and growth-adjusted multiples should dominate.

## 1. DCF Valuation (Primary Method)
Build a simplified DCF using the latest trailing FCF (use PAT as proxy only if FCF is unavailable). Project FCF for 3 years using analyst consensus or management-guided growth rate. Apply terminal growth of 8-10% for high-growth Indian companies or 5-7% for mature businesses. Use WACC of 12-14%. Show: FCF Year 1/2/3, terminal value, total intrinsic value, and implied upside/downside vs current CMP. State every assumption explicitly (growth rate, WACC, terminal rate, base FCF used).

## 2. Growth-Adjusted PE Analysis
Do NOT treat trailing PE vs 5-year average as the primary signal without growth context:
- State current revenue growth (1Y and 3Y CAGR) and earnings growth (1Y and 3Y CAGR)
- Calculate PEG ratio (trailing PE ÷ earnings growth %): interpret <1 as potentially undervalued, >2 as growth fully priced in
- For hyper-growth companies (revenue CAGR >30%), trailing PE is distorted — use forward PE for FY+1 and FY+2 instead, and explain what PE is justified by the growth rate
- Explicitly state if historical or peer PE comparison is unreliable here and why (e.g. company has re-rated, sector mix has changed, it is now a different-quality business)

## 3. Multiples Snapshot (Context, Not Verdict)
Table: **Metric** | **Current** | **5Y Hist Avg** | **Sector Median** | **Growth-Adjusted Fair Range**
Rows: Trailing PE, Forward PE (FY+1), Forward PE (FY+2), EV/EBITDA, PEG, EV/Revenue, Price/Book
Note where any comparison is invalidated by growth-rate mismatch.

## 4. Future Stock Price Scenarios
What price does each scenario imply in 12 months and 24 months?
Table: **Scenario** | **Rev Growth Assumption** | **Margin Assumption** | **Target Multiple** | **12M Target (₹)** | **24M Target (₹)**
Rows: Bull, Base, Bear. State the single most important swing factor between scenarios.

## 5. Key Valuation Risks
- Multiple compression risks: what slows growth or re-rates the stock down (growth miss, rate rise, margin squeeze)
- Re-rating catalysts: what accelerates earnings or justifies a higher multiple (TAM expansion, new product, margin inflection)

Data requirement: Use the current live CMP and the most recently available financials. If Q4 FY2026 or the latest annual results are published, base all multiples on those. Search for analyst consensus FY+1 and FY+2 EPS estimates to populate forward PE rows.`,
      us:     `Analyze {name}'s ({symbol}) intrinsic value — lead with forward-looking and growth-adjusted methods. For high-growth or hyper-growth companies, trailing PE vs historical or sector average is insufficient; DCF and growth-adjusted multiples must be the primary lens.

## 1. DCF Valuation (Primary Method)
For profitable companies: project FCF for 3 years at analyst consensus growth rate, apply terminal growth of 3-4%, discount at WACC of 9-11%. Show FCF Year 1/2/3, terminal value, total intrinsic value, and implied upside/downside vs current price. For pre-profit or early-stage companies: project revenue 3 years forward, apply an exit EV/Revenue multiple appropriate to the expected growth rate at that point, then discount to present. State every assumption explicitly.

## 2. Growth-Adjusted Multiple Analysis
Do NOT rely on trailing PE vs historical average as the primary signal for growth companies:
- State current revenue growth (1Y and 3Y CAGR) and earnings/FCF growth rate
- Calculate PEG ratio (forward PE ÷ NTM earnings growth %): interpret <1 as potentially undervalued, >2 as growth fully priced in
- For SaaS/software: calculate Rule of 40 (revenue growth % + FCF margin %) — above 40 is strong, above 60 is exceptional; use EV/NTM Revenue and EV/NTM Gross Profit as primary multiples
- For hyper-growth (revenue CAGR >40%): trailing PE is meaningless; use forward EV/Revenue, NTM P/S, and price-to-growth-adjusted earnings
- Explicitly call out where historical PE or sector-peer PE comparison breaks down (e.g. company is in a different growth phase than its peers or its own history)

## 3. Multiples Snapshot (Context, Not Verdict)
Table: **Metric** | **Current** | **5Y Hist Avg** | **Peer Median** | **Growth-Adjusted Fair Range**
Rows: Trailing PE, Forward PE (NTM), EV/EBITDA, EV/Revenue, Price/FCF, PEG, Price/Sales
For SaaS/tech: also include EV/ARR or NRR if applicable.

## 4. Future Stock Price Scenarios
Table: **Scenario** | **Rev Growth** | **Margin Assumption** | **Target Multiple** | **12M Price ($)** | **24M Price ($)**
Rows: Bull, Base, Bear. For each scenario state the key assumption. Identify the single biggest swing factor between bull and bear outcomes.

## 5. Key Valuation Risks
- Multiple compression risks: growth deceleration, rate environment tightening, margin miss, competitive disruption
- Re-rating catalysts: TAM penetration acceleration, margin inflection point, new product cycle, buyback program

Data requirement: Use the current live price and most recently available financials (latest 10-K or 10-Q). Search for analyst consensus NTM and NTM+1 EPS/revenue estimates to populate forward multiples. For pre-profit companies, use EV/Revenue and EV/Gross Profit as the primary multiples.`,
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
