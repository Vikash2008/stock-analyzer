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

function lsGet(key: string): HistoryData | undefined {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key)
    if (!raw) return undefined
    const { d, t } = JSON.parse(raw)
    if (Date.now() - t > LS_TTL) { localStorage.removeItem(LS_PREFIX + key); return undefined }
    return d as HistoryData
  } catch { return undefined }
}

function lsSet(key: string, data: HistoryData) {
  try { localStorage.setItem(LS_PREFIX + key, JSON.stringify({ d: data, t: Date.now() })) } catch {}
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
