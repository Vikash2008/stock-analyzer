import { useQueries, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
import type { Holding, Transaction, Realized } from '../api/types'
import type { Currency } from '../App'
import { USD_PORTS } from '../utils/segments'
import { computeXIRR } from '../utils/xirr'
import { lsGet, lsSet, lsGetTimestamp, mergeHistory, detectDrift, fetchHistory, CLOSED_LS_TTL, REFRESH_MS } from './useHistory'

// Same key format as useHistory.ts/usePrefetchHoldingCharts — one shared cache per symbol.
const lsKey = (sym: string) => `${sym}:2015-01-01`

async function fetchSymHistory(sym: string, start: string) {
  const existing = lsGet(lsKey(sym))
  const since = existing?.dates?.[existing.dates.length - 1]
  const fetched = await fetchHistory(sym, start, undefined, since)
  if (!fetched.dates?.length) return { dates: [] as string[], prices: [] as number[] }
  let d = fetched
  if (fetched.partial_since && existing) {
    d = detectDrift(existing, fetched)
      ? await fetchHistory(sym, start)  // basis shifted — discard cache, refetch clean
      : mergeHistory(existing, fetched)
  }
  lsSet(lsKey(sym), d)
  return d
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

export function usePortfolioHistory(
  holdings:      Holding[],
  transactions:  Transaction[],
  realized:      Realized[],
  usdInr:        number,
  currency:      Currency,
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

  const queries = useQueries({
    queries: symbols.map(sym => {
      const isClosed = closedSet.has(sym)
      return {
        queryKey:  isClosed ? ['history-closed', sym] : ['history', sym],
        queryFn:   () => fetchSymHistory(sym, '2015-01-01'),
        // Closed symbols: skip the network entirely once a still-fresh (<30 day) cache exists.
        enabled:   enabled && (!isClosed || !lsGet(lsKey(sym), CLOSED_LS_TTL)),
        staleTime:    isClosed ? CLOSED_LS_TTL : REFRESH_MS,
        gcTime:       Infinity,  // keep in memory for entire session
        // No refetchInterval here — a flat interval is mount-relative (fires N minutes after
        // mount, not N minutes after the real last fetch), which lets the actual gap drift up
        // to ~2x REFRESH_MS. The elapsed-time poll below checks against the real dataUpdatedAt
        // instead, so a fetch only ever happens once REFRESH_MS has truly passed.
        retry:        2,
        retryDelay:   8_000,
        retryOnMount: false,     // error-state queries stay counted on navigation; avoids backwards counter
        // Without this, React Query's default refetch-on-mount-if-stale silently refetches
        // as soon as the app reopens with cache older than REFRESH_MS, instantly overwriting
        // dataUpdatedAt to "now" before the user ever sees the cache's true age. The
        // elapsed-time poll + visibilitychange handler below already cover staleness
        // while the app stays open — mount itself should never force it.
        refetchOnMount: false,
        // Open symbols: seed with the real cache timestamp so staleTime is judged against
        // actual last-fetch time — on app reopen within 30min this skips the fetch entirely
        // instead of always kicking one off in the background (placeholderData's behavior).
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
  useEffect(() => {
    if (!enabled || !openSymbolsKey) return
    const openSymbols = openSymbolsKey.split(',')
    const refetchStaleSymbols = () => {
      for (const sym of openSymbols) {
        const state = qc.getQueryState(['history', sym])
        const lastFetch = state?.dataUpdatedAt ?? 0
        if (Date.now() - lastFetch >= REFRESH_MS) {
          qc.refetchQueries({ queryKey: ['history', sym], type: 'active' })
        }
      }
    }
    // `visibilitychange` never fires on a fresh page load (the document is already
    // "visible" at mount) — it only catches background→foreground transitions on an
    // already-open app. A cold reopen needs its own elapsed-time check at mount, or a
    // cache older than REFRESH_MS would sit there indefinitely with refetchOnMount off.
    refetchStaleSymbols()
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refetchStaleSymbols()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    // Backstop for a continuously-foregrounded session (no visibilitychange transition ever
    // fires): poll the real elapsed time every minute rather than relying on a single timer
    // fired N minutes after mount, so the fetch always lands at the true REFRESH_MS mark.
    const pollId = window.setInterval(refetchStaleSymbols, 60_000)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.clearInterval(pollId)
    }
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

  const series = useMemo((): PortfolioSeries | null => {
    if (!enabled || !holdings.length) return null

    const priceMap = symbolPriceMap
    if (!priceMap.size) return null

    // Union of all trading dates, sorted
    const dateSet = new Set<string>()
    for (const [, m] of priceMap) for (const dt of m.keys()) dateSet.add(dt)
    const allDates = [...dateSet].sort()
    if (!allDates.length) return null

    // qty deltas: `portfolio:yf_symbol` → sorted [dateStr, netDelta][]
    const qtyDelta  = new Map<string, [string, number][]>()
    const firstDate = new Map<string, string>()

    for (const tx of transactions) {
      if (tx.type === 'DIVIDEND') continue
      const delta   = tx.type === 'BUY' ? tx.quantity : -tx.quantity
      const key     = `${tx.portfolio}:${tx.yf_symbol}`
      const dateStr = tx.date.slice(0, 10)
      if (!qtyDelta.has(key)) qtyDelta.set(key, [])
      const arr = qtyDelta.get(key)!
      const existing = arr.find(e => e[0] === dateStr)
      if (existing) existing[1] += delta
      else arr.push([dateStr, delta])
      if (!firstDate.has(key) || dateStr < firstDate.get(key)!) firstDate.set(key, dateStr)
    }
    for (const arr of qtyDelta.values()) arr.sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)

    const n      = allDates.length
    const valArr = new Array<number>(n).fill(0)
    const invArr = new Array<number>(n).fill(0)

    for (const h of holdings) {
      const pm     = priceMap.get(h.yf_symbol)
      const key    = `${h.portfolio}:${h.yf_symbol}`
      const deltas = qtyDelta.get(key) ?? []
      const first  = firstDate.get(key) ?? allDates[0]
      const isUsd  = USD_PORTS.has(h.portfolio)
      const fx     = isUsd ? (currency === 'INR' ? usdInr : 1) : (currency === 'USD' ? 1 / usdInr : 1)

      // Fallback: holdings with no yfinance history (e.g. NAV-based MFs) use
      // current_price as a constant so the last chart point matches summary.
      const constPx = pm?.size ? null : h.current_price

      // Pre-accumulate qty from transactions that predate the price history start.
      // yfinance history may start later than the first BUY (e.g. 2018-01-01 but
      // first BUY was 2017-07-24) — those deltas never appear in allDates otherwise.
      let qty = 0
      let di  = 0
      while (di < deltas.length && deltas[di][0] < allDates[0]) { qty += deltas[di][1]; di++ }
      qty = Math.max(0, qty)
      let lastPx: number | null = null

      for (let i = 0; i < n; i++) {
        const d = allDates[i]
        if (d < first) continue
        // Catch up any deltas dated on/before `d` that fell on a non-trading day
        // (market holiday) and so never landed exactly on an allDates entry —
        // otherwise that BUY/SELL's effect on qty is silently dropped from the
        // whole rest of the series, undercounting invested/value vs the live total.
        while (di < deltas.length && deltas[di][0] <= d) { qty = Math.max(0, qty + deltas[di][1]); di++ }
        if (pm?.size) {
          const px = pm.get(d)
          if (px !== undefined) lastPx = px
        } else {
          lastPx = constPx
        }
        if (lastPx === null || qty <= 0) continue
        valArr[i] += lastPx     * qty * fx
        invArr[i] += h.avg_cost * qty * fx
      }
    }

    // Pin the last data point to live prices so the chart endpoint matches the summary card.
    // yfinance history uses EOD closes; current_price is live (30-min cache). The gap = intraday move.
    // disp_current/disp_invested are always INR from the backend — apply FX so today pin matches
    // the same currency as the historical series computed above.
    const todayStr = new Date().toISOString().slice(0, 10)
    const todayFx  = currency === 'USD' ? 1 / usdInr : 1
    let todayVal = 0, todayInv = 0
    for (const h of holdings) {
      todayVal += h.disp_current  * todayFx
      todayInv += h.disp_invested * todayFx
    }
    if (allDates.length > 0 && allDates[allDates.length - 1] === todayStr) {
      valArr[valArr.length - 1] = todayVal
      invArr[invArr.length - 1] = todayInv
    } else if (todayVal > 0) {
      allDates.push(todayStr)
      valArr.push(todayVal)
      invArr.push(todayInv)
    }

    const startIdx = valArr.findIndex(v => v > 0)
    if (startIdx < 0) return null

    const datesSlice = allDates.slice(startIdx)
    const dates      = datesSlice.map(d => new Date(d))
    const values     = valArr.slice(startIdx)
    const invested   = invArr.slice(startIdx)
    const unrealized = values.map((v, i) => v - invested[i])

    // Realized — cumulative by sell_date; cost basis tracked for true Return %
    const realEvts = realized
      .map(r => {
        const isUsd = r.currency === 'USD'
        const fx    = isUsd && currency === 'INR' ? usdInr : !isUsd && currency === 'USD' ? 1 / usdInr : 1
        return {
          d:    r.sell_date.slice(0, 10),
          pnl:  r.realized_pnl * fx,
          cost: r.type === 'SELL' ? r.quantity * r.buy_price * fx : 0,
        }
      })
      .sort((a, b) => a.d < b.d ? -1 : 1)

    const realVals     = new Array<number>(dates.length).fill(0)
    const realCostVals = new Array<number>(dates.length).fill(0)
    let cumReal = 0, cumRealCost = 0, ri = 0
    for (let i = 0; i < datesSlice.length; i++) {
      while (ri < realEvts.length && realEvts[ri].d <= datesSlice[i]) {
        cumReal     += realEvts[ri].pnl
        cumRealCost += realEvts[ri].cost
        ri++
      }
      realVals[i]     = cumReal
      realCostVals[i] = cumRealCost
    }

    const totalVals = unrealized.map((u, i) => u + realVals[i])
    const returnPct = totalVals.map((tg, i) => {
      const totalCost = invested[i] + realCostVals[i]
      return totalCost > 0 ? tg / totalCost * 100 : 0
    })

    // XIRR trend — one data point per month-end
    const xirrDates:  Date[]   = []
    const xirrVals:   number[] = []

    if (transactions.length > 0) {
      const sortedTxns = [...transactions].sort((a, b) => a.date.localeCompare(b.date))
      const runCfs: { date: Date; amount: number }[] = []
      let ti = 0
      const now = new Date()
      const t0  = new Date(sortedTxns[0].date)
      let y = t0.getFullYear(), mo = t0.getMonth()

      while (true) {
        const monthEnd = new Date(y, mo + 1, 0)   // last day of this month
        const isCurrentPeriod = monthEnd > now
        const me    = isCurrentPeriod ? now : monthEnd   // clamp to today for the in-progress month
        const meStr = me.toISOString().slice(0, 10)

        // Accumulate transactions up to this month-end
        while (ti < sortedTxns.length && sortedTxns[ti].date.slice(0, 10) <= meStr) {
          const tx    = sortedTxns[ti++]
          const isUsd = USD_PORTS.has(tx.portfolio)
          const fx    = isUsd ? (currency === 'INR' ? usdInr : 1) : (currency === 'USD' ? 1 / usdInr : 1)
          const amt   = tx.quantity * tx.price * fx
          const chg   = tx.charges  * fx
          if      (tx.type === 'BUY')      runCfs.push({ date: new Date(tx.date), amount: -(amt + chg) })
          else if (tx.type === 'SELL')     runCfs.push({ date: new Date(tx.date), amount: amt - chg })
          else if (tx.type === 'DIVIDEND') runCfs.push({ date: new Date(tx.date), amount: amt })
        }

        // Find portfolio value at this month-end from value series
        let vIdx = datesSlice.length - 1
        while (vIdx >= 0 && datesSlice[vIdx] > meStr) vIdx--

        if (vIdx >= 0 && values[vIdx] > 0) {
          const allCfs = [...runCfs, { date: me, amount: values[vIdx] }]
          const r = computeXIRR(allCfs)
          if (r !== null && isFinite(r) && r > -0.99 && r < 50) {
            xirrDates.push(new Date(me))
            xirrVals.push(r * 100)
          }
        }

        if (isCurrentPeriod) break
        mo++
        if (mo > 11) { mo = 0; y++ }
      }
    }

    return {
      value:      { dates, values },
      invested:   { dates, values: invested },
      unrealized: { dates, values: unrealized },
      realized:   { dates, values: realVals },
      total:      { dates, values: totalVals },
      returnPct:  { dates, values: returnPct },
      xirrTrend:  { dates: xirrDates, values: xirrVals },
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, loadedCount, holdings, transactions, realized, usdInr, currency, symbols, symbolPriceMap])

  return { series, isLoading, isFetching, loadedCount, totalCount: symbols.length, fetchingCount, symbolPriceMap, lastFetchedAt }
}
