import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import type { Currency } from '../App'
import type { PortfolioSeries } from './usePortfolioHistory'
import { idbGet, idbSet } from '../utils/idbStore'
import { guardShrink, mergeDateAligned, MIN_HEALTHY_POINTS, computeChartFreshness, type ChartFreshness } from '../utils/incrementalMerge'

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
  // 2026-09-18 incremental fetch: incremental=true means `dates`/etc. only cover new days past
  // the `since` this request sent — merge onto the cached series instead of replacing it.
  // fingerprint is always present (even on a full response) — cache it for the next request.
  incremental?: boolean
  fingerprint?: string
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
  includeDivs = false,
  includeFx   = false,
  since?:      string,
  fingerprint?: string,
): Promise<(PortfolioSeries & { incremental?: boolean }) | null> {
  const base = import.meta.env.VITE_API_URL ?? ''
  const params = new URLSearchParams({ currency })
  if (portfolio) params.set('portfolio', portfolio)
  if (segment)   params.set('segment',   segment)
  if (symbol)    params.set('symbol',    symbol)
  if (bucket)    params.set('bucket',    bucket)
  if (label)     params.set('label',     label)
  if (includeDivs) params.set('include_divs', 'true')
  if (includeFx)   params.set('include_fx',   'true')
  // Only sent once we have a cached series with a fingerprint to offer — the backend falls
  // back to a full computation whenever either is missing or the fingerprint no longer matches.
  if (since && fingerprint) {
    params.set('since', since)
    params.set('fingerprint', fingerprint)
  }

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
    incremental:   raw.incremental,
    fingerprint:   raw.fingerprint,
  }
}

// ── Incremental merge (2026-09-18) ──────────────────────────────────────────────────────────
// PortfolioSeries is 6 parallel {dates,values} pairs (one per metric) sharing the same date
// axis, plus a 7th (xirrTrend) on its own monthly axis — unlike useHistory.ts's single-series
// shape, so it can't feed mergeDateAligned directly. These two helpers flatten it to the one
// shared-dates shape mergeDateAligned expects, reusing that same proven merge (its dict-keyed-
// by-date-string approach already correctly replaces, not duplicates, an overlapping date — the
// case that matters here is checking in twice in the same day, where "today" reappears in the
// delta and must overwrite the earlier-today entry, not append a duplicate).
interface FlatDailySeries {
  dates:      string[]
  values:     number[]
  invested:   number[]
  unrealized: number[]
  realized:   number[]
  total:      number[]
  returnPct:  number[]
}
const DAILY_KEYS: (keyof FlatDailySeries)[] = ['values', 'invested', 'unrealized', 'realized', 'total', 'returnPct']

function toFlatDaily(s: PortfolioSeries): FlatDailySeries {
  return {
    dates:      s.value.dates.map(d => d.toISOString().slice(0, 10)),
    values:     s.value.values,
    invested:   s.invested.values,
    unrealized: s.unrealized.values,
    realized:   s.realized.values,
    total:      s.total.values,
    returnPct:  s.returnPct.values,
  }
}

function mergeIncrementalDelta(existing: PortfolioSeries, delta: PortfolioSeries): PortfolioSeries {
  const mergedDaily = mergeDateAligned(toFlatDaily(existing), toFlatDaily(delta), DAILY_KEYS)
  const mergedXirr  = mergeDateAligned(
    { dates: existing.xirrTrend.dates.map(d => d.toISOString().slice(0, 10)), values: existing.xirrTrend.values },
    { dates: delta.xirrTrend.dates.map(d => d.toISOString().slice(0, 10)), values: delta.xirrTrend.values },
    ['values'],
  )
  const dates = mergedDaily.dates.map(d => new Date(d))
  return {
    value:      { dates, values: mergedDaily.values     },
    invested:   { dates, values: mergedDaily.invested   },
    unrealized: { dates, values: mergedDaily.unrealized },
    realized:   { dates, values: mergedDaily.realized   },
    total:      { dates, values: mergedDaily.total      },
    returnPct:  { dates, values: mergedDaily.returnPct  },
    xirrTrend:  { dates: mergedXirr.dates.map(d => new Date(d)), values: mergedXirr.values },
    // Delta wins for scalar fields — same rule mergeDateAligned applies to its own array fields,
    // so "as of" always reflects this fetch, not the original cached one.
    dataAsOf:      delta.dataAsOf,
    guardRejected: delta.guardRejected,
    todayMismatch: delta.todayMismatch,
    fingerprint:   delta.fingerprint,
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
function lsKeyFor(csvHash: string, currency: Currency, portfolio?: string, segment?: string, symbol?: string, bucket?: string, label?: string, includeDivs?: boolean, includeFx?: boolean): string {
  return `${LS_PREFIX}${csvHash}:${currency}:${portfolio ?? ''}:${segment ?? ''}:${symbol ?? ''}:${bucket ?? ''}:${label ?? ''}:${includeDivs ? 1 : 0}:${includeFx ? 1 : 0}`
}

function lsGet(key: string): { d: PortfolioSeries; t: number } | undefined {
  return idbGet<{ d: PortfolioSeries; t: number }>(key)
}

function lsSet(key: string, data: PortfolioSeries) {
  idbSet(key, { d: data, t: Date.now() })
}

// Used as this chart's own staleTime (mount-time freshness check) and as the window for the
// amber-warning threshold (2x this) in getChartFreshness below. The actual refresh trigger is
// no longer an independent timer — it's the lockstep subscription to usePortfolio.ts's bundle
// query further down, which now also refreshes every 5 min (2026-09-18 unification: Overview,
// this chart, and the per-symbol price chart all follow the same 5-min cadence). Note: the
// backend's own result-cache TTL (portfolio_history.py's _CACHE_TTL) is still 30 min, kept
// deliberately unchanged — see that file's comment (past OOM incidents tied to this endpoint's
// recompute cost) — so a 5-min check-in mostly lands on a warm backend cache rather than a real
// recompute; only the frontend's own polling cadence changed here.
export const PORTFOLIO_CHART_REFRESH_MS = 5 * 60 * 1000

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
  includeDivs = false,
  includeFx   = false,
) {
  const qc = useQueryClient()
  const csvContent = getCsvContent()
  const csvHash = csvContent ? shortHash(csvContent) : 'demo'
  const queryKey = ['portfolio-history', csvHash, currency, portfolio ?? '', segment ?? '', symbol ?? '', bucket ?? '', label ?? '', includeDivs, includeFx]
  const lsKey    = lsKeyFor(csvHash, currency, portfolio, segment, symbol, bucket, label, includeDivs, includeFx)
  const cached   = lsGet(lsKey)

  // Sole refresh trigger: refetch the instant usePortfolio.ts's bundle query updates, so this
  // chart and the Hero/Holding cards are always fresh at the same instant (avoids the
  // todayMismatch class of bug a drifting independent timer produced). No separate own-schedule
  // poll — usePortfolio.ts is mounted app-wide (App.tsx's AppRoutes), so its ~5-min cycle is
  // always running and this subscription alone keeps the chart in lockstep with it.
  useEffect(() => {
    if (!enabled) return
    const unsubscribe = qc.getQueryCache().subscribe(event => {
      if (event.type !== 'updated') return
      if (event.query.queryKey[0] !== 'portfolio') return
      qc.refetchQueries({ queryKey, type: 'active' })
    })
    return () => unsubscribe()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, currency, portfolio, segment, symbol, bucket, label, includeDivs, includeFx, csvHash, qc])

  return useQuery<PortfolioSeries | null>({
    queryKey,
    queryFn: async () => {
      const cachedD = cached?.d
      // Only offered once we have a cached series with a fingerprint from a prior response —
      // fetchPortfolioHistory only sends `since` when both are present, so a first-ever fetch
      // for this scope (or one from before this fingerprint mechanism existed) is unaffected
      // and just gets today's normal full response.
      const since = cachedD?.fingerprint && cachedD.value.dates.length
        ? cachedD.value.dates[cachedD.value.dates.length - 1].toISOString().slice(0, 10)
        : undefined
      const raw = await fetchPortfolioHistory(
        currency, portfolio, segment, symbol, bucket, label, includeDivs, includeFx, since, cachedD?.fingerprint,
      )
      if (!raw) return raw
      // Merge BEFORE the shrink-guard below — an incremental response is deliberately short
      // (only new dates), so comparing its raw length against the full cached history would
      // always look like a shrink. Merge first, then guard the merged (never-shorter) result,
      // same as the full-response path always did.
      const fresh = raw.incremental && cachedD ? mergeIncrementalDelta(cachedD, raw) : raw

      // Same shrink-guard the full-response path always had: don't let a suspiciously-shorter
      // fresh response silently overwrite good cached data (shares guardShrink from
      // incrementalMerge.ts with useHistory.ts).
      const { rejected } = guardShrink(cachedD ? { dates: cachedD.value.dates } : undefined, { dates: fresh.value.dates })
      // guardShrink only catches a truncated DATE range — it misses a same-length recompute
      // whose latest VALUE is far lower (e.g. a concurrent Refresh burst evicting entries this
      // view's symbols need from the backend's shared price_store mid-computation). Mirrors the
      // backend's own _guard_result value check so a bad low-value recompute can't become the
      // new cached truth on either side and stick around after a reload.
      const cachedLast = cachedD?.value.values.at(-1)
      const freshLast  = fresh.value.values.at(-1)
      const valueDropped = (cachedD?.value.dates.length ?? 0) >= MIN_HEALTHY_POINTS
        && cachedLast !== undefined && cachedLast > 0
        && freshLast !== undefined && freshLast < cachedLast * 0.5
      if ((rejected || valueDropped) && cachedD) {
        return { ...cachedD, guardRejected: true }
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
