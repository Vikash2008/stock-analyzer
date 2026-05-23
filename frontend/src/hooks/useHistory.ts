import { useQuery } from '@tanstack/react-query'

interface HistoryData {
  dates:  string[]
  prices: number[]
  error?: string
}

const BASE = (import.meta.env.VITE_API_URL ?? '') + '/api'

async function fetchHistory(yf_symbol: string, start: string): Promise<HistoryData> {
  const params = new URLSearchParams({ yf_symbol, start })
  const res = await fetch(`${BASE}/history?${params}`)
  if (!res.ok) throw new Error(`History API ${res.status}`)
  return res.json() as Promise<HistoryData>
}

export function useHistory(yf_symbol: string | null, start: string | null) {
  return useQuery({
    queryKey:  ['history', yf_symbol, start],
    queryFn:   () => fetchHistory(yf_symbol!, start!),
    enabled:   !!yf_symbol && !!start,
    staleTime: 60 * 60 * 1000,  // 1 hour — price history rarely changes mid-session
    retry: 1,
  })
}
