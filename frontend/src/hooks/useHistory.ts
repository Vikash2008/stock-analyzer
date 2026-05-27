import { useQuery } from '@tanstack/react-query'

interface HistoryData {
  dates:      string[]
  prices:     number[]
  prev_close?: number | null
  error?:     string
}

const BASE = (import.meta.env.VITE_API_URL ?? '') + '/api'

async function fetchHistory(yf_symbol: string, start: string | null, period?: string): Promise<HistoryData> {
  const params = new URLSearchParams({ yf_symbol })
  if (start) params.set('start', start)
  if (period) params.set('period', period)
  const res = await fetch(`${BASE}/history?${params}`)
  if (!res.ok) throw new Error(`History API ${res.status}`)
  return res.json() as Promise<HistoryData>
}

export function useHistory(yf_symbol: string | null, start: string | null, period?: string) {
  return useQuery({
    queryKey:  ['history', yf_symbol, period ?? start],
    queryFn:   () => fetchHistory(yf_symbol!, start, period),
    enabled:   !!yf_symbol && (!!start || !!period),
    staleTime: period === '1d' ? 5 * 60_000 : Infinity,
    gcTime:    period === '1d' ? 10 * 60_000 : Infinity,
    retry: 1,
  })
}
