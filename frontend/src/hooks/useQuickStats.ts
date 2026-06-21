import { useQuery } from '@tanstack/react-query'
import type { QuickStats } from '../api/types'
import { idbGet, idbSet } from '../utils/idbStore'

const API_URL  = (import.meta.env.VITE_API_URL ?? '') as string
const LS_PREFIX = 'qs:'
// Fundamentals (P/E, ROE, sector, etc.) don't meaningfully change day to day — a long TTL
// avoids re-running the expensive yfinance + Screener/Macrotrends/SEC fetch chain on every
// stale check. Manual refresh (ReportTab's ↻) is the intended way to pull fresher numbers
// sooner than this.
const LS_TTL    = 30 * 24 * 60 * 60 * 1000 // 30 days

function lsGet(sym: string): QuickStats | undefined {
  const entry = idbGet<{ d: QuickStats; t: number }>(LS_PREFIX + sym)
  if (!entry) return undefined
  if (Date.now() - entry.t > LS_TTL) return undefined
  return entry.d
}

function lsSet(sym: string, data: QuickStats) {
  idbSet(LS_PREFIX + sym, { d: data, t: Date.now() })
}

async function fetchQuickStats(yf_symbol: string): Promise<QuickStats> {
  const res = await fetch(`${API_URL}/api/quickstats?yf_symbol=${encodeURIComponent(yf_symbol)}`)
  if (!res.ok) throw new Error(`quickstats ${res.status}`)
  const data = await res.json()
  if (data.partial) throw new Error('partial')
  // cache successful result so it loads instantly next session
  lsSet(yf_symbol, data)
  return data
}

export function useQuickStats(yf_symbol: string, enabled: boolean) {
  const cached = yf_symbol ? lsGet(yf_symbol) : undefined

  return useQuery<QuickStats>({
    queryKey:        ['quickstats', yf_symbol],
    queryFn:         () => fetchQuickStats(yf_symbol),
    enabled:         enabled && !!yf_symbol,
    staleTime:       LS_TTL,               // 30 days — see LS_TTL comment above
    gcTime:          Infinity,
    retry:           2,
    retryDelay:      5_000,               // 5s per retry (was 15s)
    placeholderData: cached,              // show last known data instantly while fetching
  })
}
