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
      indian: '{name} business model revenue streams competitive moat 2025 concise bullet points India',
      us:     '{name} business model revenue streams competitive moat 2025 concise bullet points',
    },
  },
  {
    id:          'results',
    emoji:       '📈',
    label:       'Latest Results & Concall',
    description: 'Most recent quarter — numbers, guidance, concall highlights',
    query: {
      indian: '{name} Q4 FY2025 quarterly results concall highlights management guidance key metrics summary',
      us:     '{name} Q1 2025 earnings results guidance key metrics management commentary summary',
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

function buildQuery(template: string, name: string): string {
  return template.replace(/\{name\}/g, name)
}

export function buildPerplexityUrl(name: string, sectionId: string, isIndian: boolean): string {
  const section = SECTIONS.find(s => s.id === sectionId)
  if (!section) return 'https://www.perplexity.ai'
  const template = isIndian ? section.query.indian : section.query.us
  return `https://www.perplexity.ai/search?q=${encodeURIComponent(buildQuery(template, name))}`
}

export function buildFullReportUrl(name: string, isIndian: boolean): string {
  const ctx = isIndian ? 'India 2025' : 'US stock 2025'
  const q = `${name} comprehensive investment analysis: business model, latest quarterly results concall highlights, growth catalysts, key risks, industry outlook, valuation vs peers — concise bullet points ${ctx}`
  return `https://www.perplexity.ai/search?q=${encodeURIComponent(q)}`
}
