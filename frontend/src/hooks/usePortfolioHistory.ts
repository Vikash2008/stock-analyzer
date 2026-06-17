import { useQueries } from '@tanstack/react-query'
import { useMemo } from 'react'
import type { Holding, Transaction, Realized } from '../api/types'
import type { Currency } from '../App'
import { USD_PORTS } from '../utils/segments'
import { computeXIRR } from '../utils/xirr'

const BASE = (import.meta.env.VITE_API_URL ?? '') + '/api'

async function fetchSymHistory(sym: string, start: string) {
  const r = await fetch(`${BASE}/history?${new URLSearchParams({ yf_symbol: sym, start })}`)
  if (!r.ok) throw new Error(`History ${r.status}`)
  const d = await r.json() as { dates: string[]; prices: number[] }
  if (!d.dates?.length) return { dates: [] as string[], prices: [] as number[] }
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
  extraSymbols?: string[],  // additional symbols to fetch for symbolPriceMap (e.g. closed positions)
) {
  const symbols = useMemo(
    () => [...new Set([...holdings.map(h => h.yf_symbol), ...(extraSymbols ?? [])])],
    [holdings, extraSymbols],
  )

  const queries = useQueries({
    queries: symbols.map(sym => ({
      queryKey:  ['history', sym],
      queryFn:   () => fetchSymHistory(sym, '2015-01-01'),
      enabled,
      staleTime:    Infinity,  // never auto-refetch; cleared only on force refresh
      gcTime:       Infinity,  // keep in memory for entire session
      retry:        2,
      retryDelay:   8_000,
      retryOnMount: false,     // error-state queries stay counted on navigation; avoids backwards counter
    })),
  })

  const loadedCount   = queries.filter(q => q.status === 'success' || q.status === 'error').length
  const fetchingCount = queries.filter(q => q.fetchStatus === 'fetching').length
  const isFetching    = fetchingCount > 0
  // true when not all symbols have data yet (first load) OR any is actively refetching (sync)
  const isLoading     = enabled && (loadedCount < symbols.length || isFetching)

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

    // qty deltas: `portfolio:yf_symbol` → dateStr → netDelta
    const qtyDelta  = new Map<string, Map<string, number>>()
    const firstDate = new Map<string, string>()

    for (const tx of transactions) {
      if (tx.type === 'DIVIDEND') continue
      const delta   = tx.type === 'BUY' ? tx.quantity : -tx.quantity
      const key     = `${tx.portfolio}:${tx.yf_symbol}`
      const dateStr = tx.date.slice(0, 10)
      if (!qtyDelta.has(key)) qtyDelta.set(key, new Map())
      const dm = qtyDelta.get(key)!
      dm.set(dateStr, (dm.get(dateStr) ?? 0) + delta)
      if (!firstDate.has(key) || dateStr < firstDate.get(key)!) firstDate.set(key, dateStr)
    }

    const n      = allDates.length
    const valArr = new Array<number>(n).fill(0)
    const invArr = new Array<number>(n).fill(0)

    for (const h of holdings) {
      const pm     = priceMap.get(h.yf_symbol)
      const key    = `${h.portfolio}:${h.yf_symbol}`
      const deltas = qtyDelta.get(key) ?? new Map<string, number>()
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
      for (const [dateStr, delta] of deltas) {
        if (dateStr < allDates[0]) qty += delta
      }
      qty = Math.max(0, qty)
      let lastPx: number | null = null

      for (let i = 0; i < n; i++) {
        const d = allDates[i]
        if (d < first) continue
        const dlt = deltas.get(d)
        if (dlt !== undefined) qty = Math.max(0, qty + dlt)
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

  return { series, isLoading, loadedCount, totalCount: symbols.length, fetchingCount, symbolPriceMap }
}
