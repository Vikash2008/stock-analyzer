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

// ── Shared sector classification & metrics catalog ──────────────────────────
// Reused by Business Overview, Results, Valuation, Peers, and Financial Health —
// interpolated via template literal rather than duplicated per card/market variant.
export const SECTOR_METRICS_CATALOG = `SECTOR CLASSIFICATION & METRICS — first classify {name} into the closest-matching category below, then cover its listed metrics/factors. If none fit well, use standard equity-research judgment to identify the 2-4 metrics a sector specialist analyst would track for this specific business model — reason it out from first principles rather than forcing a bad fit. Only fall back to the General/Default metrics if you genuinely cannot identify anything more specific — it's a floor, not the default.

1. Diversified Mega-cap Tech Conglomerate (e.g. Amazon, Microsoft, Google, Broadcom) — segment-level revenue growth% & margin% per major segment (not one blended figure), sum-of-parts framing
2. Consumer Hardware & Devices (e.g. Apple) — unit shipments/ASP trend, Services revenue mix & growth, installed base growth, segment gross margins (hardware vs services)
3. AI/Datacenter Semiconductor Platform (e.g. Nvidia) — data-center revenue mix/growth, gross margin, demand backlog/visibility, software/ecosystem moat, hyperscaler customer concentration
4. Semiconductor Foundry (e.g. Taiwan Semiconductor) — capacity utilization%, capex as % of revenue, process-node roadmap/mix, customer concentration, geographic/geopolitical concentration risk
5. AI Infrastructure/Neocloud (e.g. Nebius, CoreWeave) — GPU capacity, contracted revenue backlog, capex intensity, customer concentration, margin ramp trajectory
6. SaaS/Enterprise Software (e.g. Adobe, Palantir, Oracle, RateGain) — ARR growth, Net Revenue Retention%, Rule of 40 (growth% + FCF margin%), gross margin, CAC payback; for legacy-to-cloud vendors (Oracle-type) split cloud growth from declining legacy license revenue; for government-exposed vendors (Palantir-type) track government contract book separately from commercial deal growth; for travel/hospitality-tech (RateGain-type) track client additions/module adoption and sensitivity to travel-demand recovery
7. Cybersecurity SaaS (e.g. CrowdStrike, Palo Alto Networks) — ARR, module/platform adoption per customer, net revenue retention
8. Internet/Platform — Ads-driven (e.g. Meta) — MAU/DAU, ARPU, ad revenue growth, AI-capex intensity
9. Internet/Platform — Quick Commerce/Food Delivery (e.g. Eternal, Swiggy) — GOV (Gross Order Value), take rate%, delivery cost per order, dark-store economics, contribution margin per order
10. Auto/EV (e.g. Tesla) — vehicle delivery growth, gross margin per vehicle, energy storage segment growth, production capacity/ramp
11. Space/Aerospace (e.g. Rocket Lab) — launch cadence, contracted revenue backlog, cost per launch, government/commercial contract wins
12. AI Infra Hardware/Server Manufacturing (e.g. Netweb Technologies) — order book, revenue growth, capacity expansion, customer concentration
13. Banks (e.g. Axis Bank, ICICI Bank) — P/B, P/E, ROE, ROA, NIM, GNPA%/NNPA%/PCR%, CASA ratio, Capital Adequacy Ratio
14. NBFC/Diversified Lending (e.g. Bajaj Finance) — P/B, ROE, NIM, GNPA%, loan book growth, cost of funds vs yield on advances
15. Housing Finance (e.g. Aptus Value Housing Finance, Awaas Financiers) — P/B, ROE, NIM, GNPA%, loan book growth, yield spread, underserved-geography concentration
16. Asset Management Company (e.g. HDFC AMC, Nippon AMC) — P/AUM, AUM growth% and mix (equity/debt/hybrid), net/SIP flows, yield/expense ratio
17. Insurance (e.g. HDFC Life, SBI Life) — P/EV (Price to Embedded Value), P/VNB, VNB margin, persistency ratio, solvency ratio
18. Market Infrastructure/Depository (e.g. CDSL) — demat account growth, transaction volume growth, revenue diversification (IPOs/corporate actions), regulatory moat
19. Pharma — API/CDMO (e.g. Supriya Lifescience) — capacity utilization, API pricing trends, USFDA/EU regulatory approvals, export customer concentration
20. Pharma — Branded/Generics — drug pipeline & patent-cliff exposure, ANDA filings/approvals pending, US generics revenue%, R&D as % of revenue
21. Diagnostics/Pathology Labs (e.g. Dr. Lal PathLabs) — test volume growth, revenue per patient, collection-center network expansion, payor mix
22. Hospitals (e.g. Max Healthcare, Fortis, Apollo) — ARPOB, occupancy%, bed capacity pipeline, EV/EBITDA, EV/bed
23. Capital Goods/Infra/Order-book businesses — order book size vs trailing revenue (book-to-bill), order inflow this quarter, execution/revenue-recognition pace
24. Real Estate — P/NAV, pre-sales/bookings growth, launch pipeline
General/Default (only if nothing above fits): EV/EBITDA, ROIC/ROCE, Debt/Equity, FCF margin`

const INDUSTRY_MACRO_FACTORS = `INDUSTRY-LEVEL FACTORS & METRICS — first classify which industry {name} operates in. Always include these three regardless of industry: policy interest rate, inflation rate (CPI, latest print), and the relevant currency rate for this industry's cost/revenue base. Then cover whichever of these industry-specific dynamics and numbers apply — if none match, use judgment to identify the 2-3 most relevant industry-level numbers instead of skipping this:
- Banks/NBFC/Housing Finance: system-wide credit growth%, industry GNPA ratio, benchmark government bond yield
- Real Estate/Housing: mortgage rate, housing price index growth, urbanization rate
- Auto: fuel price trend, EV penetration % of industry sales, industry unit sales growth
- Pharma/Healthcare: healthcare spend as % of GDP, insurance penetration%, industry-wide patent-cliff wave, drug-pricing policy shifts
- IT Services/Tech: global IT spend growth%, export-revenue currency trend
- Oil & Gas: crude oil price, refining margin (GRM)
- Metals/Mining: commodity price index, China demand indicator
- Consumer/Retail: consumer confidence index, e-commerce penetration%
- Semiconductors: global semiconductor sales growth%, memory pricing index
- Insurance: insurance penetration (% of GDP), solvency/regulatory framework shifts
- SaaS/Software: enterprise IT spend growth%, cloud adoption rate`

const CLASSIFICATION_NOTE = `Do this classification and metric selection silently as part of your research — don't show your classification reasoning, just write the resulting sections.`

export const SECTIONS: SectionConfig[] = [
  {
    id:          'business',
    emoji:       '🏢',
    label:       'Business Overview & Moat',
    description: 'Revenue model, competitive moat, key products',
    color: {
      bg:         'bg-teal-50',
      border:     'border-teal-200',
      accentHex:  '#0d9488',
      btnSolid:   'bg-teal-600 text-white shadow-sm',
      btnOutline: 'bg-teal-50 text-teal-700 border border-teal-200',
    },
    query: {
      indian: `Analyze {name}'s ({symbol}) business and moat. Structure your answer exactly as these sections, in order:

## Business Model & Revenue Streams
How {name} makes money. Include a mandatory table of revenue segment mix (%) — do not skip this table even if you must estimate from the latest available breakup.

## Products/Services & Customer Segments
Key products/services and primary customer segments.

## Geographic Footprint
Revenue split by geography/region.

## Competitive Moat
Moat type — brand, cost structure, switching costs, network effects, regulatory licence, or IP — and its strength.

## Market Position & Recent Strategic Direction
Current market share estimate and strategic moves in the last 12 months.

## Ownership & Governance
Insider/promoter holding % and any recent changes; founder-led or professionally managed; recent leadership changes.

## Concentration Risk
Customer or geographic concentration if any single segment/customer exceeds 15% of revenue.

## Key Business Metrics
${SECTOR_METRICS_CATALOG}
Present the resulting metrics as a compact table.

## [Sector-Specific Factors — use the actual sector name as the heading, e.g. "Banking-Specific Factors"]
Cover the qualitative factors most relevant to {name}'s actual business type from the same classification above (e.g. loan book quality for a bank, ARR/NRR trajectory for a SaaS company, order book for a capital-goods company) — pick a heading name that reflects the real sector, not a generic label.

## Verdict
One line: moat strength — Wide / Narrow / None — and the single most important reason.

${CLASSIFICATION_NOTE}

Data requirement: Use the latest available annual report (FY2026 if filed, else FY2025), the most recent quarterly results, and the latest investor presentation. Search BSE/NSE and the company's IR page to confirm the latest filing available as of today — do not use older filings when newer ones exist.`,
      us:     `Analyze {name}'s ({symbol}) business and moat. Structure your answer exactly as these sections, in order:

## Business Model & Revenue Streams
How {name} makes money. Include a mandatory table of revenue segment mix (%) — do not skip this table even if you must estimate from the latest available segment breakup.

## Products/Services & Customer Segments
Key products/services and primary customer segments.

## Geographic Footprint
Global revenue split by geography/region.

## Competitive Moat
Moat type — brand, cost structure, switching costs, network effects, regulatory licence, or IP — and its strength.

## Market Position & Recent Strategic Direction
Current market share estimate and strategic moves in the last 12 months.

## Ownership & Governance
Insider/promoter holding % and any recent changes; founder-led or professionally managed; recent C-suite changes.

## Concentration Risk
Customer concentration if any single customer exceeds 10% of revenue.

## Key Business Metrics
${SECTOR_METRICS_CATALOG}
Present the resulting metrics as a compact table.

## [Sector-Specific Factors — use the actual sector name as the heading, e.g. "AI/Datacenter Semiconductor-Specific Factors"]
Cover the qualitative factors most relevant to {name}'s actual business type from the same classification above (e.g. data-center mix and CUDA ecosystem moat for an AI-chip designer, capacity utilization and capex intensity for a foundry, ARR/NRR trajectory for a SaaS company) — pick a heading name that reflects the real sector, not a generic label.

## Verdict
One line: moat strength — Wide / Narrow / None — and the single most important reason.

${CLASSIFICATION_NOTE}

Data requirement: Use the latest available 10-K annual filing, most recent 10-Q, and any post-earnings investor presentations or earnings call transcripts. Search SEC EDGAR to confirm the most recently filed document available as of today — do not rely on older filings when newer ones exist.`,
    },
  },
  {
    id:          'industry',
    emoji:       '🌐',
    label:       'Industry Outlook & Macro',
    description: 'Sector tailwinds, TAM, regulatory environment',
    color: {
      bg:         'bg-teal-50',
      border:     'border-teal-200',
      accentHex:  '#0d9488',
      btnSolid:   'bg-teal-600 text-white shadow-sm',
      btnOutline: 'bg-teal-50 text-teal-700 border border-teal-200',
    },
    query: {
      indian: `Analyze the 3-5 year outlook for the industry {name} ({symbol}) operates in. Structure your answer exactly as these sections, in order:

## Market Size & Growth
Mandatory table: historical (last 2-3 years) and projected TAM size with CAGR, each figure with its publication year/source stated.

## Structural Tailwinds
Key structural tailwinds for the industry.

## Headwinds & Disruption Risks
Headwinds, disruption risks.

## Regulatory Environment
Relevant regulators for this market and current regulatory posture.

## Macro Sensitivity
How interest rates, inflation, and currency movements affect this sector specifically.

## Key Trends — Next 3 Years
2-3 trends that will define the sector.

## Growth Phase & Competitive Structure
Is the sector early-growth, maturing, or consolidating? Fragmented or concentrated — estimate top-3 players' combined market share.

## Industry & Macro Metrics
${INDUSTRY_MACRO_FACTORS}
Present as a compact table where possible.

## Verdict
One line: Strong Tailwind / Moderate Tailwind / Neutral / Headwind — and the single most important reason.

${CLASSIFICATION_NOTE}

Data requirement: Prioritise the most recently published industry reports, government data (MCA, RBI, SEBI, sector-specific regulators), and analyst sector notes from 2025-2026. State the publication year and source for every market-size or CAGR figure.`,
      us:     `Analyze the 3-5 year outlook for the industry {name} ({symbol}) operates in. Structure your answer exactly as these sections, in order:

## Market Size & Growth
Mandatory table: historical (last 2-3 years) and projected TAM size with CAGR, each figure with its publication year/source stated.

## Structural Tailwinds
Key structural tailwinds for the industry.

## Headwinds & Disruption Risks
Headwinds, disruption risks.

## Regulatory Environment
Relevant regulators for this market and current regulatory posture.

## Macro Sensitivity
How interest rates, inflation, and currency movements affect this sector specifically.

## Key Trends — Next 3 Years
2-3 trends that will define the sector.

## Growth Phase & Competitive Structure
Is the sector early-growth, maturing, or consolidating? Fragmented or concentrated — estimate top-3 players' combined market share.

## Industry & Macro Metrics
${INDUSTRY_MACRO_FACTORS}
Present as a compact table where possible.

## Verdict
One line: Strong Tailwind / Moderate Tailwind / Neutral / Headwind — and the single most important reason.

${CLASSIFICATION_NOTE}

Data requirement: Prioritise the most recently published industry reports, government data, and analyst sector notes from 2025-2026. State the publication year and source for every market-size or CAGR figure.`,
    },
  },
  {
    id:          'results',
    emoji:       '📊',
    label:       'Latest Earnings & Guidance',
    description: 'Most recent quarter — numbers, guidance, highlights',
    color: {
      bg:         'bg-teal-50',
      border:     'border-teal-200',
      accentHex:  '#0d9488',
      btnSolid:   'bg-teal-600 text-white shadow-sm',
      btnOutline: 'bg-teal-50 text-teal-700 border border-teal-200',
    },
    query: {
      indian: `Summarize {name}'s ({symbol}) most recent quarterly results — state the exact quarter and fiscal year (e.g. Q3 FY25). Use the company's official BSE/NSE filing or earnings press release as the primary source; cite which filing you used.

Data requirement: Search BSE/NSE corporate announcements explicitly for the most recently published quarterly results as of today's date. If Q4 FY2026 or any newer quarter has been filed, use that — do not default to an older quarter when a newer filing is available.

## Metrics Scorecard
Table with columns: **Metric** | **Actual** | **Analyst Est.** | **YoY%** | **QoQ%**
Base rows: Revenue (₹ Cr), EBITDA (₹ Cr), PAT (₹ Cr), EPS (diluted ₹), Gross Margin%, EBITDA Margin%, PAT Margin%.
Then classify {name}'s sector using this catalog and swap in/add the sector-appropriate rows instead of generic ones — e.g. banks/NBFC replace EBITDA with NIM% and add GNPA%/NNPA%/PCR%; SaaS adds ARR growth and NRR%; semiconductor/AI-chip companies add data-center revenue mix and gross margin trend; any tech company (not just US-listed) adds stock-based compensation as % of revenue:
${SECTOR_METRICS_CATALOG}

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
One line: Very Strong / Strong / Mixed / Weak — and the single most important reason.

${CLASSIFICATION_NOTE}`,
      us:     `Summarize {name}'s ({symbol}) most recent quarterly earnings — state the exact quarter (e.g. Q2 FY2025 / fiscal Q3 2025). Use the company's SEC 10-Q or official earnings press release as the primary source; cite which filing you used.

Data requirement: Search SEC EDGAR and the company's IR page for the most recently filed 10-Q or earnings press release as of today's date. Do not default to an older quarter if a newer filing is available.

## Metrics Scorecard
Table with columns: **Metric** | **Actual** | **Analyst Est.** | **YoY%** | **QoQ%**
Base rows: Revenue ($M), Operating Income ($M), Net Income ($M), EPS (diluted $), Gross Margin%, Operating Margin%, Net Margin%. Distinguish GAAP from non-GAAP figures where both are reported (this is a genuine US-accounting distinction — India follows Ind-AS, no GAAP/non-GAAP concept).
Then classify {name}'s sector using this catalog and swap in/add the sector-appropriate rows instead of generic ones — e.g. banks add NIM%/GNPA-equivalent asset-quality metrics; SaaS adds ARR growth and NRR%; any tech company adds stock-based compensation as % of revenue:
${SECTOR_METRICS_CATALOG}

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
One line: Very Strong / Strong / Mixed / Weak — and the single most important reason.

${CLASSIFICATION_NOTE}`,
    },
  },
  {
    id:          'valuation',
    emoji:       '⚖️',
    label:       'Valuation Metrics',
    description: 'Method fits the business, growth is company-derived',
    color: {
      bg:         'bg-teal-50',
      border:     'border-teal-200',
      accentHex:  '#0d9488',
      btnSolid:   'bg-teal-600 text-white shadow-sm',
      btnOutline: 'bg-teal-50 text-teal-700 border border-teal-200',
    },
    query: {
      indian: `Analyze {name}'s ({symbol}) valuation. Structure your answer exactly as these sections, in order:

## Valuation Framework & Thesis
First classify {name}'s sector and maturity stage (early-growth / high-growth / mature-stable / cyclical / declining). State which valuation method(s) you're using and why, based on this classification (see Primary Valuation below for the mapping). Then derive the growth assumption you'll use — do NOT use a fixed market-wide range. Instead state: this company's own historical revenue/earnings CAGR (1yr and 3yr), analyst consensus forward estimates (FY+1/FY+2), and management's own guidance — then state the blended growth assumption you're using as an explicit sentence, e.g. "Growth assumption: 18% — derived from 3yr historical CAGR of 22%, consensus FY+1 estimate of 16%, management guidance of 'high-teens'; blended toward the lower end given the deceleration trend."

## Growth & Price Trend Analysis
Revenue/profit growth over the last few quarters and years plotted against price performance over the same period — has price kept pace with fundamentals or diverged? Historical P/E band (5yr min/avg/max) vs current P/E — always show this even if P/E isn't the primary valuation lens for this sector. Current price vs all-time-high and 52-week high — % drawdown from top. Stagnation check — has the stock been range-bound for an extended period (6-12 months) despite fundamentals progressing? Frame this as valuation context only (is the drawdown/stagnation justified by a real business slowdown, or is price lagging fundamentals) — do not give trading-setup mechanics here, that belongs in the Technical Analysis card.

## Primary Valuation
Apply the method selected in the Framework above:
- Mature, stable non-financial businesses: DCF — project FCF 3 years using the derived growth assumption, terminal growth 8-10% for high-growth or 5-7% for mature Indian companies, WACC 12-14%. Show FCF Year 1/2/3, terminal value, intrinsic value, implied upside/downside.
- High-growth/pre-profit or hyper-growth businesses: EV/Revenue or EV/ARR forward multiples + PEG (using the derived growth assumption) — standard DCF is unreliable here since near-term FCF is negative or volatile.
- Banks/NBFC/Housing Finance/Insurance/AMC: P/B justified via a Gordon-growth-on-equity approach (P/B implied by ROE and growth) — NOT a cash-flow DCF, since FCF isn't a meaningful concept for a financial company.
- Infra/capital-goods/asset-heavy/utilities: FCF yield + EV/EBITDA + order-book-adjusted earnings multiple.
- Real Estate: P/NAV.
- Cyclicals (semiconductors, metals, oil & gas): normalized/mid-cycle EV/EBITDA, since trailing multiples are distorted at cycle peaks/troughs.
State every assumption explicitly.

## Multiples Snapshot
Table: **Metric** | **Current** | **5Y Hist Avg** | **Sector Median** | **Growth-Adjusted Fair Range**
Always include Trailing PE and Forward PE as universal baseline rows regardless of sector. Then add sector-specific rows using this catalog:
${SECTOR_METRICS_CATALOG}

## Analyst Consensus & Price Targets
Table: **Firm** | **Rating** | **Price Target (₹)** | **Date** — for the 5-8 most recent. Then a consensus line: average/high/low target, Buy/Hold/Sell counts, implied upside/downside vs current price.

## Future Stock Price Scenarios
Table: **Scenario** | **Rev Growth Assumption** | **Margin Assumption** | **Target Multiple** | **12M Target (₹)** | **24M Target (₹)**
Rows: Bull, Base, Bear — using the company-derived growth range from the Framework section above, not a fixed market-wide range. State the single most important swing factor.

## Key Valuation Risks
Multiple compression risks and re-rating catalysts.

## Valuation Verdict
One line: Undervalued / Fairly Valued / Overvalued — and which method drove the conclusion and why.

${CLASSIFICATION_NOTE}

Data requirement: Use the current live CMP and the most recently available financials. Search for analyst consensus FY+1 and FY+2 EPS estimates.`,
      us:     `Analyze {name}'s ({symbol}) valuation. Structure your answer exactly as these sections, in order:

## Valuation Framework & Thesis
First classify {name}'s sector and maturity stage (early-growth / high-growth / mature-stable / cyclical / declining). State which valuation method(s) you're using and why, based on this classification (see Primary Valuation below for the mapping). Then derive the growth assumption you'll use — do NOT use a fixed market-wide range. Instead state: this company's own historical revenue/earnings CAGR (1yr and 3yr), analyst consensus NTM/NTM+1 estimates, and management's own guidance — then state the blended growth assumption you're using as an explicit sentence, e.g. "Growth assumption: 18% — derived from 3yr historical CAGR of 22%, consensus NTM estimate of 16%, management guidance of 'high-teens'; blended toward the lower end given the deceleration trend."

## Growth & Price Trend Analysis
Revenue/profit growth over the last few quarters and years plotted against price performance over the same period — has price kept pace with fundamentals or diverged? Historical P/E band (5yr min/avg/max) vs current P/E — always show this even if P/E isn't the primary valuation lens for this sector. Current price vs all-time-high and 52-week high — % drawdown from top. Stagnation check — has the stock been range-bound for an extended period (6-12 months) despite fundamentals progressing? Frame this as valuation context only (is the drawdown/stagnation justified by a real business slowdown, or is price lagging fundamentals) — do not give trading-setup mechanics here, that belongs in the Technical Analysis card.

## Primary Valuation
Apply the method selected in the Framework above:
- Mature, stable non-financial businesses: DCF — project FCF 3 years using the derived growth assumption, terminal growth 3-4%, WACC 9-11%. Show FCF Year 1/2/3, terminal value, intrinsic value, implied upside/downside.
- High-growth/pre-profit or hyper-growth businesses: EV/Revenue or EV/ARR forward multiples + PEG (using the derived growth assumption); for SaaS also use Rule of 40 — standard DCF is unreliable here since near-term FCF is negative or volatile.
- Banks/NBFC/Insurance/AMC: P/B justified via a Gordon-growth-on-equity approach (P/B implied by ROE and growth) — NOT a cash-flow DCF, since FCF isn't a meaningful concept for a financial company.
- Infra/capital-goods/asset-heavy/utilities: FCF yield + EV/EBITDA + order-book-adjusted earnings multiple.
- Real Estate/REITs: P/NAV.
- Cyclicals (semiconductors, metals, oil & gas): normalized/mid-cycle EV/EBITDA, since trailing multiples are distorted at cycle peaks/troughs.
State every assumption explicitly.

## Multiples Snapshot
Table: **Metric** | **Current** | **5Y Hist Avg** | **Peer Median** | **Growth-Adjusted Fair Range**
Always include Trailing PE and Forward PE as universal baseline rows regardless of sector. Then add sector-specific rows using this catalog:
${SECTOR_METRICS_CATALOG}

## Analyst Consensus & Price Targets
Table: **Firm** | **Rating** | **Price Target ($)** | **Date** — for the 5-8 most recent. Then a consensus line: average/high/low target, Buy/Hold/Sell counts, implied upside/downside vs current price.

## Future Stock Price Scenarios
Table: **Scenario** | **Rev Growth** | **Margin Assumption** | **Target Multiple** | **12M Price ($)** | **24M Price ($)**
Rows: Bull, Base, Bear — using the company-derived growth range from the Framework section above, not a fixed market-wide range. Identify the single biggest swing factor.

## Key Valuation Risks
Multiple compression risks and re-rating catalysts.

## Valuation Verdict
One line: Undervalued / Fairly Valued / Overvalued — and which method drove the conclusion and why.

${CLASSIFICATION_NOTE}

Data requirement: Use the current live price and most recently available financials (latest 10-K or 10-Q). Search for analyst consensus NTM and NTM+1 EPS/revenue estimates.`,
    },
  },
  {
    id:          'peers',
    emoji:       '🔬',
    label:       'Peer Comparison Matrix',
    description: '4–5 closest comparables, sector-appropriate columns',
    color: {
      bg:         'bg-teal-50',
      border:     'border-teal-200',
      accentHex:  '#0d9488',
      btnSolid:   'bg-teal-600 text-white shadow-sm',
      btnOutline: 'bg-teal-50 text-teal-700 border border-teal-200',
    },
    query: {
      indian: `Compare {name} ({symbol}) against its 4-5 closest competitors. Structure your answer exactly as these sections, in order:

## Peer Comparison Table
First classify {name}'s sector using this catalog, and choose peers accordingly — prefer same-sector listed competitors, but allow a cross-listed peer (e.g. a US-listed company) if it is genuinely more comparable than any same-market option, especially for globally-competitive sectors like semiconductors, pharma, or large-cap tech:
${SECTOR_METRICS_CATALOG}
Table columns: always include **Company** | **MCap (₹Cr)** | **Rev Growth 1Y** | **Operating Margin** | **PE (TTM)** as fixed core columns, then add 3-4 sector-appropriate columns from the catalog above instead of a generic set (e.g. a bank gets ROE/P-B/GNPA%, a SaaS company gets EV/ARR/NRR%, a semiconductor foundry gets capacity utilization%/capex%, a semiconductor AI-chip designer gets data-center revenue mix — never compare a foundry and a chip designer on the same columns, they have different economics). All figures must reference the same reporting period — state which period you are using in the table header.

## Where {name} Leads
2-3 bullets on where {name} outperforms the peer group.

## Where {name} Lags
2-3 bullets on where {name} underperforms.

## Market Share Momentum
Which peer is gaining market share fastest and why, and which is losing ground.

## Verdict
One line: {name}'s overall ranking vs this peer set and the single biggest differentiator.

${CLASSIFICATION_NOTE}

Data requirement: Use the most recently reported figures for every company in the table — latest available quarterly or annual results as of today. Do not mix reporting periods across companies without explicitly noting it.`,
      us:     `Compare {name} ({symbol}) against its 4-5 closest competitors. Structure your answer exactly as these sections, in order:

## Peer Comparison Table
First classify {name}'s sector using this catalog, and choose peers accordingly:
${SECTOR_METRICS_CATALOG}
Table columns: always include **Company** | **MCap ($B)** | **Rev Growth 1Y** | **Operating Margin** | **PE (TTM)** as fixed core columns, then add 3-4 sector-appropriate columns from the catalog above instead of a generic set (e.g. a bank gets ROE/P-B/asset-quality, a SaaS company gets EV/ARR/NRR%, a semiconductor foundry gets capacity utilization%/capex%, a semiconductor AI-chip designer gets data-center revenue mix — never compare a foundry and a chip designer on the same columns, they have different economics). All figures must reference the same reporting period — state which period you are using in the table header.

## Where {name} Leads
2-3 bullets on where {name} outperforms the peer group.

## Where {name} Lags
2-3 bullets on where {name} underperforms.

## Market Share Momentum
Which peer is gaining market share fastest and why, and which is losing ground.

## Verdict
One line: {name}'s overall ranking vs this peer set and the single biggest differentiator.

${CLASSIFICATION_NOTE}

Data requirement: Use the most recently reported figures for every company in the table — latest available quarterly or annual results as of today. Do not mix reporting periods across companies without explicitly noting it.`,
    },
  },
  {
    id:          'financial',
    emoji:       '🏦',
    label:       'Financial Health & Trends',
    description: 'Balance sheet, FCF, margins over 3 years',
    color: {
      bg:         'bg-teal-50',
      border:     'border-teal-200',
      accentHex:  '#0d9488',
      btnSolid:   'bg-teal-600 text-white shadow-sm',
      btnOutline: 'bg-teal-50 text-teal-700 border border-teal-200',
    },
    query: {
      indian: `Analyze {name}'s financial health and trends over the most recent 3 fiscal years (use the latest available — if FY25 data is out, use FY23–FY25). Structure your answer exactly as these sections, in order:

## Growth Trends
Revenue CAGR, gross and operating margin trajectory, PAT CAGR — 3-year trend table.

## Cash Flow Quality
FCF generation and FCF margin trend. Flag if FCF materially diverges from PAT (accrual quality concern).

## Balance Sheet Strength
Debt-to-equity trend, interest coverage ratio trend, net debt/cash position trend.

## Capital Efficiency
ROCE/ROIC trend (show together — same underlying concept, different regional naming convention).

## Capital Allocation
CAPEX as % of revenue (3-year trend), buyback yield (TTM) if any, dividend payout trend — cover all of these for every company, not gated by market.

## Working Capital Efficiency
Working capital days — debtor/inventory/creditor — 3-year trend.

## Sector-Specific Financial Trends
First classify {name}'s sector using this catalog, then show the 3-year TRAJECTORY (not a snapshot) of its sector-specific metrics — e.g. a bank's NIM%/GNPA% trend over 3 years, a foundry's capex-intensity trend, a SaaS company's Rule-of-40 trend, a neocloud's margin-ramp trajectory:
${SECTOR_METRICS_CATALOG}

## Financial Health Verdict
One line: Strong / Stable / Deteriorating — and the single most important reason.

${CLASSIFICATION_NOTE}

Data requirement: If FY2026 annual results are published, use FY2024–FY2026 as the 3-year window. Search BSE/NSE and Screener.in to verify the latest available annual report as of today.`,
      us:     `Analyze {name}'s financial health and trends over the most recent 3 fiscal years (use the latest available — if FY25 data is out, use FY23–FY25). Structure your answer exactly as these sections, in order:

## Growth Trends
Revenue CAGR, gross and operating margin trajectory, net income CAGR — 3-year trend table.

## Cash Flow Quality
FCF generation and FCF yield trend. Flag if FCF materially diverges from net income (accrual quality concern).

## Balance Sheet Strength
Debt-to-equity trend, interest coverage ratio trend, net debt or net cash position trend.

## Capital Efficiency
ROCE/ROIC trend (show together — same underlying concept, different regional naming convention).

## Capital Allocation
CAPEX as % of revenue (3-year trend), buyback yield (TTM), dividend payout trend.

## Working Capital Efficiency
Working capital days — debtor/inventory/creditor — 3-year trend.

## Sector-Specific Financial Trends
First classify {name}'s sector using this catalog, then show the 3-year TRAJECTORY (not a snapshot) of its sector-specific metrics — e.g. a bank's NIM%/asset-quality trend over 3 years, a foundry's capex-intensity trend, a SaaS company's Rule-of-40 trend, a neocloud's margin-ramp trajectory:
${SECTOR_METRICS_CATALOG}

## Financial Health Verdict
One line: Strong / Stable / Deteriorating — and the single most important reason.

${CLASSIFICATION_NOTE}

Data requirement: If FY2026 annual results (10-K) are filed, use FY2024–FY2026 as the 3-year window. Search SEC EDGAR to confirm the most recently filed 10-K available as of today.`,
    },
  },
  {
    id:          'news',
    emoji:       '🚨',
    label:       'News, Sentiment & Red Flags',
    description: 'Last 90 days — highlights, events, risks, insider activity',
    color: {
      bg:         'bg-teal-50',
      border:     'border-teal-200',
      accentHex:  '#0d9488',
      btnSolid:   'bg-teal-600 text-white shadow-sm',
      btnOutline: 'bg-teal-50 text-teal-700 border border-teal-200',
    },
    query: {
      indian: `Summarize {name} ({symbol}) over the last 90 days. Use BSE/NSE exchange announcements, company press releases, Economic Times Markets, and Moneycontrol as primary sources — do not use random blogs or unverified aggregators, and if grounding search returns a low-quality result, disregard it even if no better source is found.

Data requirement: Search BSE/NSE corporate announcements first — these are the authoritative source. Prioritise items published in the 90-day window ending today; do not include events older than 90 days.

## Key Business Highlights (Last 3 Months)
Product launches, new partnerships, geographic expansions, major order wins or losses, capacity additions, joint ventures — with dates.

## Corporate & Regulatory Events
Major corporate announcements, management changes, SEBI or regulatory actions, promoter stake changes or pledging activity — with dates.

## Analyst Activity
For each rating change in the period: **Firm** | **Old Rating → New Rating** | **Old Target → New Target (₹)** | **Date**

## Red Flags
First classify {name}'s sector, then specifically check the 1-3 red-flag categories most relevant to that sector in addition to general litigation/governance/accounting concerns — e.g. pharma: FDA/regulatory warning letters or import alerts; banks/NBFC: RBI supervisory action or rising GNPA; semiconductor foundries/hardware exporters: export-control or geopolitical developments; SaaS: customer/logo churn spike; hospitals: licensing/accreditation issues.

## Sentiment Metrics
Net insider/promoter transaction activity (SAST disclosures) in the period, count of analyst upgrades/downgrades this period, FII/DII net buying or selling in the stock, and delivery % (proportion of traded volume that's actual delivery vs intraday speculation) — these are the genuine Indian-market sentiment indicators, not a translation of US short-interest data.

## Sentiment Rating
Overall: Positive / Neutral / Cautious / Negative — one sentence reason.

${CLASSIFICATION_NOTE}`,
      us:     `Summarize {name} ({symbol}) over the last 90 days. Use SEC filings, company press releases, Reuters, Bloomberg, and WSJ as primary sources — do not use random blogs or unverified aggregators, and if grounding search returns a low-quality result, disregard it even if no better source is found.

Data requirement: Search SEC EDGAR for 8-K filings and Form 4 insider transactions first — these are the authoritative source. Prioritise items published in the 90-day window ending today; do not include events older than 90 days.

## Key Business Highlights (Last 3 Months)
Product launches, new partnerships, geographic expansions, major contract wins or losses, M&A activity — with dates.

## Corporate & Regulatory Events
Major corporate announcements, management changes, SEC/FTC/regulatory actions, insider buying or selling (Form 4 filings) — with dates.

## Analyst Activity
For each rating change in the period: **Firm** | **Old Rating → New Rating** | **Old Target → New Target ($)** | **Date**

## Red Flags
First classify {name}'s sector, then specifically check the 1-3 red-flag categories most relevant to that sector in addition to general litigation/governance/accounting concerns — e.g. pharma: FDA warning letters or import alerts; banks/NBFC: regulatory supervisory action or rising delinquencies; semiconductor foundries/hardware exporters: export-control or geopolitical developments; SaaS: customer/logo churn spike; hospitals: licensing/accreditation issues.

## Sentiment Metrics
Net insider buying/selling ($ value, from Form 4 filings), count of analyst upgrades/downgrades this period, and short interest % of float.

## Sentiment Rating
Overall: Positive / Neutral / Cautious / Negative — one sentence reason.

${CLASSIFICATION_NOTE}`,
    },
  },
  {
    id:          'technical',
    emoji:       '📈',
    label:       'Technical Analysis Setup',
    description: 'Trend, levels, patterns, breakout & breakdown zones',
    color: {
      bg:         'bg-teal-50',
      border:     'border-teal-200',
      accentHex:  '#0d9488',
      btnSolid:   'bg-teal-600 text-white shadow-sm',
      btnOutline: 'bg-teal-50 text-teal-700 border border-teal-200',
    },
    query: {
      indian: `Provide a technical analysis overview for {name} ({symbol} on NSE). Structure your answer exactly as these sections, in order:

## Trend & Momentum
Current trend (uptrend/downtrend/sideways with timeframe), RSI (14-day) reading and interpretation, MACD status (bullish or bearish cross, histogram expanding or contracting).

## Key Levels
Table: **Level** | **Price** | **Note** — rows: Support 1/2/3, Resistance 1/2/3, 52-Week High/Low, All-Time High, and a Breakdown Zone (the price level below which further decline is confirmed — the bearish counterpart to a breakout level).

## Moving Averages & Bands
50-day, 100-day, and 200-day moving average positioning — price vs each MA, golden/death cross status specifically between the 50-day and 200-day, with the 100-day flagged as an intermediate trend-confirmation level. Bollinger Band positioning (near upper band, lower band, or mid-band).

## Chart & Candlestick Patterns
Candlestick patterns visible at current price action (doji, hammer, engulfing, shooting star, etc.) and what they signal near-term. Any larger multi-day/week chart pattern forming or completing (ascending/descending triangle, flag, wedge, double top/bottom, cup & handle, head & shoulders) and which direction a resolution would likely break.

## Volume & Price Patterns
Recent volume trend and any notable patterns — breakout, consolidation, or distribution.

## Setup & Verdict
Overall bias: Bullish / Bearish / Neutral, with both breakout likelihood AND breakdown risk framing (not just the bullish case) — e.g. "Consolidating near resistance; a close above ₹X on above-average volume confirms breakout, a close below ₹Y (the Breakdown Zone) risks further decline." Then a specific actionable setup: entry zone, stop-loss level, target price, risk:reward ratio (e.g. 1:2.5), and the invalidation level for the bullish thesis tied to the Breakdown Zone above.

Data requirement: Use the current live price and today's technical indicator readings. Reference the most recent RSI, MACD, and moving average values — do not use readings more than 1-2 days old.`,
      us:     `Provide a technical analysis overview for {name} ({symbol}). Structure your answer exactly as these sections, in order:

## Trend & Momentum
Current trend (uptrend/downtrend/sideways with timeframe), RSI (14-day) reading and interpretation, MACD status (bullish or bearish cross, histogram expanding or contracting).

## Key Levels
Table: **Level** | **Price** | **Note** — rows: Support 1/2/3, Resistance 1/2/3, 52-Week High/Low, All-Time High, and a Breakdown Zone (the price level below which further decline is confirmed — the bearish counterpart to a breakout level).

## Moving Averages & Bands
50-day, 100-day, and 200-day moving average positioning — price vs each MA, golden/death cross status specifically between the 50-day and 200-day, with the 100-day flagged as an intermediate trend-confirmation level. Bollinger Band positioning (near upper band, lower band, or mid-band).

## Chart & Candlestick Patterns
Candlestick patterns visible at current price action (doji, hammer, engulfing, shooting star, etc.) and what they signal near-term. Any larger multi-day/week chart pattern forming or completing (ascending/descending triangle, flag, wedge, double top/bottom, cup & handle, head & shoulders) and which direction a resolution would likely break.

## Volume & Price Patterns
Recent volume trend and any notable patterns — breakout, consolidation, or distribution.

## Setup & Verdict
Overall bias: Bullish / Bearish / Neutral, with both breakout likelihood AND breakdown risk framing (not just the bullish case) — e.g. "Consolidating near resistance; a close above $X on above-average volume confirms breakout, a close below $Y (the Breakdown Zone) risks further decline." Then a specific actionable setup: entry zone, stop-loss level, target price, risk:reward ratio (e.g. 1:2.5), and the invalidation level for the bullish thesis tied to the Breakdown Zone above.

Data requirement: Use the current live price and today's technical indicator readings. Reference the most recent RSI, MACD, and moving average values — do not use readings more than 1-2 days old.`,
    },
  },
]

// ── Looping progress messages shown while a card is streaming — see ReportTab.tsx ──
export const PROGRESS_MESSAGES: Record<string, string[]> = {
  business: [
    'Identifying business & sector…',
    'Checking latest annual report / 10-K…',
    'Working out revenue mix…',
    'Assessing competitive moat…',
    'Selecting sector-specific factors…',
    'Cross-referencing sources…',
    'Composing structured answer…',
  ],
  industry: [
    'Sizing the market…',
    'Checking industry reports…',
    'Identifying tailwinds & headwinds…',
    'Mapping regulatory environment…',
    'Assessing macro sensitivity…',
    'Classifying growth phase…',
    'Composing structured answer…',
  ],
  results: [
    'Fetching latest filing…',
    'Reading quarterly metrics…',
    'Comparing YoY/QoQ…',
    'Checking segment performance…',
    'Scanning analyst reactions…',
    'Composing scorecard…',
  ],
  valuation: [
    'Classifying business & selecting valuation method…',
    'Running primary valuation…',
    'Checking analyst estimates…',
    'Comparing multiples to peers & history…',
    'Gathering price targets…',
    'Building bull/base/bear scenarios…',
    'Composing valuation verdict…',
  ],
  peers: [
    'Identifying closest peers…',
    'Gathering peer financials…',
    'Comparing metrics…',
    'Assessing market share momentum…',
    'Composing verdict…',
  ],
  financial: [
    'Pulling 3-year financials…',
    'Computing growth & margin trends…',
    'Checking cash flow quality…',
    'Assessing balance sheet strength…',
    'Tracking capital efficiency…',
    'Composing financial health verdict…',
  ],
  news: [
    'Scanning exchange announcements…',
    'Checking analyst rating changes…',
    'Reviewing insider activity…',
    'Searching for red flags…',
    'Assessing overall sentiment…',
  ],
  technical: [
    'Pulling live price & indicators…',
    'Calculating RSI & MACD…',
    'Mapping support & resistance…',
    'Checking moving averages…',
    'Analyzing volume & patterns…',
    'Building the setup…',
  ],
}

function buildQuery(template: string, name: string, symbol = ''): string {
  return template.replace(/\{name\}/g, name).replace(/\{symbol\}/g, symbol)
}

const FORMAT_SUFFIX = `

Formatting rules (strict):
- Prioritize charts and tables over plain text — whenever data has 3+ points (a trend, a comparison, a scorecard), present it as a markdown table first; still include a short text explanation alongside it, never a table/chart with zero context
- Use markdown tables with **bold column headers** for any structured data
- Use ## section headers exactly as specified in the instructions above — do not invent, skip, merge, or reorder sections
- Lead every data point with the exact figure before any explanation
- No preamble or filler phrases ("Here is…", "Based on…", "It is worth noting…", "To summarize…", "In conclusion…")
- Numbers over words; round all figures to 1 decimal place
- For Indian stocks: use ₹ crores as the unit; for US stocks: use $ millions or billions

Data integrity rules (strict):
- Always state the source period for every figure (e.g. FY24, Q3 FY25, TTM as of Mar 2025) — never leave a number without its period
- Always use the most recently available data as of today — if FY25 results are published, use FY25 as the base year; do NOT default to older periods when newer data exists
- If a data point is unavailable, write "N/A — not disclosed" rather than omitting it
- When multiple figures for the same metric appear across different sources, use the company's official filing as the authoritative source and state which filing you used

Source rules (strict — reliability over quantity):
- For Indian stocks: use only BSE/NSE exchange filings, company annual reports and investor presentations, SEBI disclosures, Screener.in, Moneycontrol, Economic Times Markets, RBI data
- For US stocks: use only SEC EDGAR filings, company IR pages, Yahoo Finance, Bloomberg, Reuters, WSJ
- Do NOT use random blogs, opinion aggregators, forums, or unverified third-party sites for financial figures — if Google Search grounding returns a low-quality or unverifiable result, discard it and rely on the remaining reliable sources rather than citing it anyway`

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
