import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { fetchDividends } from '../api/dividends'
import type { DividendsData, DividendSymbol } from '../api/dividends'
import { SKIP_PORTS } from '../utils/segments'
import { idbGet, idbSet, idbDelete, idbKeys } from '../utils/idbStore'

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
  const d = await fetchDividends(true, key || undefined, csvHash, getSinceHints())
  lsSet(LS_KEY(key), d)
  qc.setQueryData(['dividends', key], d)
  return d
}

function lsGet(key: string): DividendsData | undefined {
  const entry = idbGet<{ data: DividendsData; ts: number }>(key)
  if (!entry) return undefined
  return Date.now() - entry.ts < STALE_MS ? entry.data : undefined
}

function lsGetTimestamp(key: string): number | undefined {
  return idbGet<{ data: DividendsData; ts: number }>(key)?.ts
}

/** Real cache-write time for a portfolio's dividends, independent of whether the current
 * render came from placeholderData or a fresh fetch — used instead of "now" so reopening the
 * app with hours/days-old cached data shows its true age, not a freshly-synced look. */
export function getDividendsLastFetched(portfolio?: string): number | undefined {
  return lsGetTimestamp(LS_KEY(portfolio ?? ''))
}

function lsSet(key: string, data: DividendsData) {
  idbSet(key, { data, ts: Date.now() })
}

/** Per-symbol last-known ex-date from whatever's already cached (the global aggregate covers
 * every symbol across every portfolio). Sent to the backend so a cold backend-side cache
 * (e.g. right after a Render redeploy) can fetch incrementally from this date instead of
 * re-pulling full history — this browser's IndexedDB is the real long-term store either way. */
function getSinceHints(): Record<string, string> {
  const global = lsGet(LS_KEY(''))
  if (!global) return {}
  const out: Record<string, string> = {}
  for (const s of global.by_symbol) out[s.yf_symbol] = s.last_ex_date
  return out
}

export function useDividends(portfolio?: string) {
  const key = portfolio ?? ''
  return useQuery<DividendsData>({
    queryKey: ['dividends', key],
    queryFn: async () => {
      const data = await fetchDividends(false, portfolio, getCsvHash(), getSinceHints())
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
/** Returns the deduped list of symbols that didn't finish fetching within any call's batch
 * budget (backend's `skipped_symbols`) — caller surfaces this so a refresh that silently
 * served stale/no data for some symbols doesn't look identical to a clean one. */
export function useRefreshAllDividends() {
  const qc = useQueryClient()
  return async (allPortfolios: string[], priorityPortfolio?: string): Promise<string[]> => {
    const named  = [...new Set(allPortfolios)].filter(p => !SKIP_PORTS.has(p))
    const csvHash = getCsvHash()
    const skipped = new Set<string>()
    const note = (d: DividendsData) => d.skipped_symbols?.forEach(s => skipped.add(s))

    const first = priorityPortfolio && named.includes(priorityPortfolio) ? priorityPortfolio : ''
    note(await forceRefreshOne(qc, first, csvHash))

    if (first !== '') note(await forceRefreshOne(qc, '', csvHash))

    const rest  = named.filter(p => p !== first)
    const CHUNK = 3
    for (let i = 0; i < rest.length; i += CHUNK) {
      const results = await Promise.allSettled(rest.slice(i, i + CHUNK).map(p => forceRefreshOne(qc, p, csvHash)))
      results.forEach(r => { if (r.status === 'fulfilled') note(r.value) })
    }
    return [...skipped]
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

/** Wipe all dividend cache entries (call after CSV upload to force fresh fetch). */
export function clearDividendLocalCache(): void {
  idbKeys('dividends:cache:').forEach(k => idbDelete(k))
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
