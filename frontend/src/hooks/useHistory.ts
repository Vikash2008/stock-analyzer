import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'

interface HistoryData {
  dates:      string[]
  prices:     number[]
  prev_close?: number | null
  error?:     string
}

const BASE = (import.meta.env.VITE_API_URL ?? '') + '/api'
const LS_PREFIX = 'hist:'
const LS_TTL    = 7 * 24 * 60 * 60 * 1000 // 7 days

// Exported so usePortfolioHistory.ts can share this same per-symbol cache —
// all chart surfaces (price chart, holding/portfolio 7-charts) read/write one pool.
export function lsGet(key: string): HistoryData | undefined {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key)
    if (!raw) return undefined
    const { d, t } = JSON.parse(raw)
    if (Date.now() - t > LS_TTL) { localStorage.removeItem(LS_PREFIX + key); return undefined }
    return d as HistoryData
  } catch { return undefined }
}

// Quota errors here can otherwise go silent and starve more critical writes (the React
// Query persister's portfolio cache, this same debug log) of room — evict the oldest
// chart-history entries first and retry once, instead of just swallowing the error.
function evictOldestHist(count: number) {
  const entries: { key: string; t: number }[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (!k || !k.startsWith(LS_PREFIX)) continue
    try {
      const { t } = JSON.parse(localStorage.getItem(k) ?? '{}')
      entries.push({ key: k, t: t ?? 0 })
    } catch { entries.push({ key: k, t: 0 }) }
  }
  entries.sort((a, b) => a.t - b.t)
  for (const e of entries.slice(0, count)) localStorage.removeItem(e.key)
}

export function lsSet(key: string, data: HistoryData) {
  const payload = JSON.stringify({ d: data, t: Date.now() })
  try {
    localStorage.setItem(LS_PREFIX + key, payload)
  } catch {
    try {
      evictOldestHist(20)
      localStorage.setItem(LS_PREFIX + key, payload)
    } catch {
      // still over quota after eviction — give up, same as before
    }
  }
}

async function fetchHistory(yf_symbol: string, start: string | null, period?: string): Promise<HistoryData> {
  const params = new URLSearchParams({ yf_symbol })
  if (start) params.set('start', start)
  if (period) params.set('period', period)
  const res = await fetch(`${BASE}/history?${params}`)
  if (!res.ok) throw new Error(`History API ${res.status}`)
  return res.json() as Promise<HistoryData>
}

// Proactively prefetch full history for all holdings so chart tabs open instantly.
// prefetchQuery is a no-op for symbols already cached (staleTime:Infinity).
// Called from PortfoliosPage once holdings are available.
export function usePrefetchHoldingCharts(yf_symbols: string[]) {
  const qc       = useQueryClient()
  const symbolsKey = useMemo(() => yf_symbols.slice().sort().join(','), [yf_symbols])

  useEffect(() => {
    if (!yf_symbols.length) return
    for (const sym of yf_symbols) {
      qc.prefetchQuery({
        queryKey:  ['history', sym],
        queryFn:   async () => {
          const data = await fetchHistory(sym, '2015-01-01')
          if (data.dates?.length) lsSet(`${sym}:2015-01-01`, data)
          return data
        },
        staleTime: Infinity,
        gcTime:    Infinity,
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolsKey, qc])
}

export function useHistory(yf_symbol: string | null, start: string | null, period?: string) {
  const lsKey  = `${yf_symbol}:${period ?? start}`
  const cached = yf_symbol ? lsGet(lsKey) : undefined

  return useQuery({
    queryKey:  period ? ['history', yf_symbol, period] : ['history', yf_symbol],
    queryFn:   async () => {
      const data = await fetchHistory(yf_symbol!, start, period)
      // persist to localStorage so next cold-start shows data immediately
      if (data.dates?.length) lsSet(lsKey, data)
      return data
    },
    enabled:         !!yf_symbol && (!!start || !!period),
    staleTime:       Infinity,
    gcTime:          Infinity,
    retry:           3,
    retryDelay:      20_000,
    // show localStorage cache immediately while background fetch runs
    placeholderData: cached,
  })
}
