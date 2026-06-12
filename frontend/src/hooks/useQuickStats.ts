import { useQuery } from '@tanstack/react-query'
import type { QuickStats } from '../api/types'

const API_URL  = (import.meta.env.VITE_API_URL ?? '') as string
const LS_PREFIX = 'qs:'
const LS_TTL    = 12 * 60 * 60 * 1000 // 12 hours

function lsGet(sym: string): QuickStats | undefined {
  try {
    const raw = localStorage.getItem(LS_PREFIX + sym)
    if (!raw) return undefined
    const { d, t } = JSON.parse(raw)
    if (Date.now() - t > LS_TTL) { localStorage.removeItem(LS_PREFIX + sym); return undefined }
    return d as QuickStats
  } catch { return undefined }
}

function lsSet(sym: string, data: QuickStats) {
  try { localStorage.setItem(LS_PREFIX + sym, JSON.stringify({ d: data, t: Date.now() })) } catch {}
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
    staleTime:       6 * 60 * 60 * 1000,  // 6h — refresh when stale rather than Infinity
    gcTime:          Infinity,
    retry:           2,
    retryDelay:      5_000,               // 5s per retry (was 15s)
    placeholderData: cached,              // show last known data instantly while fetching
  })
}
