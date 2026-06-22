import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
import { idbGet, idbSet } from '../utils/idbStore'

interface HistoryData {
  dates:      string[]
  prices:     number[]
  prev_close?: number | null
  error?:     string
  partial_since?: string  // delta-only response — merge into existing cache, don't replace
}

// Merge a delta-only (`partial_since`) response into an existing cached entry — same
// dedupe-by-date-then-sort pattern the backend itself uses to merge incremental fetches.
// Exported so usePortfolioHistory.ts's separate fetch path can reuse it too.
export function mergeHistory(existing: HistoryData, delta: HistoryData): HistoryData {
  const merged: Record<string, number> = {}
  existing.dates.forEach((d, i) => { merged[d] = existing.prices[i] })
  delta.dates.forEach((d, i) => { merged[d] = delta.prices[i] })
  const dates = Object.keys(merged).sort()
  return { dates, prices: dates.map(d => merged[d]), prev_close: delta.prev_close ?? existing.prev_close }
}

// The backend always re-fetches the boundary bar (the `since` date itself, or the last
// cached bar) even on a delta-only response — so a delta always overlaps the cache by at
// least one date. yfinance re-applies split/bonus adjustments retroactively across a
// symbol's *entire* history on every download, so if a split happened since the cache was
// written, that overlap date's price comes back changed too. Comparing it catches the rebase
// without ever needing a routine full re-fetch — incremental stays the steady-state path,
// this only fires the rare time a real corporate action invalidates the old cache's basis.
export function detectDrift(existing: HistoryData, delta: HistoryData): boolean {
  const deltaPrice = new Map(delta.dates.map((d, i) => [d, delta.prices[i]]))
  for (let i = 0; i < existing.dates.length; i++) {
    const dv = deltaPrice.get(existing.dates[i])
    if (dv === undefined) continue
    const ev = existing.prices[i]
    if (ev > 0 && Math.abs(dv - ev) / ev > 0.005) return true
  }
  return false
}

const BASE = (import.meta.env.VITE_API_URL ?? '') + '/api'
const LS_PREFIX = 'hist:'
const LS_TTL        = 7 * 24 * 60 * 60 * 1000  // 7 days — open/default holdings
export const CLOSED_LS_TTL = 30 * 24 * 60 * 60 * 1000  // 30 days — fully-exited holdings

// Same cadence as the portfolio price sync (usePortfolio.ts) — keep both auto-refresh
// loops on one consistent mental model even though they remain separate triggers.
export const REFRESH_MS = 30 * 60 * 1000

function readLsEntry(key: string, ttlMs: number): { d: HistoryData; t: number } | undefined {
  const entry = idbGet<{ d: HistoryData; t: number }>(LS_PREFIX + key)
  if (!entry) return undefined
  if (Date.now() - entry.t > ttlMs) return undefined
  return entry
}

// Exported so usePortfolioHistory.ts can share this same per-symbol cache —
// all chart surfaces (price chart, holding/portfolio 7-charts) read/write one pool.
export function lsGet(key: string, ttlMs: number = LS_TTL): HistoryData | undefined {
  return readLsEntry(key, ttlMs)?.d
}

// Real wall-clock timestamp the cached entry was written — fed to React Query as
// `initialDataUpdatedAt` so staleTime is judged against the actual last-fetch time
// instead of "just mounted" (which would otherwise look stale on every app reopen).
export function lsGetTimestamp(key: string, ttlMs: number = LS_TTL): number | undefined {
  return readLsEntry(key, ttlMs)?.t
}

export function lsSet(key: string, data: HistoryData) {
  idbSet(LS_PREFIX + key, { d: data, t: Date.now() })
}

// Exported so usePortfolioHistory.ts's separate fetch path can reuse it (and so a detected
// drift can be repaired with a clean `since`-less full fetch without duplicating this call).
export async function fetchHistory(yf_symbol: string, start: string | null, period?: string, since?: string): Promise<HistoryData> {
  const params = new URLSearchParams({ yf_symbol })
  if (start) params.set('start', start)
  if (period) params.set('period', period)
  if (since) params.set('since', since)
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
    let cancelled = false
    const BATCH = 20  // firing all ~150-200 requests at once piles up pending connections on
                       // the backend during a cold-cache burst; the backend's own concurrency
                       // limit already gates real throughput, so batching here just avoids
                       // having that many requests in flight simultaneously, with no added delay.
    async function run() {
      for (let i = 0; i < yf_symbols.length; i += BATCH) {
        if (cancelled) return
        const batch = yf_symbols.slice(i, i + BATCH)
        await Promise.allSettled(batch.map(sym => qc.prefetchQuery({
          queryKey:  ['history', sym],
          queryFn:   async () => {
            const lsk = `${sym}:2015-01-01`
            const existing = lsGet(lsk)
            const since = existing?.dates?.[existing.dates.length - 1]
            const fetched = await fetchHistory(sym, '2015-01-01', undefined, since)
            let data = fetched
            if (fetched.partial_since && existing?.dates?.length) {
              data = detectDrift(existing, fetched)
                ? await fetchHistory(sym, '2015-01-01')  // basis shifted — discard cache, refetch clean
                : mergeHistory(existing, fetched)
            }
            if (data.dates?.length) lsSet(lsk, data)
            return data
          },
          staleTime: Infinity,
          gcTime:    Infinity,
        })))
      }
    }
    run()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolsKey, qc])
}

export function useHistory(yf_symbol: string | null, start: string | null, period?: string, isClosed?: boolean) {
  const qc      = useQueryClient()
  const lsKey   = `${yf_symbol}:${period ?? start}`
  const ttl     = isClosed ? CLOSED_LS_TTL : LS_TTL
  const cached  = yf_symbol ? lsGet(lsKey, ttl) : undefined
  const queryKey = period ? ['history', yf_symbol, period] : ['history', yf_symbol]

  // Closed holdings fetch fresh on every mount (per the Price chart's own "did I just
  // open this stock" trigger) but don't keep auto-ticking every 30 min while viewed.
  const autoRefresh = !isClosed

  // Mobile browsers suspend JS timers when screen locks or app backgrounds — same
  // visibilitychange + elapsed-check pattern usePortfolio.ts uses for price sync.
  useEffect(() => {
    if (!autoRefresh || !yf_symbol) return
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return
      const state = qc.getQueryState(queryKey)
      const lastFetch = state?.dataUpdatedAt ?? 0
      if (Date.now() - lastFetch >= REFRESH_MS) {
        qc.refetchQueries({ queryKey, type: 'active' })
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, yf_symbol, period, start])

  return useQuery({
    queryKey,
    queryFn:   async () => {
      // Intraday entries key off time-of-day strings, not calendar dates — only
      // meaningful to hint `since` on the daily-history path.
      const since = !period ? cached?.dates?.[cached.dates.length - 1] : undefined
      const fetched = await fetchHistory(yf_symbol!, start, period, since)
      let data = fetched
      if (fetched.partial_since && cached?.dates?.length) {
        data = detectDrift(cached, fetched)
          ? await fetchHistory(yf_symbol!, start, period)  // basis shifted — discard cache, refetch clean
          : mergeHistory(cached, fetched)
      }
      // persist to localStorage so next cold-start shows data immediately
      if (data.dates?.length) lsSet(lsKey, data)
      return data
    },
    enabled:         !!yf_symbol && (!!start || !!period),
    staleTime:       autoRefresh ? REFRESH_MS : Infinity,
    gcTime:          Infinity,
    refetchInterval:             autoRefresh ? REFRESH_MS : false,
    refetchIntervalInBackground: false,
    retry:           3,
    retryDelay:      20_000,
    // Open symbols: seed with the real cache timestamp so React Query's own staleTime
    // check decides whether a fetch is needed (skips it entirely if cache is <30min old —
    // previously placeholderData always kicked off a background fetch regardless of age).
    // Closed symbols intentionally always fetch fresh on mount — keep placeholderData there.
    ...(autoRefresh
      ? { initialData: cached, initialDataUpdatedAt: yf_symbol ? lsGetTimestamp(lsKey, ttl) : undefined }
      : { placeholderData: cached }),
  })
}
