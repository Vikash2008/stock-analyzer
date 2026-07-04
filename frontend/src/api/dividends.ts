const BASE = (import.meta.env.VITE_API_URL ?? '') + '/api'

// ── Raw backend response (purely symbol-scoped, no portfolio/CSV awareness) ────────────────

export interface DividendRawEvent {
  ex_date:        string
  div_per_share:  number   // in the symbol's native currency
}

export interface SymbolDividendData {
  symbol:   string
  exchange: string          // 'NSE' | 'BSE' | 'US'
  currency: 'INR' | 'USD'
  events:   DividendRawEvent[]
}

export interface DividendsBySymbolResponse {
  dividends_by_symbol: Record<string, SymbolDividendData>  // keyed by yf_symbol
  skipped_symbols: string[]   // didn't finish fetching within the batch budget
  as_of: number               // unix seconds
}

export async function fetchDividendEvents(
  yfSymbols: string[],
  forceRefresh = false,
  sinceHints?: Record<string, string>,
  closedSymbols?: string[],
): Promise<DividendsBySymbolResponse> {
  if (!yfSymbols.length) return { dividends_by_symbol: {}, skipped_symbols: [], as_of: Date.now() / 1000 }
  const params = new URLSearchParams()
  params.set('symbols', yfSymbols.join(','))
  if (forceRefresh) params.set('force_refresh', 'true')
  if (sinceHints && Object.keys(sinceHints).length) params.set('since_hints', JSON.stringify(sinceHints))
  if (closedSymbols?.length) params.set('closed_symbols', closedSymbols.join(','))
  const url = `${BASE}/dividends?${params}`
  const res = await fetch(url)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${text}`)
  }
  return res.json() as Promise<DividendsBySymbolResponse>
}

// ── Computed view-model (portfolio/segment/bucket-scoped) ───────────────────────────────────
// Produced client-side now by utils/dividends.ts's computeDividendsForScope(), not fetched from
// the backend — the shape stays the same as before so DividendsTab.tsx's rendering is unchanged.

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
}
