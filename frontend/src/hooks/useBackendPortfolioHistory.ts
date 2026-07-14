import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import type { Currency } from '../App'
import type { PortfolioSeries } from './usePortfolioHistory'
import { idbGet, idbSet } from '../utils/idbStore'
import { guardShrink, MIN_HEALTHY_POINTS, computeChartFreshness, type ChartFreshness } from '../utils/incrementalMerge'

interface RawResponse {
  dates:      string[]
  values:     number[]
  invested:   number[]
  unrealized: number[]
  realized:   number[]
  total:      number[]
  returnPct:  number[]
  xirrTrend:  { dates: string[]; values: number[] }
  dataAsOf:      number   // epoch seconds
  guardRejected: boolean
  todayMismatch: boolean
}

// Same localStorage key usePortfolio.ts reads for the main bundle fetch — this endpoint needs
// the caller's own uploaded CSV too (previously it never received it at all and always computed
// from the server's default file, regardless of who was asking).
function getCsvContent(): string | undefined {
  return localStorage.getItem('portfolio:csv') ?? undefined
}

// Cheap non-cryptographic hash — only needs to be short and stable-per-content so the local
// cache key changes when (and only when) the CSV content actually changes; doesn't need to
// match the backend's md5 (that's an internal detail of the server-side cache key).
function shortHash(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

async function fetchPortfolioHistory(
  currency: Currency,
  portfolio?: string,
  segment?:  string,
  symbol?:   string,
  bucket?:   string,
  label?:    string,
): Promise<PortfolioSeries | null> {
  const base = import.meta.env.VITE_API_URL ?? ''
  const params = new URLSearchParams({ currency })
  if (portfolio) params.set('portfolio', portfolio)
  if (segment)   params.set('segment',   segment)
  if (symbol)    params.set('symbol',    symbol)
  if (bucket)    params.set('bucket',    bucket)
  if (label)     params.set('label',     label)

  const csvContent = getCsvContent()
  const res = await fetch(
    `${base}/api/portfolio-history?${params}`,
    csvContent
      ? { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: csvContent }
      : undefined,
  )
  if (!res.ok) throw new Error(`portfolio-history ${res.status}`)
  const raw: RawResponse = await res.json()

  if (!raw.dates?.length) return null

  const dates = raw.dates.map(d => new Date(d))
  const xt    = raw.xirrTrend
  return {
    value:      { dates, values: raw.values     },
    invested:   { dates, values: raw.invested   },
    unrealized: { dates, values: raw.unrealized },
    realized:   { dates, values: raw.realized   },
    total:      { dates, values: raw.total      },
    returnPct:  { dates, values: raw.returnPct  },
    xirrTrend:  {
      dates:  xt.dates.map(d => new Date(d)),
      values: xt.values,
    },
    dataAsOf:      raw.dataAsOf * 1000,  // backend sends epoch seconds
    guardRejected: raw.guardRejected,
    todayMismatch: raw.todayMismatch,
  }
}

// Unlike the per-symbol price cache (useHistory.ts), this aggregate chart previously had no
// on-device storage at all — it lived only in React Query's in-memory cache, so closing the
// app/tab lost it entirely and reopening always paid a fresh network round-trip (even if the
// backend's own cache was still warm). Mirrors useHistory.ts's lsGet/lsSet pattern so the
// Holdings-page and Txn-page charts paint instantly from local cache on reopen, same as the
// raw price chart already does.
const LS_PREFIX = 'portfolioHist:'

// csvHash scopes both the local cache key and the query key to the caller's own uploaded CSV —
// without this, two different real users filtering to a same-named portfolio (e.g. both have a
// "Zerodha") would read/write the same local cache entry on a shared device, and switching
// which CSV is active on the same browser wouldn't invalidate the previous CSV's cached chart.
// A hash-scoped key sidesteps needing an explicit wipe-on-mismatch step (unlike usePortfolio.ts's
// wipeCsvMismatch): a different CSV naturally produces a different key, so stale data under the
// old key is simply never read again, not overwritten in place.
function lsKeyFor(csvHash: string, currency: Currency, portfolio?: string, segment?: string, symbol?: string, bucket?: string, label?: string): string {
  return `${LS_PREFIX}${csvHash}:${currency}:${portfolio ?? ''}:${segment ?? ''}:${symbol ?? ''}:${bucket ?? ''}:${label ?? ''}`
}

function lsGet(key: string): { d: PortfolioSeries; t: number } | undefined {
  return idbGet<{ d: PortfolioSeries; t: number }>(key)
}

function lsSet(key: string, data: PortfolioSeries) {
  idbSet(key, { d: data, t: Date.now() })
}

// Matches the backend's result-cache TTL (portfolio_history.py's _CACHE_TTL). Raised back to
// 30 min (2026-07-04) — the underlying daily-close price data only actually updates every 30
// min during market hours anyway (market_hours.py's is_stale gate), so polling faster than that
// doesn't get fresher data, just extra round-trips. Accepted tradeoff: the chart's "today" point
// can now visibly lag the Hero/Holding cards (which refresh every 2 min via the separate
// live-price pipeline) by up to 30 min — a manual refresh is available for anyone who needs it
// to match immediately.
// Same elapsed-time-poll + visibilitychange pattern as usePortfolio.ts/useHistory.ts/
// usePortfolioHistory.ts, not a flat refetchInterval — a flat interval is mount-relative
// (fires N minutes after mount, not N minutes after the real last fetch), which lets the
// actual gap drift up to ~2x the interval. Without this poll, staleTime alone never
// triggers a refetch on its own — it only gates whether the *next* mount/refocus-driven
// fetch is skipped, so the chart would otherwise never update while the page just sits open.
export const PORTFOLIO_CHART_REFRESH_MS = 30 * 60 * 1000

export type { ChartFreshness }

// Turns a fetched PortfolioSeries into a user-facing freshness signal — thin wrapper around the
// shared computeChartFreshness (now also used by PriceChart.tsx for the holding-level chart).
export function getChartFreshness(series: PortfolioSeries | null | undefined): ChartFreshness | null {
  if (!series) return null
  return computeChartFreshness({ ...series, dataAsOfMs: series.dataAsOf }, PORTFOLIO_CHART_REFRESH_MS)
}

export function useBackendPortfolioHistory(
  currency:  Currency,
  portfolio?: string,
  segment?:  string,
  enabled = true,
  symbol?:   string,
  bucket?:   string,
  label?:    string,
) {
  const qc = useQueryClient()
  const csvContent = getCsvContent()
  const csvHash = csvContent ? shortHash(csvContent) : 'demo'
  const queryKey = ['portfolio-history', csvHash, currency, portfolio ?? '', segment ?? '', symbol ?? '', bucket ?? '', label ?? '']
  const lsKey    = lsKeyFor(csvHash, currency, portfolio, segment, symbol, bucket, label)
  const cached   = lsGet(lsKey)

  useEffect(() => {
    if (!enabled) return
    const refetchIfStale = () => {
      const state = qc.getQueryState(queryKey)
      const lastFetch = state?.dataUpdatedAt ?? 0
      if (Date.now() - lastFetch >= PORTFOLIO_CHART_REFRESH_MS) {
        qc.refetchQueries({ queryKey, type: 'active' })
      }
    }
    // Cold mount needs its own check — visibilitychange never fires on first load.
    refetchIfStale()
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refetchIfStale()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    // Backstop for a continuously-foregrounded session: poll real elapsed time every
    // minute so the fetch always lands at the true 5-min mark, not just on tab-switch. Kept
    // as a fallback (e.g. this chart's page open with no portfolio bundle query active) —
    // the subscription below is the primary trigger now.
    const pollId = window.setInterval(refetchIfStale, 60_000)

    // Re-check (and, unlike the timer above, force it regardless of this chart's own 5-min
    // staleTime) the instant usePortfolio.ts's bundle refreshes — that's what drives
    // HoldingCard/SummaryCard's "today" numbers, on its own independent ~2-min cycle. Without
    // this, the two were "fresh within their own TTL" but not fresh at the same instant, which
    // is exactly what produced the todayMismatch class of bug this session. The backend's own
    // 5-min result cache still avoids real recomputation more than once per TTL window — this
    // just makes the frontend check in lockstep instead of on an independently-drifting timer.
    const unsubscribe = qc.getQueryCache().subscribe(event => {
      if (event.type !== 'updated') return
      if (event.query.queryKey[0] !== 'portfolio') return
      qc.refetchQueries({ queryKey, type: 'active' })
    })

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.clearInterval(pollId)
      unsubscribe()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, currency, portfolio, segment, symbol, bucket, label, csvHash, qc])

  return useQuery<PortfolioSeries | null>({
    queryKey,
    queryFn: async () => {
      const fresh = await fetchPortfolioHistory(currency, portfolio, segment, symbol, bucket, label)
      if (!fresh) return fresh
      // This endpoint doesn't support delta responses (unlike useHistory.ts) — every request
      // is a full recompute, so there's no merge step here, only the same shrink-guard applied
      // client-side: don't let a suspiciously-shorter fresh response silently overwrite good
      // cached data (shares the guardShrink helper from incrementalMerge.ts with useHistory.ts).
      const { rejected } = guardShrink(cached?.d ? { dates: cached.d.value.dates } : undefined, { dates: fresh.value.dates })
      // guardShrink only catches a truncated DATE range — it misses a same-length recompute
      // whose latest VALUE is far lower (e.g. a concurrent Refresh burst evicting entries this
      // view's symbols need from the backend's shared price_store mid-computation). Mirrors the
      // backend's own _guard_result value check so a bad low-value recompute can't become the
      // new cached truth on either side and stick around after a reload.
      const cachedLast = cached?.d?.value.values.at(-1)
      const freshLast  = fresh.value.values.at(-1)
      const valueDropped = (cached?.d?.value.dates.length ?? 0) >= MIN_HEALTHY_POINTS
        && cachedLast !== undefined && cachedLast > 0
        && freshLast !== undefined && freshLast < cachedLast * 0.5
      if ((rejected || valueDropped) && cached?.d) {
        return { ...cached.d, guardRejected: true }
      }
      lsSet(lsKey, fresh)
      return fresh
    },
    enabled,
    staleTime: PORTFOLIO_CHART_REFRESH_MS,
    gcTime:    60 * 60 * 1000,
    retry:     1,
    // Seed with the real cache timestamp (not "now") so staleTime is judged against actual
    // last-fetch time — reopening the app within the TTL window skips the network fetch
    // entirely and paints the chart immediately from the on-device copy.
    initialData:          cached?.d,
    initialDataUpdatedAt: cached?.t,
  })
}
