const BASE = (import.meta.env.VITE_API_URL ?? '') + '/api'

export interface DividendEvent {
  ex_date: string
  shares_held: number
  div_per_share: number    // in native currency (USD for US stocks)
  div_currency: string
  amount: number           // always INR
  amount_native: number    // original currency
}

export interface DividendSymbol {
  symbol: string
  yf_symbol: string
  exchange: string
  total_dividends: number
  event_count: number
  yield_on_cost: number | null
  last_ex_date: string
  projected_annual: number
  month_pattern: number[]
  events: DividendEvent[]
}

export interface DividendTimelineEntry {
  date: string
  symbol: string
  exchange: string
  amount: number
}

export interface DividendsData {
  summary: {
    total_dividends_inr: number
    dividend_count: number
    symbols_with_dividends: number
    projected_annual_inr: number
  }
  by_symbol: DividendSymbol[]
  by_year: Record<string, number>
  by_month: Record<string, number>
  timeline: DividendTimelineEntry[]
  skipped_symbols?: string[]  // didn't finish fetching within the batch budget — served stale/no data
}

export async function fetchDividends(
  forceRefresh = false, portfolio?: string, csvHash?: string, sinceHints?: Record<string, string>,
): Promise<DividendsData> {
  const params = new URLSearchParams()
  if (forceRefresh) params.set('force_refresh', 'true')
  if (portfolio) params.set('portfolio', portfolio)
  params.set('csv_hash', csvHash ?? 'demo')
  if (sinceHints && Object.keys(sinceHints).length) params.set('since_hints', JSON.stringify(sinceHints))
  const url = `${BASE}/dividends?${params}`
  const res = await fetch(url)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${text}`)
  }
  return res.json() as Promise<DividendsData>
}
