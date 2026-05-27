import { useQueries } from '@tanstack/react-query'
import { useMemo } from 'react'
import { computeXIRR } from '../utils/xirr'
import { getSectorForHolding, SECTOR_BENCHMARK, type SectorKey } from '../utils/sectors'
import { USD_PORTS } from '../utils/segments'
import type { Holding, Transaction } from '../api/types'
import type { Currency } from '../App'

const BASE = (import.meta.env.VITE_API_URL ?? '') + '/api'

async function fetchBenchHistory(yf_symbol: string, start: string): Promise<{ dates: string[]; prices: number[] }> {
  const params = new URLSearchParams({ yf_symbol, start })
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
  holdingBenchXirr:  Map<string, number | null>  // yf_symbol → benchmark XIRR %
  isLoading:         boolean
  hasError:          boolean
}

export function useBenchmarkXirr(
  filteredHoldings: Holding[],
  closedYfSymbols: string[],
  transactions: Transaction[],
  usdInr: number,
  currency: Currency,
  enabled: boolean,
): BenchmarkOutput {

  // Derive sector map + unique bench symbols + earliest date
  const { yfToSector, uniqueBenchSyms, startDate } = useMemo(() => {
    const m = new Map<string, SectorKey>()
    const benchSet = new Set<string>()
    const add = (yf: string) => {
      const s = getSectorForHolding(yf)
      m.set(yf, s)
      benchSet.add(SECTOR_BENCHMARK[s])
    }
    for (const h of filteredHoldings) add(h.yf_symbol)
    for (const yf of closedYfSymbols) add(yf)
    const dates = transactions
      .filter(t => m.has(t.yf_symbol) && (t.type === 'BUY' || t.type === 'SELL'))
      .map(t => t.date.slice(0, 10))
      .sort()
    return {
      yfToSector:     m,
      uniqueBenchSyms: [...benchSet],
      startDate:      dates[0] ?? '2019-01-01',
    }
  }, [filteredHoldings, closedYfSymbols, transactions])

  // Fetch all benchmark histories in parallel
  const histResults = useQueries({
    queries: uniqueBenchSyms.map(sym => ({
      queryKey:  ['benchmark-hist', sym, startDate],
      queryFn:   () => fetchBenchHistory(sym, startDate),
      enabled:   enabled && uniqueBenchSyms.length > 0,
      staleTime: Infinity,
      gcTime:    24 * 60 * 60 * 1000,
      retry:     1,
    })),
  })

  const isLoading = histResults.some(r => r.isLoading)
  const hasError  = histResults.some(r => r.isError)

  const output = useMemo((): Omit<BenchmarkOutput, 'isLoading' | 'hasError'> | null => {
    if (!enabled || isLoading) return null

    const histMap = new Map<string, { dates: string[]; prices: number[] }>()
    uniqueBenchSyms.forEach((sym, i) => {
      const d = histResults[i]?.data
      if (d) histMap.set(sym, d)
    })
    if (histMap.size === 0) return null

    type CF = { date: Date; amount: number }

    // Per-(portfolio:symbol) running state
    const qtyHeld   = new Map<string, number>()
    const unitsHeld = new Map<string, number>()
    // Key metadata for terminal value pass
    const keyMeta   = new Map<string, { sector: SectorKey; benchSym: string; isUsd: boolean; yfSymbol: string }>()

    // Cashflow buckets
    const sectorActual  = new Map<SectorKey, CF[]>()
    const sectorBench   = new Map<SectorKey, CF[]>()
    const holdingBench  = new Map<string, CF[]>()   // yf_symbol → simulated bench CFs
    for (const s of new Set(yfToSector.values())) {
      sectorActual.set(s, [])
      sectorBench.set(s, [])
    }
    const overallActual: CF[] = []
    const overallBench:  CF[] = []

    // Process transactions in chronological order
    const txns = transactions
      .filter(t => yfToSector.has(t.yf_symbol) && (t.type === 'BUY' || t.type === 'SELL'))
      .sort((a, b) => a.date < b.date ? -1 : 1)

    for (const tx of txns) {
      const key    = `${tx.portfolio}:${tx.symbol}`
      const sector = yfToSector.get(tx.yf_symbol)!
      const bSym   = SECTOR_BENCHMARK[sector]
      const hist   = histMap.get(bSym)
      const isUsd  = USD_PORTS.has(tx.portfolio)

      if (!keyMeta.has(key)) keyMeta.set(key, { sector, benchSym: bSym, isUsd, yfSymbol: tx.yf_symbol })
      if (!holdingBench.has(tx.yf_symbol)) holdingBench.set(tx.yf_symbol, [])

      const fx = isUsd
        ? (currency === 'INR' ? usdInr : 1)
        : (currency === 'USD' ? 1 / usdInr : 1)

      const txDay        = tx.date.slice(0, 10)
      const rawBenchP    = hist ? priceOnOrBefore(hist.dates, hist.prices, txDay) : null
      // Convert US bench prices (USD) to display currency
      const benchP       = rawBenchP !== null
        ? (isUsd && currency === 'INR' ? rawBenchP * usdInr : rawBenchP)
        : null

      if (tx.type === 'BUY') {
        const amount = tx.quantity * tx.price * fx + (tx.charges ?? 0) * fx
        qtyHeld.set(key, (qtyHeld.get(key) ?? 0) + tx.quantity)
        if (benchP) unitsHeld.set(key, (unitsHeld.get(key) ?? 0) + amount / benchP)

        const cf: CF = { date: new Date(tx.date), amount: -amount }
        sectorActual.get(sector)!.push({ ...cf })
        sectorBench.get(sector)!.push({ ...cf })
        holdingBench.get(tx.yf_symbol)!.push({ ...cf })
        overallActual.push({ ...cf })
        overallBench.push({ ...cf })

      } else { // SELL
        const prevQty = qtyHeld.get(key) ?? 0
        if (prevQty <= 0) continue
        const frac    = Math.min(tx.quantity / prevQty, 1)
        qtyHeld.set(key, Math.max(0, prevQty - tx.quantity))

        const sellAmt = tx.quantity * tx.price * fx - (tx.charges ?? 0) * fx
        sectorActual.get(sector)!.push({ date: new Date(tx.date), amount: sellAmt })
        overallActual.push({ date: new Date(tx.date), amount: sellAmt })

        if (benchP) {
          const prev      = unitsHeld.get(key) ?? 0
          const unitsSold = frac * prev
          unitsHeld.set(key, Math.max(0, prev - unitsSold))
          const benchSell = unitsSold * benchP
          sectorBench.get(sector)!.push({ date: new Date(tx.date), amount: benchSell })
          holdingBench.get(tx.yf_symbol)!.push({ date: new Date(tx.date), amount: benchSell })
          overallBench.push({ date: new Date(tx.date), amount: benchSell })
        }
      }
    }

    // Terminal values
    const today = new Date()

    // Sector-level aggregates from open holdings
    const sectorVal      = new Map<SectorKey, number>()
    const sectorInv      = new Map<SectorKey, number>()
    const sectorCnt      = new Map<SectorKey, number>()
    for (const h of filteredHoldings) {
      const s = getSectorForHolding(h.yf_symbol)
      sectorVal.set(s, (sectorVal.get(s) ?? 0) + h.disp_current)
      sectorInv.set(s, (sectorInv.get(s) ?? 0) + h.disp_invested)
      sectorCnt.set(s, (sectorCnt.get(s) ?? 0) + 1)
    }
    let totalActTerm = 0
    for (const [s, v] of sectorVal.entries()) {
      if (v > 0) {
        sectorActual.get(s)!.push({ date: today, amount: v })
        totalActTerm += v
      }
    }
    if (totalActTerm > 0) overallActual.push({ date: today, amount: totalActTerm })

    // Benchmark terminal: remaining units × current bench price
    for (const [key, units] of unitsHeld.entries()) {
      if (units <= 0) continue
      const meta = keyMeta.get(key)
      if (!meta) continue
      const hist = histMap.get(meta.benchSym)
      if (!hist || hist.prices.length === 0) continue
      const rawCur = hist.prices[hist.prices.length - 1]
      const cur    = meta.isUsd && currency === 'INR' ? rawCur * usdInr : rawCur
      const tv     = units * cur
      sectorBench.get(meta.sector)!.push({ date: today, amount: tv })
      overallBench.push({ date: today, amount: tv })
      // Per-holding bench terminal
      const ys = meta.yfSymbol
      if (!holdingBench.has(ys)) holdingBench.set(ys, [])
      holdingBench.get(ys)!.push({ date: today, amount: tv })
    }

    // Compute XIRRs
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
        holdingCount: sectorCnt.get(s) ?? 0,
      })
    }
    sectors.sort((a, b) => b.invested - a.invested)

    const oA = xirr(overallActual)
    const oB = xirr(overallBench)

    const holdingBenchXirr = new Map<string, number | null>()
    for (const [ys, cfs] of holdingBench.entries()) {
      holdingBenchXirr.set(ys, xirr(cfs))
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
  ])

  return {
    sectors:           output?.sectors            ?? [],
    overallActualXirr: output?.overallActualXirr  ?? null,
    overallBenchXirr:  output?.overallBenchXirr   ?? null,
    overallAlpha:      output?.overallAlpha        ?? null,
    holdingBenchXirr:  output?.holdingBenchXirr   ?? new Map(),
    isLoading,
    hasError,
  }
}
