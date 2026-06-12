import { useQuery } from '@tanstack/react-query'

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

export function useHistory(yf_symbol: string | null, start: string | null, period?: string) {
  const lsKey  = `${yf_symbol}:${period ?? start}`
  const cached = yf_symbol ? lsGet(lsKey) : undefined

  return useQuery({
    queryKey:  ['history', yf_symbol, period ?? start],
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
