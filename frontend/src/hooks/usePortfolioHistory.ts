import { useQueries, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef } from 'react'
import type { Holding } from '../api/types'
import { lsGet, lsGetStale, lsSet, lsGetTimestamp, mergeHistory, detectDrift, guardFullResponse, fetchHistory, CLOSED_LS_TTL } from './useHistory'
import { logDebug } from '../utils/debugLog'

// Separate 3-year key — isolates symbolPriceMap cache from the full-history chart cache in useHistory.ts.
const lsKey = (sym: string) => `${sym}:3y`

// This feeds symbolPriceMap for XIRR/benchmarking, not a live-quote view. Same 5-min cadence
// as everything else now (2026-09-18 unification) — used as this hook's staleTime and as the
// window the lockstep trigger below checks each symbol's own dataUpdatedAt against.
const OPEN_REFRESH_MS = 5 * 60 * 1000

async function fetchSymHistory(sym: string, start: string) {
  const startedAt = Date.now()
  const existing = lsGet(lsKey(sym))
  const cacheState = existing?.dates?.length ? `warm(${existing.dates.length}pts)` : 'COLD(no cache)'
  logDebug(`SYNC-BAR FETCH START ${sym} — ${cacheState}`)
  try {
    const since = existing?.dates?.[existing.dates.length - 1]
    const fetched = await fetchHistory(sym, start, undefined, since)
    if (!fetched.dates?.length) {
      // Cache the empty result too (e.g. a delisted symbol yfinance will never have data for) —
      // otherwise this never gets an lsSet call, initialData never finds anything on the next
      // boot, and every single reopen re-pays the backend's full ~20s yfinance timeout for a
      // symbol that will never resolve. An empty cached entry still satisfies hasAllData via
      // initialData, so the sync bar doesn't block on it again.
      const empty = { dates: [] as string[], prices: [] as number[] }
      lsSet(lsKey(sym), empty)
      logDebug(`SYNC-BAR FETCH END ${sym} — ${Date.now() - startedAt}ms — empty response (cached)`)
      return empty
    }
    let d = fetched
    if (fetched.partial_since && existing?.dates?.length) {
      d = detectDrift(existing, fetched)
        ? await fetchHistory(sym, start)  // basis shifted — discard cache, refetch clean
        : mergeHistory(existing, fetched)
    } else {
      d = guardFullResponse(existing ?? lsGetStale(lsKey(sym)), fetched, sym)
    }
    lsSet(lsKey(sym), d)
    logDebug(`SYNC-BAR FETCH END ${sym} — ${Date.now() - startedAt}ms — ${d.dates?.length ?? 0} pts`)
    return d
  } catch (e) {
    logDebug(`SYNC-BAR FETCH ERROR ${sym} — ${Date.now() - startedAt}ms — ${e instanceof Error ? e.message : e}`)
    throw e
  }
}

export interface DatedSeries { dates: Date[]; values: number[] }

export interface PortfolioSeries {
  value:      DatedSeries
  invested:   DatedSeries
  unrealized: DatedSeries
  realized:   DatedSeries
  total:      DatedSeries
  returnPct:  DatedSeries
  xirrTrend:  DatedSeries
  // When this data was genuinely last computed fresh — distinct from the query's own
  // dataUpdatedAt, which can be more recent than this if the backend rejected a suspicious
  // update and kept serving prior data (see guardRejected below).
  dataAsOf:      number
  guardRejected: boolean  // backend's shrink-guard rejected an update and kept prior data
  todayMismatch: boolean  // the historical build-up disagreed with the live total for "today"
  // Fingerprint of the transactions this series was computed from, through its last date —
  // cached alongside the series and sent back on the next request (useBackendPortfolioHistory.ts)
  // so the backend can verify nothing at-or-before that date changed before trusting a
  // new-dates-only (incremental) computation instead of a full recompute. Undefined for a
  // response that didn't include one (e.g. this hook's own per-symbol usage, a different
  // endpoint that has no such concept).
  fingerprint?: string
}

const RANGE_DAYS: Record<string, number> = {
  '1m': 30, '3m': 90, '6m': 182, '1y': 365, '2y': 730, '3y': 1095, '5y': 1825,
}

export function sliceSeries(s: DatedSeries, range: string): DatedSeries | null {
  if (!s.dates.length) return null
  if (range === 'All') return s
  const cutoff = new Date(Date.now() - RANGE_DAYS[range] * 86_400_000)
  const i = s.dates.findIndex(d => d >= cutoff)
  return i < 0 ? null : { dates: s.dates.slice(i), values: s.values.slice(i) }
}

// Raw per-symbol price fetch + symbolPriceMap only — the aggregate Value/Invested/etc.
// series computation that used to live here moved to the backend (portfolio_history.py,
// via useBackendPortfolioHistory) so both the Holdings-page and Txn-page charts share one
// engine instead of duplicating the same math in TypeScript and Python.
export function usePortfolioHistory(
  holdings:      Holding[],
  enabled:       boolean,
  extraSymbols?:    string[],  // additional symbols to fetch for symbolPriceMap (e.g. closed positions)
  closedSymbols?:   string[],  // subset of (holdings yf_symbols ∪ extraSymbols) that are fully exited
  prioritySymbols?: string[],  // symbols belonging to the currently active view — fetched first
) {
  const qc = useQueryClient()
  const closedSet = useMemo(() => new Set(closedSymbols ?? []), [closedSymbols])

  const symbols = useMemo(() => {
    const all = [...new Set([...holdings.map(h => h.yf_symbol), ...(extraSymbols ?? [])])]
    if (!prioritySymbols?.length) return all
    const prioritySet = new Set(prioritySymbols)
    // Reorder so priority symbols' queries are issued first — both the browser's
    // connection pool and the backend's concurrency cap then naturally service them first.
    return [...all.filter(s => prioritySet.has(s)), ...all.filter(s => !prioritySet.has(s))]
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdings, extraSymbols, prioritySymbols])

  // One-shot summary per distinct symbol set — tells us, the instant this hook sees a symbol
  // list (e.g. right after reopening the app), exactly which symbols are already cached vs which
  // will force a real network fetch, before any fetch has actually started. Correlate this
  // against the SYNC-BAR FETCH START/END lines to see whether it's always the same stragglers
  // (real fetch-side slowness/eviction) or a different random few each time (a cache/write issue).
  const loggedSymbolsKeyRef = useRef<string>('')
  const symbolsKeyForLog = useMemo(() => symbols.slice().sort().join(','), [symbols])
  useEffect(() => {
    if (!enabled || !symbols.length || symbolsKeyForLog === loggedSymbolsKeyRef.current) return
    loggedSymbolsKeyRef.current = symbolsKeyForLog
    const missing = symbols.filter(sym => {
      const isClosed = closedSet.has(sym)
      return !lsGet(lsKey(sym), isClosed ? CLOSED_LS_TTL : undefined)
    })
    logDebug(`SYNC-BAR MOUNT — ${symbols.length} symbols total, ${symbols.length - missing.length} cached, ${missing.length} MISSING: ${missing.join(', ') || '(none)'}`)
  }, [enabled, symbols, symbolsKeyForLog, closedSet])

  const queries = useQueries({
    queries: symbols.map(sym => {
      const isClosed = closedSet.has(sym)
      return {
        queryKey:  isClosed ? ['history-closed', sym] : ['history', sym],
        queryFn:   () => fetchSymHistory(sym, '2022-01-01'),
        // Closed symbols: skip the network entirely once a still-fresh (<30 day) cache exists.
        enabled:   enabled && (!isClosed || !lsGet(lsKey(sym), CLOSED_LS_TTL)),
        staleTime:    isClosed ? CLOSED_LS_TTL : OPEN_REFRESH_MS,
        gcTime:       Infinity,  // keep in memory for entire session
        // No refetchInterval here — a flat interval is mount-relative (fires N minutes after
        // mount, not N minutes after the real last fetch), which lets the actual gap drift up
        // to ~2x OPEN_REFRESH_MS. The elapsed-time poll below checks against the real dataUpdatedAt
        // instead, so a fetch only ever happens once OPEN_REFRESH_MS has truly passed.
        retry:        2,
        retryDelay:   8_000,
        retryOnMount: false,     // error-state queries stay counted on navigation; avoids backwards counter
        // Without this, React Query's default refetch-on-mount-if-stale silently refetches
        // as soon as the app reopens with cache older than OPEN_REFRESH_MS, instantly overwriting
        // dataUpdatedAt to "now" before the user ever sees the cache's true age. The
        // elapsed-time poll + visibilitychange handler below already cover staleness
        // while the app stays open — mount itself should never force it.
        refetchOnMount: false,
        // Open symbols: seed with the real cache timestamp so staleTime is judged against
        // actual last-fetch time — on app reopen within OPEN_REFRESH_MS this skips the fetch
        // entirely instead of always kicking one off in the background (placeholderData's behavior).
        // Closed symbols keep placeholderData — their fetch is already gated off by `enabled`
        // above once a fresh cache exists, so there's nothing for initialData to skip.
        ...(isClosed
          ? { placeholderData: () => lsGet(lsKey(sym), CLOSED_LS_TTL) }
          : {
              initialData:          () => lsGet(lsKey(sym)),
              initialDataUpdatedAt: () => lsGetTimestamp(lsKey(sym)),
            }),
      }
    }),
  })

  // Mobile browsers suspend JS timers when screen locks or app backgrounds — same
  // visibilitychange + elapsed-check pattern usePortfolio.ts/useHistory.ts use.
  const openSymbolsKey = useMemo(
    () => symbols.filter(s => !closedSet.has(s)).slice().sort().join(','),
    [symbols, closedSet],
  )
  // Sole refresh trigger: refetch stale open-symbol queries the instant usePortfolio.ts's
  // bundle query updates, in lockstep with it (2026-09-18) instead of an independent poll —
  // that query is mounted app-wide (App.tsx's AppRoutes) so its ~5-min cycle is always
  // running. refetchOnMount is off (see queries config above), so a cold reopen still needs
  // its own check here — the subscription's initial "already have data" state doesn't cover
  // that, so this fires once immediately too, same as before.
  useEffect(() => {
    if (!enabled || !openSymbolsKey) return
    const openSymbols = openSymbolsKey.split(',')
    const refetchStaleSymbols = () => {
      for (const sym of openSymbols) {
        const state = qc.getQueryState(['history', sym])
        const lastFetch = state?.dataUpdatedAt ?? 0
        if (Date.now() - lastFetch >= OPEN_REFRESH_MS) {
          qc.refetchQueries({ queryKey: ['history', sym], type: 'active' })
        }
      }
    }
    refetchStaleSymbols()
    const unsubscribe = qc.getQueryCache().subscribe(event => {
      if (event.type !== 'updated') return
      if (event.query.queryKey[0] !== 'portfolio') return
      refetchStaleSymbols()
    })
    return () => unsubscribe()
  }, [enabled, openSymbolsKey, qc])

  const loadedCount   = queries.filter(q => q.status === 'success' || q.status === 'error').length
  const fetchingCount = queries.filter(q => q.fetchStatus === 'fetching').length
  const isFetching    = fetchingCount > 0
  // Real last-fetch time across OPEN symbols' queries only (each seeded with the actual cache
  // timestamp via initialDataUpdatedAt above) — not "now", so reopening the app with a cache
  // that's hours old shows its true age instead of looking freshly synced. Closed symbols are
  // excluded: they intentionally fetch fresh on mount whenever their own cache is stale/missing
  // (a different cadence from the 30-min open-symbol refresh cycle), so including them would let
  // a single closed-holding fetch make this look "just synced" regardless of the open symbols' age.
  const lastFetchedAt = symbols.reduce(
    (max, sym, i) => closedSet.has(sym) ? max : Math.max(max, queries[i].dataUpdatedAt ?? 0),
    0,
  ) || null
  // "Nothing to show yet" — true only when at least one symbol has neither a real/cached
  // result nor has finished failing. A symbol that errors out (no cache, retries exhausted —
  // e.g. a transient mobile network drop) counts as resolved too, so one bad symbol doesn't
  // wedge the progress bar on screen forever; the chart just renders without that symbol.
  const hasAllData    = symbols.length > 0 && queries.every(q => q.data !== undefined || q.status === 'error')
  const isLoading     = enabled && symbols.length > 0 && !hasAllData

  // Marks when the sync bar (histLoading in HoldingsPage.tsx) actually clears — pairs with the
  // SYNC-BAR MOUNT line above so the two timestamps give real end-to-end wall-clock time from
  // reopen to "done".
  const wasLoadingRef = useRef(false)
  useEffect(() => {
    if (wasLoadingRef.current && !isLoading) {
      logDebug(`SYNC-BAR CLEARED — all ${symbols.length} symbols resolved`)
    }
    wasLoadingRef.current = isLoading
  }, [isLoading, symbols.length])

  // Built from whatever queries have data — allows showing cached series while refetching
  const symbolPriceMap = useMemo((): Map<string, Map<string, number>> => {
    if (!enabled) return new Map()
    const pm = new Map<string, Map<string, number>>()
    for (let i = 0; i < symbols.length; i++) {
      const d = queries[i]?.data
      if (!d?.dates.length) continue
      const m = new Map<string, number>()
      d.dates.forEach((dt, j) => m.set(dt, d.prices[j]))
      pm.set(symbols[i], m)
    }
    return pm
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, isFetching, loadedCount, symbols])

  return { isLoading, isFetching, loadedCount, totalCount: symbols.length, fetchingCount, symbolPriceMap, lastFetchedAt }
}
