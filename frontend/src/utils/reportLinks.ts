export interface SectionConfig {
  id:          string
  emoji:       string
  label:       string
  description: string
  query:       { indian: string; us: string }
}

export const SECTIONS: SectionConfig[] = [
  {
    id:          'business',
    emoji:       '📊',
    label:       'Business Overview',
    description: 'Revenue model, competitive moat, key products',
    query: {
      indian: '{name} business model: core revenue streams, competitive moat, key products and services, market position, top customers or geographies — concise bullet points, FY2025, India',
      us:     '{name} business model: core revenue streams, competitive moat, key products and services, market position, top customers or geographies — concise bullet points, 2025',
    },
  },
  {
    id:          'segments',
    emoji:       '🗂️',
    label:       'Revenue Segments',
    description: 'Segment breakdown, % contribution, YoY growth per segment',
    query: {
      indian: '{name} Q4 FY2025 investor presentation segment data site:nsearchives.nseindia.com OR site:bseindia.com. For each business segment state: revenue in INR crore, % of total revenue, YoY growth %, EBITDA margin %, key operational KPI. Present as a table. Also state total consolidated revenue and PAT. Answer directly from indexed content.',
      us:     '{name} most recent quarter earnings: for each revenue segment give (1) revenue in USD million, (2) share of total revenue %, (3) YoY growth %, (4) operating income or loss, (5) operating margin %, (6) one key segment KPI. Present as a structured table. Include total revenue, net income, and EPS.',
    },
  },
  {
    id:          'results',
    emoji:       '📈',
    label:       'Latest Results & Concall',
    description: 'Most recent quarter — numbers, guidance, concall highlights',
    query: {
      indian: `{name} {symbol} latest quarter earnings results: revenue PAT NIM margins EPS YoY QoQ segment performance management guidance key risks analyst verdict`,
      us: `{name} {symbol} latest quarter earnings results: revenue net income EPS GAAP non-GAAP operating margin FCF segment performance guidance key risks analyst verdict`,
    },
  },
  {
    id:          'catalysts',
    emoji:       '🚀',
    label:       'Growth Catalysts',
    description: 'Near-term drivers, expansion plans, tailwinds',
    query: {
      indian: '{name} growth drivers catalysts 2025 2026 expansion plans tailwinds India',
      us:     '{name} growth drivers catalysts 2025 2026 expansion plans tailwinds',
    },
  },
  {
    id:          'risks',
    emoji:       '⚠️',
    label:       'Key Risks',
    description: 'Competitive threats, regulatory, execution risks',
    query: {
      indian: '{name} key investment risks 2025 regulatory competitive threats execution India',
      us:     '{name} key investment risks 2025 regulatory competitive threats execution',
    },
  },
  {
    id:          'industry',
    emoji:       '🏭',
    label:       'Industry Outlook',
    description: 'Sector trends, market size, growth estimates',
    query: {
      indian: '{name} sector industry outlook 2025 2026 growth trends market size India',
      us:     '{name} sector industry outlook 2025 2026 growth trends market size',
    },
  },
  {
    id:          'valuation',
    emoji:       '💰',
    label:       'Valuation vs Peers',
    description: 'P/E vs direct competitors, premium/discount reasoning',
    query: {
      indian: '{name} valuation PE ratio vs peers competitors 2025 expensive cheap analyst view India',
      us:     '{name} valuation PE ratio vs peers competitors 2025 expensive cheap analyst view',
    },
  },
]

function buildQuery(template: string, name: string, symbol = ''): string {
  return template.replace(/\{name\}/g, name).replace(/\{symbol\}/g, symbol)
}

const FORMAT_SUFFIX = '\n\nFormatting rules (strict): use markdown tables with bold column headers for any structured data; use ## bold section headers; bullet points for lists; lead every number with the exact figure. No preamble, no "here is", no verbose prose. Crisp and dense — numbers over words.'

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
