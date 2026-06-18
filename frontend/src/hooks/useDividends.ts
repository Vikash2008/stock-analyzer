import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { fetchDividends } from '../api/dividends'
import type { DividendsData, DividendSymbol } from '../api/dividends'
import { SKIP_PORTS } from '../utils/segments'

const STALE_MS = 30 * 24 * 60 * 60 * 1000          // 30 days — matches backend disk cache TTL
const LS_KEY   = (p: string) => p ? `dividends:cache:v2:${p}` : `dividends:cache:`
const AUTO_KEY = 'dividends:autoRefreshMonth'

function getCsvHash(): string {
  return localStorage.getItem('portfolio:csv:hash') ?? 'demo'
}

async function forceRefreshOne(qc: QueryClient, key: string, csvHash: string): Promise<DividendsData> {
  // Fetch directly rather than via qc.fetchQuery — fetchQuery dedupes by queryKey against any
  // in-flight fetch from a mounted useQuery observer for the same key (e.g. PortfoliosPage's
  // global useDividends()), which would silently swallow our forced request. Writing the result
  // straight into the cache via setQueryData sidesteps that race entirely.
  const d = await fetchDividends(true, key || undefined, csvHash)
  lsSet(LS_KEY(key), d)
  qc.setQueryData(['dividends', key], d)
  return d
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
  return () => forceRefreshOne(qc, key, getCsvHash())
}

/**
 * Force-refreshes dividends across every portfolio, prioritizing `priorityPortfolio` (or the
 * global aggregate if none given) so its query resolves first. Per-symbol yfinance data is shared
 * across portfolios, so only the priority call and the global call actually hit yfinance for new
 * symbols — the remaining named portfolios are cheap recomputes by the time they run.
 */
export function useRefreshAllDividends() {
  const qc = useQueryClient()
  return async (allPortfolios: string[], priorityPortfolio?: string) => {
    const named  = [...new Set(allPortfolios)].filter(p => !SKIP_PORTS.has(p))
    const csvHash = getCsvHash()

    const first = priorityPortfolio && named.includes(priorityPortfolio) ? priorityPortfolio : ''
    await forceRefreshOne(qc, first, csvHash)

    if (first !== '') await forceRefreshOne(qc, '', csvHash)

    const rest  = named.filter(p => p !== first)
    const CHUNK = 3
    for (let i = 0; i < rest.length; i += CHUNK) {
      await Promise.allSettled(rest.slice(i, i + CHUNK).map(p => forceRefreshOne(qc, p, csvHash)))
    }
  }
}

export function getLastDividendAutoRefreshMonth(): string | null {
  return localStorage.getItem(AUTO_KEY)
}

export function setLastDividendAutoRefreshMonth(month: string): void {
  try { localStorage.setItem(AUTO_KEY, month) } catch {}
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
