import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'

interface HistoryData {
  dates:      string[]
  prices:     number[]
  prev_close?: number | null
  error?:     string
}

const BASE = (import.meta.env.VITE_API_URL ?? '') + '/api'
const LS_PREFIX = 'hist:'
const LS_TTL        = 7 * 24 * 60 * 60 * 1000  // 7 days — open/default holdings
export const CLOSED_LS_TTL = 30 * 24 * 60 * 60 * 1000  // 30 days — fully-exited holdings

// Same cadence as the portfolio price sync (usePortfolio.ts) — keep both auto-refresh
// loops on one consistent mental model even though they remain separate triggers.
export const REFRESH_MS = 30 * 60 * 1000

function readLsEntry(key: string, ttlMs: number): { d: HistoryData; t: number } | undefined {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key)
    if (!raw) return undefined
    const { d, t } = JSON.parse(raw)
    if (Date.now() - t > ttlMs) { localStorage.removeItem(LS_PREFIX + key); return undefined }
    return { d, t }
  } catch { return undefined }
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

// Quota errors here can otherwise go silent and starve more critical writes (the React
// Query persister's portfolio cache, this same debug log) of room — evict the oldest
// chart-history entries first and retry once, instead of just swallowing the error.
function evictOldestHist(count: number) {
  const entries: { key: string; t: number }[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (!k || !k.startsWith(LS_PREFIX)) continue
    try {
      const { t } = JSON.parse(localStorage.getItem(k) ?? '{}')
      entries.push({ key: k, t: t ?? 0 })
    } catch { entries.push({ key: k, t: 0 }) }
  }
  entries.sort((a, b) => a.t - b.t)
  for (const e of entries.slice(0, count)) localStorage.removeItem(e.key)
}

export function lsSet(key: string, data: HistoryData) {
  const payload = JSON.stringify({ d: data, t: Date.now() })
  try {
    localStorage.setItem(LS_PREFIX + key, payload)
  } catch {
    try {
      evictOldestHist(20)
      localStorage.setItem(LS_PREFIX + key, payload)
    } catch {
      // still over quota after eviction — give up, same as before
    }
  }
}

async function fetchHistory(yf_symbol: string, start: string | null, period?: string): Promise<HistoryData> {
  const params = new URLSearchParams({ yf_symbol })
  if (start) params.set('start', start)
  if (period) params.set('period', period)
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
    for (const sym of yf_symbols) {
      qc.prefetchQuery({
        queryKey:  ['history', sym],
        queryFn:   async () => {
          const data = await fetchHistory(sym, '2015-01-01')
          if (data.dates?.length) lsSet(`${sym}:2015-01-01`, data)
          return data
        },
        staleTime: Infinity,
        gcTime:    Infinity,
      })
    }
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
      const data = await fetchHistory(yf_symbol!, start, period)
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
