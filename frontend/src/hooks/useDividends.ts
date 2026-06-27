import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { fetchDividends } from '../api/dividends'
import type { DividendsData, DividendSymbol } from '../api/dividends'
import { SKIP_PORTS } from '../utils/segments'
import { idbGet, idbSet, idbDelete, idbKeys } from '../utils/idbStore'

export const STALE_MS = 5 * 60 * 1000   // 5 min
const LS_KEY   = (p: string) => p ? `dividends:cache:v2:${p}` : `dividends:cache:`

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
    // initialData (not placeholderData) + initialDataUpdatedAt seeds the query's real
    // dataUpdatedAt from the cache-write timestamp — placeholderData never sets
    // dataUpdatedAt, so it was always "instantly stale" and silently refetching (and
    // overwriting the cache timestamp to "now") on every single mount, regardless of how
    // recently dividends had actually been fetched. refetchOnMount:false then stops that
    // mount-time refetch outright — the once-a-month check in App.tsx is the only thing
    // that should trigger an automatic dividends fetch.
    initialData:          () => lsGet(LS_KEY(key)),
    initialDataUpdatedAt: () => lsGetTimestamp(LS_KEY(key)),
    staleTime: STALE_MS,
    gcTime: Infinity,
    refetchOnMount: false,
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

/** True once the global dividends cache is genuinely older than STALE_MS (or has never been
 * fetched) — a real rolling 30-day window off the actual last-fetch timestamp, replacing the
 * old calendar-month check (which could fire after just 1 day across a month boundary, or
 * sit for up to 2 months if the boundary fell right after a fetch). */
export function isDividendsAutoRefreshDue(): boolean {
  const ts = getDividendsLastFetched()
  return !ts || Date.now() - ts >= STALE_MS
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
