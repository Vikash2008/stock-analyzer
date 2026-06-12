import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchDividends } from '../api/dividends'
import type { DividendsData, DividendSymbol } from '../api/dividends'

const STALE_MS = 24 * 60 * 60 * 1000  // 24h — mirrors backend cache TTL

export function useDividends(portfolio?: string) {
  return useQuery<DividendsData>({
    queryKey: ['dividends', portfolio ?? ''],
    queryFn: () => fetchDividends(false, portfolio),
    staleTime: STALE_MS,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    retry: 2,
    retryDelay: 5_000,
  })
}

export function useForceRefreshDividends(portfolio?: string) {
  const qc = useQueryClient()
  return () =>
    qc.fetchQuery({
      queryKey: ['dividends', portfolio ?? ''],
      queryFn: () => fetchDividends(true, portfolio),
      staleTime: 0,
    })
}

/** Lookup a single symbol's dividend data from cached query state (global, no portfolio filter). */
export function useDividendForSymbol(symbol: string): DividendSymbol | undefined {
  const qc = useQueryClient()
  const data = qc.getQueryData<DividendsData>(['dividends', ''])
  return data?.by_symbol.find(s => s.symbol === symbol)
}

/** Returns whether dividends should be included in returns (persisted in localStorage). */
export function getIncludeDividends(): boolean {
  return localStorage.getItem('settings.includeDividends') === 'true'
}

export function setIncludeDividends(val: boolean): void {
  localStorage.setItem('settings.includeDividends', String(val))
}
