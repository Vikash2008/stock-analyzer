import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import type { Currency } from '../App'
import type { PortfolioSeries } from './usePortfolioHistory'
import { idbGet, idbSet } from '../utils/idbStore'

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

async function fetchPortfolioHistory(
  currency: Currency,
  portfolio?: string,
  segment?:  string,
  symbol?:   string,
): Promise<PortfolioSeries | null> {
  const base = import.meta.env.VITE_API_URL ?? ''
  const params = new URLSearchParams({ currency })
  if (portfolio) params.set('portfolio', portfolio)
  if (segment)   params.set('segment',   segment)
  if (symbol)    params.set('symbol',    symbol)

  const res = await fetch(`${base}/api/portfolio-history?${params}`)
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

function lsKeyFor(currency: Currency, portfolio?: string, segment?: string, symbol?: string): string {
  return `${LS_PREFIX}${currency}:${portfolio ?? ''}:${segment ?? ''}:${symbol ?? ''}`
}

function lsGet(key: string): { d: PortfolioSeries; t: number } | undefined {
  return idbGet<{ d: PortfolioSeries; t: number }>(key)
}

function lsSet(key: string, data: PortfolioSeries) {
  idbSet(key, { d: data, t: Date.now() })
}

// Matches the backend's 5-min result-cache TTL (portfolio_history.py's _CACHE_TTL — shortened
// from 30 min once the backend's own price fetch became incremental, see that file's comment).
// Same elapsed-time-poll + visibilitychange pattern as usePortfolio.ts/useHistory.ts/
// usePortfolioHistory.ts, not a flat refetchInterval — a flat interval is mount-relative
// (fires N minutes after mount, not N minutes after the real last fetch), which lets the
// actual gap drift up to ~2x the interval. Without this poll, staleTime alone never
// triggers a refetch on its own — it only gates whether the *next* mount/refocus-driven
// fetch is skipped, so the chart would otherwise never update while the page just sits open.
export const PORTFOLIO_CHART_REFRESH_MS = 5 * 60 * 1000

export interface ChartFreshness {
  label:   string   // "As of 14:32"
  warning: boolean  // true → render with warning styling instead of plain gray
  detail?: string   // short reason appended after the label when warning is true
}

// Turns a fetched PortfolioSeries into a user-facing freshness signal — the whole point of
// dataAsOf/guardRejected/todayMismatch existing on the backend is so the UI can say "this may
// be wrong or old" instead of silently showing possibly-stale data as if it were current.
export function getChartFreshness(series: PortfolioSeries | null | undefined): ChartFreshness | null {
  if (!series) return null
  const d = new Date(series.dataAsOf)
  const label = `As of ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  if (series.guardRejected) return { label, warning: true, detail: "couldn't verify latest update" }
  if (series.todayMismatch) return { label, warning: true, detail: 'numbers may be off' }
  if (Date.now() - series.dataAsOf > 2 * PORTFOLIO_CHART_REFRESH_MS) {
    return { label, warning: true, detail: 'refresh may be delayed' }
  }
  return { label, warning: false }
}

export function useBackendPortfolioHistory(
  currency:  Currency,
  portfolio?: string,
  segment?:  string,
  enabled = true,
  symbol?:   string,
) {
  const qc = useQueryClient()
  const queryKey = ['portfolio-history', currency, portfolio ?? '', segment ?? '', symbol ?? '']
  const lsKey    = lsKeyFor(currency, portfolio, segment, symbol)
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
    // minute so the fetch always lands at the true 30-min mark, not just on tab-switch.
    const pollId = window.setInterval(refetchIfStale, 60_000)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.clearInterval(pollId)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, currency, portfolio, segment, symbol, qc])

  return useQuery<PortfolioSeries | null>({
    queryKey,
    queryFn: async () => {
      const data = await fetchPortfolioHistory(currency, portfolio, segment, symbol)
      if (data) lsSet(lsKey, data)
      return data
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
