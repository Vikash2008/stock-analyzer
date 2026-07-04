import { useMemo, useSyncExternalStore } from 'react'
import { fetchDividendEvents } from '../api/dividends'
import type { SymbolDividendData, DividendSymbol } from '../api/dividends'
import type { Transaction } from '../api/types'
import { idbGet, idbSet, idbDelete, idbKeys } from '../utils/idbStore'
import { computeDividendsForScope } from '../utils/dividends'

const EVENTS_KEY = 'dividends:events:v1'
const BATCH = 10

// ── Shared module-level store ────────────────────────────────────────────────────────────────
// One dividend dataset, one in-flight refresh, observed by every component (Settings-popover
// button, DividendsTab, PortfoliosPage tiles, TransactionsPage) via useSyncExternalStore — not
// React state, so a refresh survives whichever component happened to trigger it unmounting, and
// every observer sees the exact same progress instead of each hook call tracking its own copy.
// Replaces the old dual pipeline (useDividends/forceRefreshOne/useRefreshAllDividends +
// useDividendsBatched) that fetched/cached the same data two different, portfolio-scoped ways.

interface DividendEventsState {
  data:          Record<string, SymbolDividendData> | undefined  // keyed by yf_symbol
  lastFetchedAt: number | undefined
  isFetching:    boolean
  isError:       boolean
  loadedCount:   number
  totalCount:    number
}

let state: DividendEventsState = {
  data: undefined, lastFetchedAt: undefined,
  isFetching: false, isError: false, loadedCount: 0, totalCount: 0,
}
let hydrated = false
const listeners = new Set<() => void>()

function setState(patch: Partial<DividendEventsState>) {
  state = { ...state, ...patch }
  listeners.forEach(l => l())
}
function subscribe(cb: () => void) { listeners.add(cb); return () => listeners.delete(cb) }
function getSnapshot() { return state }

function hydrateFromCache() {
  if (hydrated) return
  hydrated = true
  const cached = idbGet<{ data: Record<string, SymbolDividendData>; ts: number }>(EVENTS_KEY)
  if (cached) setState({ data: cached.data, lastFetchedAt: cached.ts })
}

/** Per-symbol last-known ex-date from whatever's cached — sent to the backend so a cold
 * backend-side cache (e.g. right after a redeploy) can fetch incrementally from this date
 * instead of re-pulling full history. */
function getSinceHints(cached: Record<string, SymbolDividendData>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [yf, d] of Object.entries(cached)) {
    if (d.events.length) out[yf] = d.events[d.events.length - 1].ex_date
  }
  return out
}

let inFlight: Promise<string[]> | null = null

/**
 * The only way dividend data is ever fetched — always manual, never automatic. Fetches every
 * symbol in `yfSymbols` in batches of 10, with `prioritySymbols` (the caller's current view)
 * issued first, so the portfolio you're actually looking at resolves before the rest of the
 * app's holdings. A second call while one is already running just observes the first — no
 * duplicate concurrent refresh.
 *
 * Returns the deduped list of symbols that didn't finish within any batch's budget (backend's
 * `skipped_symbols`), so a refresh that silently served stale/no data for some symbols doesn't
 * look identical to a clean one.
 */
export async function refreshDividendEvents(yfSymbols: string[], prioritySymbols: string[] = []): Promise<string[]> {
  if (inFlight) return inFlight
  hydrateFromCache()

  const prioritySet = new Set(prioritySymbols)
  const ordered = [
    ...yfSymbols.filter(s => prioritySet.has(s)),
    ...yfSymbols.filter(s => !prioritySet.has(s)),
  ]
  if (!ordered.length) return []

  const run = (async (): Promise<string[]> => {
    setState({ isFetching: true, isError: false, loadedCount: 0, totalCount: ordered.length })
    const merged: Record<string, SymbolDividendData> = { ...(state.data ?? {}) }
    const hints = getSinceHints(merged)
    const skipped: string[] = []
    try {
      for (let i = 0; i < ordered.length; i += BATCH) {
        const batch = ordered.slice(i, i + BATCH)
        const result = await fetchDividendEvents(batch, true, hints)
        Object.assign(merged, result.dividends_by_symbol)
        skipped.push(...result.skipped_symbols)
        setState({ loadedCount: Math.min(i + BATCH, ordered.length), data: { ...merged } })
      }
      const ts = Date.now()
      idbSet(EVENTS_KEY, { data: merged, ts })
      setState({ data: merged, lastFetchedAt: ts, isFetching: false })
      return skipped
    } catch (e) {
      setState({ isFetching: false, isError: true })
      throw e
    } finally {
      inFlight = null
    }
  })()
  inFlight = run
  return run
}

/** Read-only view of the shared dividend-events store — data, last-fetched time, and live
 * refresh progress, identical for every component that calls it. */
export function useDividendEvents() {
  hydrateFromCache()
  return useSyncExternalStore(subscribe, getSnapshot)
}

/** One symbol's computed dividend data, scoped to `portfolios` (undefined = every portfolio) —
 * reads the same shared cache as everywhere else, never fetches. */
export function useDividendForSymbol(
  symbol: string, transactions: Transaction[], usdInr: number, portfolios?: string[],
): DividendSymbol | undefined {
  const { data } = useDividendEvents()
  const computed = useMemo(
    () => data ? computeDividendsForScope(data, transactions, usdInr, portfolios) : null,
    [data, transactions, usdInr, portfolios],
  )
  return computed?.by_symbol.find(s => s.symbol === symbol)
}

/** Wipe the shared dividend cache (call after a new CSV is uploaded — the held-symbol set may
 * have changed entirely). */
export function clearDividendLocalCache(): void {
  idbKeys('dividends:').forEach(k => idbDelete(k))
  hydrated = false
  setState({ data: undefined, lastFetchedAt: undefined, isFetching: false, isError: false, loadedCount: 0, totalCount: 0 })
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
