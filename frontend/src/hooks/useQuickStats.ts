import { useQuery } from '@tanstack/react-query'
import type { QuickStats } from '../api/types'

const API_URL = (import.meta.env.VITE_API_URL ?? '') as string

async function fetchQuickStats(yf_symbol: string): Promise<QuickStats> {
  const res = await fetch(`${API_URL}/api/quickstats?yf_symbol=${encodeURIComponent(yf_symbol)}`)
  if (!res.ok) throw new Error(`quickstats ${res.status}`)
  const data = await res.json()
  if (data.partial) throw new Error('partial')
  return data
}

export function useQuickStats(yf_symbol: string, enabled: boolean) {
  return useQuery<QuickStats>({
    queryKey:   ['quickstats', yf_symbol],
    queryFn:    () => fetchQuickStats(yf_symbol),
    enabled:    enabled && !!yf_symbol,
    staleTime:  Infinity,
    gcTime:     Infinity,
    retry:      2,
    retryDelay: 15_000,
  })
}
