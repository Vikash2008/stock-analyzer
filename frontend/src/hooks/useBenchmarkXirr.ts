import { useQueries, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { computeXIRR } from '../utils/xirr'
import { getSectorForHolding, SECTOR_BENCHMARK, type SectorKey } from '../utils/sectors'
import { USD_PORTS } from '../utils/segments'
import { mergeHistory } from './useHistory'
import { idbGet, idbSet } from '../utils/idbStore'
import type { Holding, Transaction } from '../api/types'
import type { Currency } from '../App'

const BASE = (import.meta.env.VITE_API_URL ?? '') + '/api'

// Benchmark indices quoted in USD — need conversion to INR when displaying in INR
const USD_BENCH_SYMS = new Set(['^NDX', '^GSPC', '^DJI', '^RUT'])

// Fixed anchor (matches useHistory.ts's chart-fetch start) rather than a per-view earliest-
// transaction date — keeps the cache key portfolio/segment-agnostic so switching views never
// re-fetches the same benchmark index, and lets one refresh-all pass cover every view at once.
const BENCH_START = '2015-01-01'
const AUTO_KEY     = 'benchmark:autoRefreshDay'
const LS_PREFIX    = 'bench:'

type BenchHist = { dates: string[]; prices: number[]; partial_since?: string }

function lsGet(sym: string): BenchHist | undefined {
  return idbGet<{ d: BenchHist; t: number }>(LS_PREFIX + sym)?.d
}
function lsGetTimestamp(sym: string): number | undefined {
  return idbGet<{ d: BenchHist; t: number }>(LS_PREFIX + sym)?.t
}
function lsSet(sym: string, data: BenchHist) {
  idbSet(LS_PREFIX + sym, { d: data, t: Date.now() })
}

export function getLastBenchmarkAutoRefreshDay(): string | null {
  return localStorage.getItem(AUTO_KEY)
}

export function setLastBenchmarkAutoRefreshDay(day: string): void {
  try { localStorage.setItem(AUTO_KEY, day) } catch {}
}

/**
 * Force-refreshes every benchmark index in SECTOR_BENCHMARK (a small fixed set, not derived
 * from the user's holdings) — covers every portfolio/segment view in one pass since the cache
 * key is no longer per-view. Fetches directly + writes via setQueryData rather than
 * qc.fetchQuery/refetchQueries to avoid racing any already-mounted useQueries observer for the
 * same key (same lesson learned from the dividends refresh fix).
 */
export function useRefreshAllBenchmarks() {
  const qc = useQueryClient()
  return async () => {
    const syms = [...new Set(Object.values(SECTOR_BENCHMARK))]
    await Promise.all(syms.map(async sym => {
      const existing = lsGet(sym)
      const since    = existing?.dates?.[existing.dates.length - 1]
      const fetched  = await fetchBenchHistory(sym, BENCH_START, since)
      const d = fetched.partial_since && existing ? mergeHistory(existing, fetched) : fetched
      lsSet(sym, d)
      qc.setQueryData(['benchmark-hist', sym], d)
    }))
  }
}

async function fetchBenchHistory(yf_symbol: string, start: string, since?: string): Promise<BenchHist> {
  const params = new URLSearchParams({ yf_symbol, start })
  if (since) params.set('since', since)
  const res = await fetch(`${BASE}/history?${params}`)
  if (!res.ok) throw new Error(`Benchmark ${yf_symbol}: ${res.status}`)
  return res.json()
}

function priceOnOrBefore(dates: string[], prices: number[], target: string): number | null {
  let out: number | null = null
  for (let i = 0; i < dates.length; i++) {
    if (dates[i] <= target) out = prices[i]
    else break
  }
  return out
}

// Finds latest price on or before `target` from an unsorted Map<dateStr, price>
function priceFromMapOnOrBefore(map: Map<string, number>, target: string): number | null {
  let bestDate = ''
  let bestPrice: number | null = null
  for (const [d, p] of map) {
    if (d <= target && d > bestDate) { bestDate = d; bestPrice = p }
  }
  return bestPrice
}

export interface SectorBenchResult {
  sector:        SectorKey
  benchSymbol:   string
  actualXirr:    number | null  // %
  benchXirr:     number | null  // %
  alpha:         number | null  // %
  invested:      number
  currentValue:  number
  holdingCount:  number
}

export interface BenchmarkOutput {
  sectors:           SectorBenchResult[]
  overallActualXirr: number | null
  overallBenchXirr:  number | null
  overallAlpha:      number | null
  holdingBenchXirr:  Map<string, number | null>  // holdingKey(portfolio,yf_symbol) when not cumulative, else yf_symbol → benchmark XIRR %
  isLoading:         boolean
  isFetching:        boolean
  hasError:          boolean
  loadedCount:       number
  totalCount:        number
  fetchingCount:     number
  lastFetchedAt:     number | null
}

export function useBenchmarkXirr(
  filteredHoldings: Holding[],
  closedYfSymbols: string[],
  transactions: Transaction[],
  usdInr: number,
  currency: Currency,
  enabled: boolean,
  // Option B period XIRR: T1=periodStart, T2=periodEnd (null=today)
  // Opening balance at T1 is injected as a cashflow; terminal at T2.
  // When both are null, behaves identically to the prior inception-to-date approach.
  periodStart: string | null = null,
  periodEnd: string | null = null,
  symbolPriceMap: Map<string, Map<string, number>> | null = null,
  // Must match the caller's own actual-XIRR aggregation level (HoldingsPage.tsx's
  // `isCumulative`) — a symbol held across multiple portfolios otherwise gets its
  // per-portfolio actual XIRR compared against a benchmark XIRR aggregated across every
  // portfolio holding it, an apples-to-oranges mismatch that's invisible when every symbol
  // happens to live in only one portfolio but wildly wrong (and wrong-signed) when not.
  isCumulative: boolean = true,
): BenchmarkOutput {
  const holdingKey = (portfolio: string, yfSymbol: string) => isCumulative ? yfSymbol : `${portfolio}:${yfSymbol}`

  // Derive sector map + unique bench symbols
  const { yfToSector, uniqueBenchSyms } = useMemo(() => {
    const m = new Map<string, SectorKey>()
    const benchSet = new Set<string>()
    const add = (yf: string) => {
      const s = getSectorForHolding(yf)
      m.set(yf, s)
      benchSet.add(SECTOR_BENCHMARK[s])
    }
    for (const h of filteredHoldings) add(h.yf_symbol)
    for (const yf of closedYfSymbols) add(yf)
    return { yfToSector: m, uniqueBenchSyms: [...benchSet] }
  }, [filteredHoldings, closedYfSymbols])

  // Fetch all benchmark histories in parallel — fixed BENCH_START anchor (not a per-view
  // earliest-transaction date) so the cache key is shared across every portfolio/segment view
  const histResults = useQueries({
    queries: uniqueBenchSyms.map(sym => ({
      queryKey:  ['benchmark-hist', sym],
      queryFn:   async () => {
        const existing = lsGet(sym)
        const since    = existing?.dates?.[existing.dates.length - 1]
        const fetched  = await fetchBenchHistory(sym, BENCH_START, since)
        const d = fetched.partial_since && existing ? mergeHistory(existing, fetched) : fetched
        lsSet(sym, d)
        return d
      },
      enabled:   enabled && uniqueBenchSyms.length > 0,
      staleTime: Infinity,
      gcTime:    Infinity,
      retry:     1,
      // Seed from IndexedDB so reopening the app shows the real last-fetch time instead of
      // looking freshly synced — same pattern as useHistory.ts/useDividends.ts.
      initialData:          () => lsGet(sym),
      initialDataUpdatedAt: () => lsGetTimestamp(sym),
    })),
  })

  const isLoading     = histResults.some(r => r.isLoading)
  const isFetching    = histResults.some(r => r.isFetching)
  const hasError      = histResults.some(r => r.isError)
  const loadedCount   = histResults.filter(r => r.status === 'success').length
  const fetchingCount = histResults.filter(r => r.fetchStatus === 'fetching').length
  const totalCount    = uniqueBenchSyms.length
  // Real last-fetch time across every benchmark index's query — not "now", so reopening the
  // app shows the true age instead of always looking freshly synced.
  const lastFetchedAt = histResults.reduce((max, q) => Math.max(max, q.dataUpdatedAt ?? 0), 0) || null

  const output = useMemo((): Omit<BenchmarkOutput, 'isLoading' | 'isFetching' | 'hasError' | 'loadedCount' | 'totalCount' | 'fetchingCount' | 'lastFetchedAt'> | null => {
    if (!enabled || isLoading) return null
    // Period mode requires symbolPriceMap to compute opening balance actual values
    if (periodStart && (!symbolPriceMap || symbolPriceMap.size === 0)) return null

    const histMap = new Map<string, { dates: string[]; prices: number[] }>()
    uniqueBenchSyms.forEach((sym, i) => {
      const d = histResults[i]?.data
      if (d) histMap.set(sym, d)
    })
    if (histMap.size === 0) return null

    type CF = { date: Date; amount: number }

    // Per-(portfolio:symbol) running state — tracks ALL transactions from inception
    const qtyHeld   = new Map<string, number>()
    const unitsHeld = new Map<string, number>()
    const keyMeta   = new Map<string, { sector: SectorKey; benchSym: string; isUsd: boolean; yfSymbol: string }>()

    // Cashflow buckets — only populated for transactions in [T1, T2]
    const sectorActual = new Map<SectorKey, CF[]>()
    const sectorBench  = new Map<SectorKey, CF[]>()
    const holdingBench = new Map<string, CF[]>()   // holdingKey(portfolio,yf_symbol) → simulated bench CFs
    for (const s of new Set(yfToSector.values())) {
      sectorActual.set(s, [])
      sectorBench.set(s, [])
    }
    const overallActual: CF[] = []
    const overallBench:  CF[] = []

    // holdingCount: unique yfSymbols per sector that participated in the period
    const sectorYfSs = new Map<SectorKey, Set<string>>()

    // True when we've injected the opening balance and are collecting period cashflows
    let openingInjected = !periodStart

    // ── Opening balance injection at T1 ─────────────────────────────────────
    // Reads qtyHeld + unitsHeld at the moment just before T1's first transaction.
    // For actual: uses symbolPriceMap prices at T1.
    // For benchmark: uses histMap prices at T1.
    const injectOpening = () => {
      const T1str  = periodStart!
      const T1date = new Date(T1str)
      let totalActualOpen = 0
      let totalBenchOpen  = 0
      const yfBenchOpen = new Map<string, number>()   // holdingKey(portfolio,yfSymbol) → bench opening value

      for (const [key, qty] of qtyHeld.entries()) {
        const portfolio = key.split(':')[0]
        if (qty <= 0) continue
        const meta = keyMeta.get(key)
        if (!meta) continue
        const { sector, benchSym, isUsd, yfSymbol } = meta
        const benchIsUsd = USD_BENCH_SYMS.has(benchSym)
        const fx = isUsd
          ? (currency === 'INR' ? usdInr : 1)
          : (currency === 'USD' ? 1 / usdInr : 1)

        // Actual price at T1
        const symMap = symbolPriceMap?.get(yfSymbol)
        const rawPx  = symMap ? priceFromMapOnOrBefore(symMap, T1str) : null
        if (rawPx !== null) {
          const v = qty * rawPx * fx
          sectorActual.get(sector)!.push({ date: T1date, amount: -v })
          if (sector !== 'Other') totalActualOpen += v
        }

        // Benchmark price at T1
        const hist   = histMap.get(benchSym)
        const rawBP  = hist ? priceOnOrBefore(hist.dates, hist.prices, T1str) : null
        const benchP = rawBP !== null
          ? (benchIsUsd && currency === 'INR' ? rawBP * usdInr : rawBP)
          : null
        const units  = unitsHeld.get(key) ?? 0
        if (benchP !== null && units > 0) {
          const v = units * benchP
          sectorBench.get(sector)!.push({ date: T1date, amount: -v })
          if (sector !== 'Other') totalBenchOpen += v
          const hk = holdingKey(portfolio, yfSymbol)
          yfBenchOpen.set(hk, (yfBenchOpen.get(hk) ?? 0) + v)
        }

        // Track holding count: positions open at T1 count in the period
        if (!sectorYfSs.has(sector)) sectorYfSs.set(sector, new Set())
        sectorYfSs.get(sector)!.add(yfSymbol)
      }

      if (totalActualOpen > 0) overallActual.push({ date: T1date, amount: -totalActualOpen })
      if (totalBenchOpen  > 0) overallBench.push({ date: T1date, amount: -totalBenchOpen })

      for (const [ys, v] of yfBenchOpen.entries()) {
        if (!holdingBench.has(ys)) holdingBench.set(ys, [])
        holdingBench.get(ys)!.push({ date: T1date, amount: -v })
      }
    }

    // ── Main simulation loop ─────────────────────────────────────────────────
    const txns = transactions
      .filter(t => yfToSector.has(t.yf_symbol) && (t.type === 'BUY' || t.type === 'SELL'))
      .sort((a, b) => (a.date < b.date ? -1 : 1))

    for (const tx of txns) {
      const txDay = tx.date.slice(0, 10)

      // Stop processing once we pass T2
      if (periodEnd && txDay > periodEnd) break

      // Inject opening balance just before the first transaction at or after T1
      if (!openingInjected && txDay >= periodStart!) {
        injectOpening()
        openingInjected = true
      }

      const key    = `${tx.portfolio}:${tx.symbol}`
      const sector = yfToSector.get(tx.yf_symbol)!
      const bSym   = SECTOR_BENCHMARK[sector]
      const hist   = histMap.get(bSym)
      const isUsd  = USD_PORTS.has(tx.portfolio)

      if (!keyMeta.has(key)) keyMeta.set(key, { sector, benchSym: bSym, isUsd, yfSymbol: tx.yf_symbol })
      const hk = holdingKey(tx.portfolio, tx.yf_symbol)
      if (!holdingBench.has(hk)) holdingBench.set(hk, [])

      const fx         = isUsd
        ? (currency === 'INR' ? usdInr : 1)
        : (currency === 'USD' ? 1 / usdInr : 1)
      const rawBenchP  = hist ? priceOnOrBefore(hist.dates, hist.prices, txDay) : null
      const benchIsUsd = USD_BENCH_SYMS.has(bSym)
      const benchP     = rawBenchP !== null
        ? (benchIsUsd && currency === 'INR' ? rawBenchP * usdInr : rawBenchP)
        : null

      if (tx.type === 'BUY') {
        const amount = tx.quantity * tx.price * fx + (tx.charges ?? 0) * fx
        qtyHeld.set(key, (qtyHeld.get(key) ?? 0) + tx.quantity)
        if (benchP) unitsHeld.set(key, (unitsHeld.get(key) ?? 0) + amount / benchP)

        if (openingInjected) {
          const cf: CF = { date: new Date(tx.date), amount: -amount }
          sectorActual.get(sector)!.push({ ...cf })
          sectorBench.get(sector)!.push({ ...cf })
          holdingBench.get(hk)!.push({ ...cf })
          if (sector !== 'Other') { overallActual.push({ ...cf }); overallBench.push({ ...cf }) }
          if (!sectorYfSs.has(sector)) sectorYfSs.set(sector, new Set())
          sectorYfSs.get(sector)!.add(tx.yf_symbol)
        }
      } else { // SELL
        const prevQty = qtyHeld.get(key) ?? 0
        if (prevQty <= 0) continue
        const frac = Math.min(tx.quantity / prevQty, 1)
        qtyHeld.set(key, Math.max(0, prevQty - tx.quantity))

        // Always update benchmark units proportionally (pre-period sells reduce the T1 baseline)
        if (benchP) {
          const prev      = unitsHeld.get(key) ?? 0
          const unitsSold = frac * prev
          unitsHeld.set(key, Math.max(0, prev - unitsSold))

          if (openingInjected && unitsSold > 0) {
            const benchSell = unitsSold * benchP
            sectorBench.get(sector)!.push({ date: new Date(tx.date), amount: benchSell })
            holdingBench.get(hk)!.push({ date: new Date(tx.date), amount: benchSell })
            if (sector !== 'Other') overallBench.push({ date: new Date(tx.date), amount: benchSell })
          }
        }

        if (openingInjected) {
          const sellAmt = tx.quantity * tx.price * fx - (tx.charges ?? 0) * fx
          sectorActual.get(sector)!.push({ date: new Date(tx.date), amount: sellAmt })
          if (sector !== 'Other') overallActual.push({ date: new Date(tx.date), amount: sellAmt })
          if (!sectorYfSs.has(sector)) sectorYfSs.set(sector, new Set())
          sectorYfSs.get(sector)!.add(tx.yf_symbol)
        }
      }
    }

    // If T1 is after all transactions, inject opening with the final simulation state
    if (!openingInjected && periodStart) {
      injectOpening()
    }

    // ── Terminal values ──────────────────────────────────────────────────────
    const today    = new Date()
    const termDate = periodEnd ? new Date(periodEnd) : today
    const termStr  = periodEnd ?? today.toISOString().slice(0, 10)

    const sectorVal = new Map<SectorKey, number>()
    const sectorInv = new Map<SectorKey, number>()

    // sectorInv + sectorYfSs metadata always from current open holdings
    for (const h of filteredHoldings) {
      const s = getSectorForHolding(h.yf_symbol)
      sectorInv.set(s, (sectorInv.get(s) ?? 0) + h.disp_invested)
      if (!sectorYfSs.has(s)) sectorYfSs.set(s, new Set())
      sectorYfSs.get(s)!.add(h.yf_symbol)
    }

    // Fallback map for T2=today: keyed by `portfolio:yfSymbol` → Holding
    // Used when symbolPriceMap has no data for a symbol (e.g. NAV-based MFs)
    const hlFallback = !periodEnd
      ? new Map(filteredHoldings.map(h => [`${h.portfolio}:${h.yf_symbol}`, h]))
      : null

    // sectorVal: always use qtyHeld × symbolPriceMap at T2 — same data source as the
    // benchmark terminal value (histMap). This prevents stale portfolio bundle prices
    // from inflating actual XIRR when symbolPriceMap is freshly synced but the bundle is not.
    for (const [key, qty] of qtyHeld.entries()) {
      if (qty <= 0) continue
      const meta = keyMeta.get(key)
      if (!meta) continue
      const { sector, isUsd, yfSymbol } = meta
      const fx     = isUsd
        ? (currency === 'INR' ? usdInr : 1)
        : (currency === 'USD' ? 1 / usdInr : 1)
      const symMap = symbolPriceMap?.get(yfSymbol)
      const px     = symMap ? priceFromMapOnOrBefore(symMap, termStr) : null
      if (px !== null) {
        sectorVal.set(sector, (sectorVal.get(sector) ?? 0) + qty * px * fx)
      } else if (hlFallback) {
        // symbolPriceMap missing this symbol — fall back to live price from bundle
        const portfolio = key.split(':')[0]
        const h = hlFallback.get(`${portfolio}:${yfSymbol}`)
        if (h) sectorVal.set(sector, (sectorVal.get(sector) ?? 0) + h.disp_current)
      }
    }

    // Inject actual terminal values
    let totalActTerm = 0
    for (const [s, v] of sectorVal.entries()) {
      if (v > 0) {
        sectorActual.get(s)!.push({ date: termDate, amount: v })
        if (s !== 'Other') totalActTerm += v
      }
    }
    if (totalActTerm > 0) overallActual.push({ date: termDate, amount: totalActTerm })

    // Benchmark terminal: remaining units × benchmark price at T2
    for (const [key, units] of unitsHeld.entries()) {
      if (units <= 0) continue
      const meta = keyMeta.get(key)
      if (!meta) continue
      const hist = histMap.get(meta.benchSym)
      if (!hist || hist.prices.length === 0) continue
      const rawCur     = periodEnd
        ? (priceOnOrBefore(hist.dates, hist.prices, termStr) ?? hist.prices[hist.prices.length - 1])
        : hist.prices[hist.prices.length - 1]
      const benchIsUsd = USD_BENCH_SYMS.has(meta.benchSym)
      const cur        = benchIsUsd && currency === 'INR' ? rawCur * usdInr : rawCur
      const tv         = units * cur
      sectorBench.get(meta.sector)!.push({ date: termDate, amount: tv })
      if (meta.sector !== 'Other') overallBench.push({ date: termDate, amount: tv })
      const hk = holdingKey(key.split(':')[0], meta.yfSymbol)
      if (!holdingBench.has(hk)) holdingBench.set(hk, [])
      holdingBench.get(hk)!.push({ date: termDate, amount: tv })
    }

    // ── Compute XIRRs ────────────────────────────────────────────────────────
    const xirr = (cfs: CF[]) => {
      const r = computeXIRR(cfs)
      return r !== null ? r * 100 : null
    }

    const sectors: SectorBenchResult[] = []
    for (const [s, aCFs] of sectorActual.entries()) {
      const aX = xirr(aCFs)
      const bX = xirr(sectorBench.get(s)!)
      sectors.push({
        sector:       s,
        benchSymbol:  SECTOR_BENCHMARK[s],
        actualXirr:   aX,
        benchXirr:    bX,
        alpha:        aX !== null && bX !== null ? aX - bX : null,
        invested:     sectorInv.get(s) ?? 0,
        currentValue: sectorVal.get(s) ?? 0,
        holdingCount: sectorYfSs.get(s)?.size ?? 0,
      })
    }
    sectors.sort((a, b) => b.invested - a.invested)

    const oA = xirr(overallActual)
    const oB = xirr(overallBench)

    const holdingBenchXirr = new Map<string, number | null>()
    for (const [hk, cfs] of holdingBench.entries()) {
      holdingBenchXirr.set(hk, xirr(cfs))
    }

    return {
      sectors,
      overallActualXirr: oA,
      overallBenchXirr:  oB,
      overallAlpha:      oA !== null && oB !== null ? oA - oB : null,
      holdingBenchXirr,
    }
  }, [
    enabled, isLoading, filteredHoldings, transactions,
    yfToSector, uniqueBenchSyms, histResults, usdInr, currency,
    periodStart, periodEnd, symbolPriceMap,
  ])

  return {
    sectors:           output?.sectors            ?? [],
    overallActualXirr: output?.overallActualXirr  ?? null,
    overallBenchXirr:  output?.overallBenchXirr   ?? null,
    overallAlpha:      output?.overallAlpha        ?? null,
    holdingBenchXirr:  output?.holdingBenchXirr   ?? new Map(),
    isLoading,
    isFetching,
    hasError,
    loadedCount,
    totalCount,
    fetchingCount,
    lastFetchedAt,
  }
}
