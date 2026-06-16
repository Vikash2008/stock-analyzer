import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchDividends } from '../api/dividends'
import type { DividendsData, DividendSymbol } from '../api/dividends'

const STALE_MS = 30 * 24 * 60 * 60 * 1000          // 30 days — matches backend disk cache TTL
const LS_KEY   = (p: string) => p ? `dividends:cache:v2:${p}` : `dividends:cache:`

function getCsvHash(): string {
  return localStorage.getItem('portfolio:csv:hash') ?? 'demo'
}

function lsGet(key: string): DividendsData | undefined {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return undefined
    const { data, ts } = JSON.parse(raw)
    if (Date.now() - ts < STALE_MS) return data as DividendsData
  } catch {}
  return undefined
}

function lsSet(key: string, data: DividendsData) {
  try { localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() })) } catch {}
}

export function useDividends(portfolio?: string) {
  const key = portfolio ?? ''
  return useQuery<DividendsData>({
    queryKey: ['dividends', key],
    queryFn: async () => {
      const data = await fetchDividends(false, portfolio, getCsvHash())
      lsSet(LS_KEY(key), data)
      return data
    },
    placeholderData: () => lsGet(LS_KEY(key)),
    staleTime: STALE_MS,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    retry: 2,
    retryDelay: 5_000,
  })
}

export function useForceRefreshDividends(portfolio?: string) {
  const qc = useQueryClient()
  const key = portfolio ?? ''
  return async () => {
    const data = await qc.fetchQuery({
      queryKey: ['dividends', key],
      queryFn: async () => {
        const d = await fetchDividends(true, portfolio, getCsvHash())
        lsSet(LS_KEY(key), d)
        return d
      },
      staleTime: 0,
    })
    return data
  }
}

/** Lookup a single symbol's dividend data from cached query state (global, no portfolio filter). */
export function useDividendForSymbol(symbol: string): DividendSymbol | undefined {
  const qc = useQueryClient()
  const data = qc.getQueryData<DividendsData>(['dividends', ''])
  return data?.by_symbol.find(s => s.symbol === symbol)
}

/** Wipe all dividend localStorage entries (call after CSV upload to force fresh fetch). */
export function clearDividendLocalCache(): void {
  const keys = Object.keys(localStorage).filter(k => k.startsWith('dividends:cache:'))
  keys.forEach(k => localStorage.removeItem(k))
}

/** Returns whether dividends should be included in returns (persisted in localStorage). */
export function getIncludeDividends(): boolean {
  return localStorage.getItem('settings.includeDividends') === 'true'
}

export function setIncludeDividends(val: boolean): void {
  localStorage.setItem('settings.includeDividends', String(val))
}

/** Returns whether FX gains should be included in returns (persisted in localStorage). */
export function getIncludeFxGains(): boolean {
  return localStorage.getItem('settings.includeFxGains') === 'true'
}

export function setIncludeFxGains(val: boolean): void {
  localStorage.setItem('settings.includeFxGains', String(val))
}
