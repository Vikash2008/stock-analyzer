import React, { useMemo, useState, useEffect } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { usePortfolio } from '../hooks/usePortfolio'
import { useQueryClient } from '@tanstack/react-query'
import { usePortfolioHistory, sliceSeries } from '../hooks/usePortfolioHistory'
import type { DatedSeries, PortfolioSeries } from '../hooks/usePortfolioHistory'
import { HoldingCard } from '../components/HoldingCard'
import { SummaryCard } from '../components/SummaryCard'
import { LoadingSkeleton, ErrorState } from '../components/LoadingSkeleton'
import { aggRealized, realizedForPorts } from '../utils/realized'
import { filterBySegment, getSegmentType, SKIP_PORTS, SEGMENT_LABELS, USD_PORTS } from '../utils/segments'
import { fmt, fmtGainLine, fmtCompact } from '../utils/fmt'
import { getSectorForHolding, SECTOR_COLOR, BENCHMARK_LABEL, type SectorKey, getMarketCapForHolding, MARKET_CAP_COLOR, type MarketCapKey } from '../utils/sectors'
import { useBenchmarkXirr } from '../hooks/useBenchmarkXirr'
import { computeXIRR } from '../utils/xirr'
import type { Holding } from '../api/types'
import type { Currency } from '../App'

interface Props { currency: Currency }

const METRICS = [
  'Portfolio Value',
  'Invested',
  'Unrealized Gains',
  'Realized Gains',
  'Total Gains',
  'Return %',
  'XIRR Trend',
] as const
type ChartMetric = typeof METRICS[number]

const RANGES = ['1m', '3m', '6m', '1y', '2y', '3y', '5y', 'All'] as const
type ChartRange = typeof RANGES[number]

const METRIC_SERIES_KEY: Record<ChartMetric, keyof PortfolioSeries> = {
  'Portfolio Value':  'value',
  'Invested':         'invested',
  'Unrealized Gains': 'unrealized',
  'Realized Gains':   'realized',
  'Total Gains':      'total',
  'Return %':         'returnPct',
  'XIRR Trend':       'xirrTrend',
}

const PCT_METRICS = new Set<ChartMetric>(['Return %', 'XIRR Trend'])
const ZERO_LINE_METRICS = new Set<ChartMetric>([
  'Unrealized Gains', 'Realized Gains', 'Total Gains', 'Return %', 'XIRR Trend',
])

type SortField = 'current' | 'invested' | 'todayGain' | 'todayPct' | 'totalGain' | 'totalPct' | 'xirr'
const SORT_OPTIONS: { field: SortField; label: string }[] = [
  { field: 'current',   label: 'Current Value' },
  { field: 'invested',  label: 'Invested' },
  { field: 'todayGain', label: 'Daily Gain' },
  { field: 'todayPct',  label: 'Daily Gain %' },
  { field: 'totalGain', label: 'Total Gain' },
  { field: 'totalPct',  label: 'Total Gain %' },
  { field: 'xirr',      label: 'XIRR' },
]

function getSortValue(r: CardRow, field: SortField, xirrMap: Map<string, number | null>): number {
  switch (field) {
    case 'current':   return r.current
    case 'invested':  return r.invested
    case 'todayGain': return r.todayGain ?? -Infinity
    case 'todayPct':  return r.todayPct  ?? -Infinity
    case 'totalGain': return (r.current - r.invested) + r.realGain
    case 'totalPct': {
      const tg = (r.current - r.invested) + r.realGain
      const tc = r.invested + r.realCost
      return tc !== 0 ? tg / tc * 100 : 0
    }
    case 'xirr': return xirrMap.get(r.key) ?? -Infinity
  }
}

interface CardRow {
  key:        string
  ticker:     string
  subLabel:   string
  current:    number
  invested:   number
  realGain:   number
  realCost:   number
  todayGain:  number | null
  todayPct:   number | null
  ltp:        number | null
  navPort:    string
  navSym:     string
  portfolios: string[]
}

function buildRows(
  holdings: Holding[],
  realizedMap: ReturnType<typeof aggRealized>,
  mode: 'cumulative' | 'standalone',
  hasSegment: boolean,
): CardRow[] {
  if (!hasSegment || mode === 'standalone') {
    return holdings
      .map(h => {
        const [rg, rc] = realizedMap.get(`${h.portfolio}:${h.symbol}`) ?? [0, 0]
        return {
          key:        `${h.portfolio}:${h.symbol}`,
          ticker:     h.symbol,
          subLabel:   h.company ?? '',
          current:    h.disp_current,
          invested:   h.disp_invested,
          realGain: rg, realCost: rc,
          todayGain:  h.disp_today_gain,
          todayPct:   h.today_pct,
          ltp:        h.current_price,
          navPort:    h.portfolio,
          navSym:     h.symbol,
          portfolios: [h.portfolio],
        }
      })
      .sort((a, b) => b.current - a.current)
  }

  const map = new Map<string, CardRow>()
  for (const h of holdings) {
    const [rg, rc] = realizedMap.get(`${h.portfolio}:${h.symbol}`) ?? [0, 0]
    const existing = map.get(h.symbol)
    if (!existing) {
      map.set(h.symbol, {
        key:        h.symbol,
        ticker:     h.symbol,
        subLabel:   h.company ?? '',
        current:    h.disp_current,
        invested:   h.disp_invested,
        realGain: rg, realCost: rc,
        todayGain:  h.disp_today_gain,
        todayPct:   null,
        ltp:        h.current_price,
        navPort:    h.portfolio,
        navSym:     h.symbol,
        portfolios: [h.portfolio],
      })
    } else {
      existing.current   += h.disp_current
      existing.invested  += h.disp_invested
      existing.realGain  += rg
      existing.realCost  += rc
      if (h.disp_today_gain !== null) {
        existing.todayGain = (existing.todayGain ?? 0) + h.disp_today_gain
      }
      if (!existing.portfolios.includes(h.portfolio)) existing.portfolios.push(h.portfolio)
    }
  }

  return [...map.values()]
    .map(r => {
      const prior = r.current - (r.todayGain ?? 0)
      return { ...r, todayPct: (r.todayGain !== null && prior !== 0) ? (r.todayGain / prior) * 100 : null }
    })
    .sort((a, b) => b.current - a.current)
}

export default function HoldingsPage({ currency }: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const { portfolio, segment } = useParams<{ portfolio?: string; segment?: string }>()
  const { data, isLoading, error } = usePortfolio(currency)
  const [viewMode,    setViewMode]    = useState<'cumulative' | 'standalone'>('cumulative')
  const [holdingFilter, setHoldingFilter] = useState<'open' | 'closed' | 'all'>('all')
  const [activeTab,   setActiveTab]   = useState<'holdings' | 'charts' | 'analysis'>('holdings')
  const [analysisSubTab, setAnalysisSubTab] = useState<'allocation' | 'benchmarking'>('allocation')
  const [chartMetric, setChartMetric] = useState<ChartMetric>('Portfolio Value')
  const [chartRange,  setChartRange]  = useState<ChartRange>('1y')
  const [sortField,   setSortField]   = useState<SortField>('current')
  const [sortDir,     setSortDir]     = useState<'desc' | 'asc'>('desc')
  const [sortOpen,    setSortOpen]    = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [showClosed,   setShowClosed]   = useState(false)
  const [syncing,      setSyncing]      = useState(false)
  const [expandedSectors,     setExpandedSectors]     = useState<Set<string>>(new Set())
  const [expandedAllocSectors, setExpandedAllocSectors] = useState<Set<string>>(new Set())
  const [expandedMktCapBuckets, setExpandedMktCapBuckets] = useState<Set<string>>(new Set())
  const [sectorSectionOpen,   setSectorSectionOpen]   = useState(true)
  const [mktCapSectionOpen,   setMktCapSectionOpen]   = useState(true)
  const qc = useQueryClient()

  useEffect(() => {
    const key = `holdingsScroll:${location.pathname}`
    const saved = sessionStorage.getItem(key)
    if (saved) {
      sessionStorage.removeItem(key)
      window.scrollTo(0, parseInt(saved, 10))
    } else {
      window.scrollTo(0, 0)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const realizedMap = useMemo(
    () => (data ? aggRealized(data.realized, data.usd_inr) : new Map()),
    [data],
  )

  const filteredHoldings = useMemo(() => {
    if (!data) return []
    let h = data.holdings.filter(r => !SKIP_PORTS.has(r.portfolio))
    if (portfolio) h = h.filter(r => r.portfolio === portfolio)
    else if (segment) h = filterBySegment(h, segment)
    return h
  }, [data, portfolio, segment])

  const sectorData = useMemo(() => {
    const map = new Map<SectorKey, { value: number; count: number }>()
    for (const h of filteredHoldings) {
      const sector = getSectorForHolding(h.yf_symbol)
      const e = map.get(sector) ?? { value: 0, count: 0 }
      map.set(sector, { value: e.value + h.disp_current, count: e.count + 1 })
    }
    const total = [...map.values()].reduce((s, v) => s + v.value, 0)
    return [...map.entries()]
      .map(([name, { value, count }]) => ({ name, value, count, pct: total > 0 ? value / total * 100 : 0 }))
      .sort((a, b) => b.value - a.value)
  }, [filteredHoldings])

  const mktCapData = useMemo(() => {
    const map = new Map<MarketCapKey, { value: number; count: number }>()
    for (const h of filteredHoldings) {
      const bucket = getMarketCapForHolding(h.yf_symbol)
      const e = map.get(bucket) ?? { value: 0, count: 0 }
      map.set(bucket, { value: e.value + h.disp_current, count: e.count + 1 })
    }
    const total = [...map.values()].reduce((s, v) => s + v.value, 0)
    return [...map.entries()]
      .map(([name, { value, count }]) => ({ name, value, count, pct: total > 0 ? value / total * 100 : 0 }))
      .sort((a, b) => b.value - a.value)
  }, [filteredHoldings])

  const summaryStats = useMemo(() => {
    const cur  = filteredHoldings.reduce((s, h) => s + h.disp_current,  0)
    const inv  = filteredHoldings.reduce((s, h) => s + h.disp_invested, 0)
    const tg   = filteredHoldings
      .filter(h => h.disp_today_gain !== null)
      .reduce((s, h) => s + (h.disp_today_gain ?? 0), 0)
    const prior = cur - tg
    const ports = new Set(filteredHoldings.map(h => h.portfolio))

    let realGain = 0, realCost = 0

    if (segment && data) {
      // Build symbol → yf_symbol from transactions (realized records lack yf_symbol).
      // This ensures fully-exited positions (not in filteredHoldings) are included.
      const symToYf = new Map<string, string>()
      for (const tx of data.transactions) symToYf.set(tx.symbol, tx.yf_symbol)

      const segFilter = new Set(
        segment === 'stk' ? ['indian_stock', 'us_stock'] :
        segment === 'mf'  ? ['indian_mf',   'us_mf']    :
        [segment],
      )

      for (const r of data.realized) {
        if (SKIP_PORTS.has(r.portfolio)) continue
        const yf = symToYf.get(r.symbol) ?? r.symbol
        if (!segFilter.has(getSegmentType(r.portfolio, yf))) continue
        const fx = r.currency === 'USD' ? data.usd_inr : 1.0
        realGain += r.realized_pnl * fx
        realCost += r.quantity * r.buy_price * fx
      }
    } else {
      const [rg, rc] = realizedForPorts(realizedMap, ports)
      realGain = rg; realCost = rc
    }

    return {
      cur, inv, tg,
      todayPct: prior !== 0 ? (tg / prior) * 100 : null,
      realGain, realCost,
    }
  }, [filteredHoldings, realizedMap, segment, data])

  const rows = useMemo(
    () => buildRows(filteredHoldings, realizedMap, viewMode, !!segment),
    [filteredHoldings, realizedMap, viewMode, segment],
  )

  // Allocation tab always uses one-per-symbol grouping regardless of viewMode
  const allocGroupedRows = useMemo(
    () => buildRows(filteredHoldings, realizedMap, 'cumulative', true),
    [filteredHoldings, realizedMap],
  )

  const allocXirrMap = useMemo(() => {
    if (!data) return new Map<string, number | null>()
    const today = new Date()
    const map = new Map<string, number | null>()
    for (const row of allocGroupedRows) {
      const txns = data.transactions.filter(t =>
        t.symbol === row.navSym && row.portfolios.includes(t.portfolio),
      )
      const cfs: { date: Date; amount: number }[] = []
      for (const tx of txns) {
        if (tx.type === 'DIVIDEND') continue
        const isUsd = USD_PORTS.has(tx.portfolio)
        const fx = isUsd
          ? (currency === 'INR' ? data.usd_inr : 1)
          : (currency === 'USD' ? 1 / data.usd_inr : 1)
        const amt = tx.quantity * tx.price * fx
        const chg = (tx.charges ?? 0) * fx
        if (tx.type === 'BUY')  cfs.push({ date: new Date(tx.date), amount: -(amt + chg) })
        if (tx.type === 'SELL') cfs.push({ date: new Date(tx.date), amount:   amt - chg })
      }
      if (row.current > 0) cfs.push({ date: today, amount: row.current })
      const r = computeXIRR(cfs)
      map.set(row.key, r !== null ? r * 100 : null)
    }
    return map
  }, [allocGroupedRows, data, currency])

  const closedRows = useMemo((): CardRow[] => {
    if (!data) return []
    const openSymbols = new Set(filteredHoldings.map(h => h.symbol))
    const nameMap = new Map<string, string>()
    for (const tx of data.transactions) { if (tx.name) nameMap.set(tx.symbol, tx.name) }

    // For segment views, build segment filter to classify realized records
    const symToYf = new Map<string, string>()
    for (const tx of data.transactions) symToYf.set(tx.symbol, tx.yf_symbol)
    const segFilter = segment ? new Set(
      segment === 'stk'   ? ['indian_stock', 'us_stock']              :
      segment === 'mf'    ? ['indian_mf',    'us_mf']                 :
      segment === 'total' ? ['indian_stock', 'us_stock', 'indian_mf', 'us_mf'] :
      [segment],
    ) : null

    const symMap = new Map<string, { rg: number; rc: number; firstPort: string; ports: string[] }>()
    for (const r of data.realized) {
      if (SKIP_PORTS.has(r.portfolio)) continue
      if (portfolio && r.portfolio !== portfolio) continue
      if (segFilter) {
        const yf = symToYf.get(r.symbol) ?? r.symbol
        if (!segFilter.has(getSegmentType(r.portfolio, yf))) continue
      }
      const fx = r.currency === 'USD' ? data.usd_inr : 1.0
      const e  = symMap.get(r.symbol) ?? { rg: 0, rc: 0, firstPort: r.portfolio, ports: [] }
      if (!e.ports.includes(r.portfolio)) e.ports.push(r.portfolio)
      symMap.set(r.symbol, {
        rg: e.rg + r.realized_pnl * fx,
        rc: e.rc + (r.type === 'SELL' ? r.quantity * r.buy_price * fx : 0),
        firstPort: e.firstPort,
        ports: e.ports,
      })
    }
    return [...symMap.entries()]
      .filter(([sym]) => !openSymbols.has(sym))
      .map(([sym, { rg, rc, firstPort, ports }]) => ({
        key: `closed:${sym}`,
        ticker: sym,
        subLabel: nameMap.get(sym) ?? '',
        current: 0, invested: 0,
        realGain: rg, realCost: rc,
        todayGain: null, todayPct: null, ltp: null,
        navPort: firstPort, navSym: sym,
        portfolios: ports,
      }))
      .sort((a, b) => b.realGain - a.realGain)
  }, [data, portfolio, segment, filteredHoldings])

  const closedYfSymbolsArr = useMemo(() => {
    if (!data) return []
    const symToYf = new Map<string, string>()
    for (const tx of data.transactions) symToYf.set(tx.symbol, tx.yf_symbol)
    const openYfs = new Set(filteredHoldings.map(h => h.yf_symbol))
    return closedRows
      .map(r => symToYf.get(r.navSym) ?? r.navSym)
      .filter(yf => !openYfs.has(yf))
  }, [closedRows, data, filteredHoldings])

  const displayStats = useMemo(() => {
    const closedRealGain = closedRows.reduce((s, r) => s + r.realGain, 0)
    const closedRealCost = closedRows.reduce((s, r) => s + r.realCost, 0)
    if (holdingFilter === 'closed') {
      return { cur: 0, inv: 0, tg: null, todayPct: null, realGain: closedRealGain, realCost: closedRealCost }
    }
    if (holdingFilter === 'open') {
      // partial sells of open positions = all realized minus fully-closed realized
      return { ...summaryStats, realGain: summaryStats.realGain - closedRealGain, realCost: summaryStats.realCost - closedRealCost }
    }
    return summaryStats
  }, [holdingFilter, summaryStats, closedRows])

  // Chart data hooks — always called, gated by enabled flag
  const filtPorts = useMemo(
    () => new Set(filteredHoldings.map(h => h.portfolio)),
    [filteredHoldings],
  )
  const filtTxns = useMemo(
    () => (data?.transactions ?? []).filter(t => filtPorts.has(t.portfolio)),
    [data, filtPorts],
  )
  const filtRealized = useMemo(
    () => (data?.realized ?? []).filter(r => filtPorts.has(r.portfolio)),
    [data, filtPorts],
  )

  const {
    sectors:           benchSectors,
    overallActualXirr: benchActualXirr,
    overallBenchXirr:  benchBenchXirr,
    overallAlpha:      benchAlpha,
    holdingBenchXirr:  holdingBenchXirr,
    isLoading:         benchLoading,
    hasError:          benchHasError,
  } = useBenchmarkXirr(
    filteredHoldings,
    closedYfSymbolsArr,
    filtTxns,
    data?.usd_inr ?? 95.5,
    currency,
    activeTab === 'analysis' && !!data,
  )

  const xirrMap = useMemo(() => {
    if (!data) return new Map<string, number | null>()
    const today = new Date()
    const map   = new Map<string, number | null>()
    const isCumulative = !!segment && viewMode === 'cumulative'

    for (const row of [...rows, ...(holdingFilter !== 'open' ? closedRows : [])]) {
      const rowPorts = (isCumulative && row.key.startsWith('closed:')) ? new Set(row.portfolios) : filtPorts
      const txns = data.transactions.filter(t =>
        isCumulative
          ? t.symbol === row.navSym && rowPorts.has(t.portfolio)
          : t.symbol === row.navSym && t.portfolio === row.navPort,
      )

      const cfs: { date: Date; amount: number }[] = []
      for (const tx of txns) {
        if (tx.type === 'DIVIDEND') continue
        const isUsd = USD_PORTS.has(tx.portfolio)
        const fx    = isUsd
          ? (currency === 'INR' ? data.usd_inr : 1)
          : (currency === 'USD' ? 1 / data.usd_inr : 1)
        const amt = tx.quantity * tx.price * fx
        const chg = (tx.charges ?? 0) * fx
        if (tx.type === 'BUY')  cfs.push({ date: new Date(tx.date), amount: -(amt + chg) })
        if (tx.type === 'SELL') cfs.push({ date: new Date(tx.date), amount:   amt - chg })
      }
      if (row.current > 0) cfs.push({ date: today, amount: row.current })

      const r = computeXIRR(cfs)
      map.set(row.key, r !== null ? r * 100 : null)
    }
    return map
  }, [rows, closedRows, holdingFilter, data, currency, filtPorts, segment, viewMode])

  const sortedRows = useMemo(() => {
    const sortFn = (a: CardRow, b: CardRow) => {
      const va = getSortValue(a, sortField, xirrMap)
      const vb = getSortValue(b, sortField, xirrMap)
      if (va === -Infinity && vb === -Infinity) return 0
      if (va === -Infinity) return 1
      if (vb === -Infinity) return -1
      return sortDir === 'desc' ? vb - va : va - vb
    }
    const open   = [...rows].sort(sortFn)
    const closed = [...closedRows].sort(sortFn)
    if (holdingFilter === 'closed') return closed
    if (holdingFilter === 'all')    return showClosed ? [...open, ...closed] : open
    return open
  }, [rows, closedRows, holdingFilter, showClosed, sortField, sortDir, xirrMap])

  const summaryXirr = useMemo(() => {
    if (!data) return null
    if (portfolio) return data.xirr_by_portfolio[portfolio] ?? null
    if (segment === 'stk' || segment === 'indian_stock' || segment === 'us_stock') return data.xirr_stk
    if (segment === 'mf'  || segment === 'indian_mf'   || segment === 'us_mf')    return data.xirr_mf
    return data.xirr_total
  }, [data, portfolio, segment])

  const filteredSummaryXirr = useMemo(() => {
    if (!data) return null
    const isCumulative = !!segment && viewMode === 'cumulative'
    const targetRows =
      holdingFilter === 'closed' ? closedRows :
      holdingFilter === 'open'   ? rows :
      [...rows, ...closedRows]
    if (targetRows.length === 0) return null
    const today = new Date()
    const cfs: { date: Date; amount: number }[] = []
    for (const row of targetRows) {
      const rowPorts = (isCumulative && row.key.startsWith('closed:')) ? new Set(row.portfolios) : filtPorts
      const txns = data.transactions.filter(t =>
        isCumulative
          ? t.symbol === row.navSym && rowPorts.has(t.portfolio)
          : t.symbol === row.navSym && t.portfolio === row.navPort,
      )
      for (const tx of txns) {
        if (tx.type === 'DIVIDEND') continue
        const isUsd = USD_PORTS.has(tx.portfolio)
        const fx = isUsd
          ? (currency === 'INR' ? data.usd_inr : 1)
          : (currency === 'USD' ? 1 / data.usd_inr : 1)
        const amt = tx.quantity * tx.price * fx
        const chg = (tx.charges ?? 0) * fx
        if (tx.type === 'BUY')  cfs.push({ date: new Date(tx.date), amount: -(amt + chg) })
        if (tx.type === 'SELL') cfs.push({ date: new Date(tx.date), amount:   amt - chg })
      }
      if (row.current > 0) cfs.push({ date: today, amount: row.current })
    }
    const r = computeXIRR(cfs)
    return r !== null ? r * 100 : null
  }, [holdingFilter, data, closedRows, rows, filtPorts, segment, viewMode, currency])

  const { series: portSeries, isLoading: histLoading, loadedCount, totalCount } = usePortfolioHistory(
    filteredHoldings,
    filtTxns,
    filtRealized,
    data?.usd_inr ?? 95.5,
    currency,
    !!data,
  )

  const metricSeries = useMemo((): DatedSeries | null => {
    if (!portSeries) return null
    const key = METRIC_SERIES_KEY[chartMetric]
    const raw = portSeries[key] as DatedSeries
    return sliceSeries(raw, chartRange)
  }, [portSeries, chartMetric, chartRange])

  const rechartsData = useMemo(
    () => metricSeries?.dates.map((d, i) => ({
      t: d.toISOString().slice(0, 10),
      v: metricSeries.values[i],
    })) ?? [],
    [metricSeries],
  )

  if (isLoading) return <LoadingSkeleton />
  if (error || !data) return <ErrorState message={(error as Error)?.message ?? 'Unknown error'} />
  if (!filteredHoldings.length) {
    return (
      <div className="max-w-xl mx-auto px-4 py-4">
        <button onClick={() => navigate('/')} className="text-[11px] text-[#2563eb] mb-4">
          ← All Portfolios
        </button>
        <p className="text-slate-500 text-sm">No holdings found.</p>
      </div>
    )
  }

  const label      = portfolio ?? SEGMENT_LABELS[segment ?? ''] ?? 'Holdings'
  const backLabel  = segment ? '← Overview' : '← All Portfolios'
  const isPct      = PCT_METRICS.has(chartMetric)
  const chartLast  = metricSeries?.values[metricSeries.values.length - 1] ?? null
  const chartFirst = metricSeries?.values[0] ?? null
  const chartChange = chartLast !== null && chartFirst !== null ? chartLast - chartFirst : null
  const lineColor  = (chartLast ?? 0) >= 0 ? '#10b981' : '#f43f5e'
  const lastColor  = (chartLast ?? 0) >= 0 ? '#0a7a42' : '#be1c1c'

  const yTickFmt = (v: number) => {
    if (isPct) return `${v.toFixed(0)}%`
    const abs = Math.abs(v)
    if (abs >= 1e7) return `${(v / 1e7).toFixed(1)}Cr`
    if (abs >= 1e5) return `${(v / 1e5).toFixed(1)}L`
    if (abs >= 1e3) return `${(v / 1e3).toFixed(0)}K`
    return v.toFixed(0)
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-4">
      {/* Back + Settings */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => navigate('/')} className="text-[11px] text-[#2563eb]">
          {backLabel}
        </button>
        <div className="relative">
          <button
            onClick={() => setSettingsOpen(o => !o)}
            className={`w-7 h-7 flex items-center justify-center rounded-full transition-colors ${settingsOpen ? 'bg-slate-100 text-slate-700' : 'text-slate-400 active:bg-slate-100'}`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
          {settingsOpen && (
            <>
              <div className="fixed inset-0 z-[9]" onClick={() => setSettingsOpen(false)} />
              <div className="absolute right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg z-10 p-3 min-w-[190px]">
                {/* Row 1: Open / Closed / All */}
                <p className="text-[8px] text-slate-400 uppercase tracking-widest mb-1.5">Status</p>
                <div className="relative flex bg-slate-100 rounded-full p-[2px] mb-3">
                  <div
                    className="absolute top-[2px] bottom-[2px] w-1/3 rounded-full bg-white shadow-sm transition-transform duration-150"
                    style={{ transform: `translateX(${holdingFilter === 'open' ? '0%' : holdingFilter === 'closed' ? '100%' : '200%'})` }}
                  />
                  {(['open', 'closed', 'all'] as const).map(v => (
                    <button
                      key={v}
                      onClick={() => setHoldingFilter(v)}
                      className={`relative z-10 flex-1 text-[9px] py-[4px] capitalize transition-colors ${holdingFilter === v ? 'text-slate-700 font-semibold' : 'text-slate-400'}`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
                {/* Show Closed toggle — All filter only */}
                {holdingFilter === 'all' && (
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[8px] text-slate-400 uppercase tracking-widest">Show Closed</p>
                    <button
                      onClick={() => setShowClosed(v => !v)}
                      className={`relative w-8 h-4 rounded-full transition-colors duration-150 ${showClosed ? 'bg-[#2563eb]' : 'bg-slate-200'}`}
                    >
                      <span className={`absolute top-[2px] w-3 h-3 bg-white rounded-full shadow-sm transition-transform duration-150 ${showClosed ? 'translate-x-[18px]' : 'translate-x-[2px]'}`} />
                    </button>
                  </div>
                )}
                {/* Row 2: Grouped / Standalone — segment views only */}
                {segment && (
                  <>
                    <p className="text-[8px] text-slate-400 uppercase tracking-widest mb-1.5">View</p>
                    <div className="relative flex bg-slate-100 rounded-full p-[2px]">
                      <div
                        className="absolute top-[2px] bottom-[2px] w-1/2 rounded-full bg-white shadow-sm transition-transform duration-150"
                        style={{ transform: `translateX(${viewMode === 'standalone' ? '100%' : '0%'})` }}
                      />
                      {(['cumulative', 'standalone'] as const).map(m => (
                        <button
                          key={m}
                          onClick={() => setViewMode(m)}
                          className={`relative z-10 flex-1 text-[9px] py-[4px] transition-colors ${viewMode === m ? 'text-slate-700 font-semibold' : 'text-slate-400'}`}
                        >
                          {m === 'cumulative' ? 'Grouped' : 'Standalone'}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Summary card */}
      <SummaryCard
        label={label}
        current={displayStats.cur}
        invested={displayStats.inv}
        realGain={displayStats.realGain}
        realCost={displayStats.realCost}
        todayGain={displayStats.tg || null}
        todayPct={displayStats.todayPct}
        xirr={filteredSummaryXirr}
        currency={currency}
      />

      {/* Tabs */}
      <div className="flex gap-2 mb-3">
        {(['holdings', 'charts', 'analysis'] as const).map(tab => {
          const colors = {
            holdings: activeTab === tab ? 'bg-blue-50 text-blue-600' : 'text-slate-400',
            charts:   activeTab === tab ? 'bg-emerald-50 text-emerald-600' : 'text-slate-400',
            analysis: activeTab === tab ? 'bg-violet-50 text-violet-600' : 'text-slate-400',
          }
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`text-[11px] px-3 py-1 rounded-full capitalize font-medium transition-colors ${colors[tab]}`}
            >
              {tab}
            </button>
          )
        })}
        {activeTab === 'charts' && (
          <button
            className="ml-auto pb-1.5 text-slate-400 active:text-[#2563eb]"
            onClick={() => {
              if (syncing) return
              setSyncing(true)
              qc.invalidateQueries({ queryKey: ['history'] })
              setTimeout(() => setSyncing(false), 1200)
            }}
          >
            <span className={`text-[14px] inline-block ${syncing ? 'animate-spin' : ''}`}>↻</span>
          </button>
        )}
      </div>

      {/* ── Holdings tab ── */}
      {activeTab === 'holdings' && (
        <>
          {/* Count + sort */}
          <div className="flex items-center justify-between mb-2">
            <p className="text-[9px] text-slate-400">
              {holdingFilter === 'closed' ? `${closedRows.length} closed` : holdingFilter === 'all' ? `${rows.length} open · ${closedRows.length} closed` : `${rows.length} open`}
            </p>
            <div className="relative">
              <button
                onClick={() => setSortOpen(o => !o)}
                className="flex items-center gap-0.5 text-[9px] text-slate-400 py-1 px-1"
              >
                <span>{SORT_OPTIONS.find(o => o.field === sortField)?.label}</span>
                <span>{sortDir === 'desc' ? ' ↓' : ' ↑'}</span>
              </button>
              {sortOpen && (
                <>
                  <div className="fixed inset-0 z-[9]" onClick={() => setSortOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 min-w-[140px] py-1">
                    {SORT_OPTIONS.map(opt => (
                      <button
                        key={opt.field}
                        onClick={() => {
                          if (sortField === opt.field) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
                          else { setSortField(opt.field); setSortDir('desc') }
                          setSortOpen(false)
                        }}
                        className={`w-full text-left text-[10px] px-3 py-1.5 flex justify-between items-center ${
                          sortField === opt.field ? 'text-[#2563eb] font-medium' : 'text-slate-600'
                        }`}
                      >
                        <span>{opt.label}</span>
                        {sortField === opt.field && <span className="ml-2">{sortDir === 'desc' ? '↓' : '↑'}</span>}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="space-y-2">
            {sortedRows.map(r => (
              <HoldingCard
                key={r.key}
                ticker={r.ticker}
                subLabel={r.subLabel}
                current={r.current}
                invested={r.invested}
                realGain={r.realGain}
                realCost={r.realCost}
                todayGain={r.todayGain}
                todayPct={r.todayPct}
                ltp={r.ltp}
                xirr={xirrMap.get(r.key) ?? null}
                currency={currency}
                onClick={() => {
                  sessionStorage.setItem(`holdingsScroll:${location.pathname}`, String(window.scrollY))
                  navigate(`/transactions/${encodeURIComponent(r.navPort)}/${encodeURIComponent(r.navSym)}`, { state: { from: label, portfolios: r.portfolios } })
                }}
              />
            ))}
          </div>
        </>
      )}

      {/* ── Charts tab ── */}
      {activeTab === 'charts' && (
        <div>
          {/* Metric selector */}
          <div
            className="flex gap-1.5 overflow-x-auto pb-2 mb-3"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
          >
            {METRICS.map(m => (
              <button
                key={m}
                onClick={() => setChartMetric(m)}
                className={`text-[10px] whitespace-nowrap px-2.5 py-0.5 rounded-full border transition-colors ${
                  chartMetric === m
                    ? 'bg-[#2563eb] text-white border-[#2563eb]'
                    : 'bg-white text-slate-500 border-slate-200'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {portSeries && !metricSeries && (
            <div className="text-center py-10 text-slate-400 text-xs">
              No data for this period.
            </div>
          )}

          {!portSeries && !histLoading && (
            <div className="text-center py-10 text-slate-400 text-xs">
              No price history available.
            </div>
          )}

          {metricSeries && rechartsData.length > 0 && (
            <>
              {/* Stat line */}
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-[15px] font-bold" style={{ color: lastColor }}>
                  {chartLast !== null
                    ? isPct
                      ? `${chartLast >= 0 ? '+' : ''}${chartLast.toFixed(2)}%`
                      : fmt(chartLast, currency)
                    : '—'
                  }
                </span>
                {chartChange !== null && !isPct && (
                  <span className="text-[10px]" style={{ color: chartChange >= 0 ? '#0a7a42' : '#be1c1c' }}>
                    {fmtGainLine(chartChange, null, currency)} in period
                  </span>
                )}
                {chartChange !== null && isPct && (
                  <span className="text-[10px] text-slate-400">
                    {chartChange >= 0 ? '+' : ''}{chartChange.toFixed(2)}pp in period
                  </span>
                )}
              </div>

              {/* Line chart */}
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={rechartsData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="t"
                    tick={{ fontSize: 8, fill: '#94a3b8' }}
                    interval={Math.max(0, Math.floor(rechartsData.length / 5) - 1)}
                    tickFormatter={(d: string) => {
                      const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
                      const [yr, mo, day] = d.split('-')
                      const moIdx = parseInt(mo, 10) - 1
                      const dayNum = parseInt(day, 10)
                      if (chartRange === '1m' || chartRange === '3m' || chartRange === '6m') return `${dayNum} ${MONTHS[moIdx]}`
                      if (chartRange === '1y') return MONTHS[moIdx]
                      return `${MONTHS[moIdx]} '${yr.slice(2)}`
                    }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 8, fill: '#94a3b8' }}
                    tickFormatter={yTickFmt}
                    width={48}
                    tickLine={false}
                    axisLine={false}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip
                    formatter={(v: number) => [
                      isPct
                        ? `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
                        : fmt(v, currency),
                      chartMetric,
                    ]}
                    contentStyle={{ fontSize: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}
                    labelStyle={{ fontSize: 9, color: '#94a3b8' }}
                  />
                  {ZERO_LINE_METRICS.has(chartMetric) && (
                    <ReferenceLine y={0} stroke="#cbd5e1" strokeDasharray="3 3" strokeWidth={1} />
                  )}
                  <Line
                    type="monotone"
                    dataKey="v"
                    stroke={lineColor}
                    strokeWidth={1.5}
                    dot={false}
                    activeDot={{ r: 3, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>

              {/* Range selector — segmented control */}
              <div className="flex bg-slate-100 rounded-lg p-0.5 mt-3">
                {RANGES.map(r => (
                  <button
                    key={r}
                    onClick={() => setChartRange(r)}
                    className={`flex-1 text-[10px] py-1 rounded-md font-medium transition-all ${
                      chartRange === r
                        ? 'bg-white text-[#2563eb] shadow-sm'
                        : 'text-slate-400'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Analysis tab ── */}
      {activeTab === 'analysis' && (
        <div>
          {/* Sub-tab bar */}
          <div className="flex gap-2 mb-4">
            {(['allocation', 'benchmarking'] as const).map(st => {
              const colors = {
                allocation:   analysisSubTab === st ? 'bg-amber-50 text-amber-600' : 'text-slate-400',
                benchmarking: analysisSubTab === st ? 'bg-sky-50 text-sky-600' : 'text-slate-400',
              }
              return (
                <button
                  key={st}
                  onClick={() => setAnalysisSubTab(st)}
                  className={`text-[11px] px-3 py-1 rounded-full font-medium transition-colors whitespace-nowrap ${colors[st]}`}
                >
                  {st === 'allocation' ? 'Allocation' : 'Benchmarking'}
                </button>
              )
            })}
          </div>

          {analysisSubTab === 'allocation' && (
            <div>
              {(() => {
                const symToYf = new Map(filteredHoldings.map(h => [h.symbol, h.yf_symbol]))
                const totalValue = sectorData.reduce((sum, s) => sum + s.value, 0)
                const fmtTodayGain = (v: number) =>
                  `${v >= 0 ? '+' : '-'}${fmtCompact(Math.abs(v), currency)}`
                return (
                  <div>
                    <div className="border border-slate-200 rounded-xl mb-3">
                    <button className="flex items-center gap-1 w-full text-left text-[8px] font-semibold text-slate-500 uppercase tracking-widest px-3 py-2.5" onClick={() => setSectorSectionOpen(o => !o)}>
                      By Sector <span className="text-[7px] text-slate-300 ml-0.5">{sectorSectionOpen ? '▲' : '▼'}</span>
                    </button>
                    {sectorSectionOpen && <div className="flex items-center gap-1.5 px-2 pb-1">
                      <span className="text-[7px] font-semibold text-slate-500 flex-1">Sector</span>
                      <span className="text-[7px] font-semibold text-slate-500 w-[52px]">Allocation</span>
                      <span className="text-[7px] font-semibold text-slate-500 w-[48px]">Value</span>
                      <span className="text-[7px] font-semibold text-slate-500 w-[40px]">XIRR</span>
                      <span className="text-[7px] font-semibold text-slate-500 w-[80px]">Today</span>
                      <span className="w-[8px]" />
                    </div>}
                    {sectorSectionOpen && sectorData.map(s => {
                      const isOpen = expandedAllocSectors.has(s.name)
                      const sectorAllocRows = allocGroupedRows
                        .filter(r => getSectorForHolding(symToYf.get(r.navSym) ?? r.navSym) === s.name)
                        .sort((a, b) => b.current - a.current)

                      // Sector XIRR — weighted average by current value
                      let sXirrNum = 0, sXirrDen = 0
                      for (const r of sectorAllocRows) {
                        const x = allocXirrMap.get(r.key) ?? null
                        if (x !== null && r.current > 0) { sXirrNum += x * r.current; sXirrDen += r.current }
                      }
                      const sXirr = sXirrDen > 0 ? sXirrNum / sXirrDen : null

                      // Sector today gain
                      const hasTodayData = sectorAllocRows.some(r => r.todayGain !== null)
                      const sTodayGain = hasTodayData
                        ? sectorAllocRows.reduce((sum, r) => sum + (r.todayGain ?? 0), 0)
                        : null
                      const sPriorValue = sTodayGain !== null ? s.value - sTodayGain : null
                      const sTodayPct = sTodayGain !== null && sPriorValue ? sTodayGain / sPriorValue * 100 : null

                      const sXirrColor = sXirr !== null ? (sXirr >= 0 ? 'text-green-600' : 'text-red-400') : 'text-slate-400'
                      const sTodayColor = sTodayPct !== null ? (sTodayPct >= 0 ? 'text-green-600' : 'text-red-400') : 'text-slate-400'

                      return (
                        <div key={s.name} className="border border-slate-100 rounded-lg mb-1">
                          <button
                            className="w-full px-2 py-1.5 text-left active:opacity-60"
                            onClick={() => setExpandedAllocSectors(prev => {
                              const next = new Set(prev)
                              next.has(s.name) ? next.delete(s.name) : next.add(s.name)
                              return next
                            })}
                          >
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="flex-1 min-w-0 flex items-center gap-1">
                                <span className="text-[10px] font-medium text-slate-700 truncate">{s.name}</span>
                                <span className="text-[8px] text-slate-400 whitespace-nowrap shrink-0">({sectorAllocRows.length} holdings)</span>
                              </span>
                              <span className="text-[9px] text-slate-500 whitespace-nowrap w-[52px]">{s.pct.toFixed(1)}%</span>
                              <span className="text-[9px] font-medium text-slate-700 whitespace-nowrap w-[48px]">{fmtCompact(s.value, currency)}</span>
                              <span className={`text-[9px] font-medium whitespace-nowrap w-[40px] ${sXirrColor}`}>{sXirr !== null ? `${sXirr >= 0 ? '+' : ''}${sXirr.toFixed(1)}%` : '—'}</span>
                              <span className={`text-[8px] font-medium whitespace-nowrap w-[80px] ${sTodayColor}`}>
                                {sTodayGain !== null ? `${fmtTodayGain(sTodayGain)}${sTodayPct !== null ? ` (${sTodayPct >= 0 ? '+' : ''}${sTodayPct.toFixed(1)}%)` : ''}` : '—'}
                              </span>
                              <span className="text-[8px] text-slate-300 w-[8px]">{isOpen ? '▲' : '▼'}</span>
                            </div>
                            <div className="h-1.5 rounded-full overflow-hidden bg-slate-100">
                              <div className="h-full rounded-full" style={{ width: `${s.pct}%`, backgroundColor: SECTOR_COLOR[s.name] }} />
                            </div>
                          </button>
                          {isOpen && sectorAllocRows.length > 0 && (
                            <div className="border-t border-slate-100">
                              <div className="py-2 space-y-1.5">
                                {sectorAllocRows.map(r => {
                                  const hPct = totalValue > 0 ? r.current / totalValue * 100 : 0
                                  const hXirr = allocXirrMap.get(r.key) ?? null
                                  const xirrColor = hXirr !== null ? (hXirr >= 0 ? 'text-green-600' : 'text-red-400') : 'text-slate-400'
                                  const todayColor = r.todayPct !== null ? (r.todayPct >= 0 ? 'text-green-600' : 'text-red-400') : 'text-slate-400'
                                  return (
                                    <div key={r.key} className="flex items-center gap-1.5 bg-slate-50 rounded-lg px-2 py-1.5">
                                      <div className="flex-1 min-w-0">
                                        <span className="text-[10px] text-slate-600 truncate block">{r.subLabel || r.ticker}</span>
                                      </div>
                                      <span className="text-[9px] text-slate-500 w-[52px] whitespace-nowrap">{hPct.toFixed(1)}%</span>
                                      <span className="text-[9px] font-medium text-slate-700 w-[48px] whitespace-nowrap">{fmtCompact(r.current, currency)}</span>
                                      <span className={`text-[9px] font-medium w-[40px] whitespace-nowrap ${xirrColor}`}>{hXirr !== null ? `${hXirr >= 0 ? '+' : ''}${hXirr.toFixed(1)}%` : '—'}</span>
                                      <span className={`text-[8px] font-medium whitespace-nowrap w-[80px] ${todayColor}`}>
                                        {r.todayGain !== null ? `${fmtTodayGain(r.todayGain)}${r.todayPct !== null ? ` (${r.todayPct >= 0 ? '+' : ''}${r.todayPct.toFixed(1)}%)` : ''}` : '—'}
                                      </span>
                                      <span className="w-[8px]" />
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                    </div>
                    <div className="border border-slate-200 rounded-xl">
                    <button className="flex items-center gap-1 w-full text-left text-[8px] font-semibold text-slate-500 uppercase tracking-widest px-3 py-2.5" onClick={() => setMktCapSectionOpen(o => !o)}>
                      By Market Cap <span className="text-[7px] text-slate-300 ml-0.5">{mktCapSectionOpen ? '▲' : '▼'}</span>
                    </button>
                    {mktCapSectionOpen && <div className="flex items-center gap-1.5 px-2 pb-1">
                      <span className="text-[7px] font-semibold text-slate-500 flex-1">Bucket</span>
                      <span className="text-[7px] font-semibold text-slate-500 w-[52px]">Allocation</span>
                      <span className="text-[7px] font-semibold text-slate-500 w-[48px]">Value</span>
                      <span className="text-[7px] font-semibold text-slate-500 w-[40px]">XIRR</span>
                      <span className="text-[7px] font-semibold text-slate-500 w-[80px]">Today</span>
                      <span className="w-[8px]" />
                    </div>}
                    {mktCapSectionOpen && mktCapData.map(b => {
                      const isOpen = expandedMktCapBuckets.has(b.name)
                      const bucketAllocRows = allocGroupedRows
                        .filter(r => getMarketCapForHolding(symToYf.get(r.navSym) ?? r.navSym) === b.name)
                        .sort((x, y) => y.current - x.current)

                      let sXirrNum = 0, sXirrDen = 0
                      for (const r of bucketAllocRows) {
                        const x = allocXirrMap.get(r.key) ?? null
                        if (x !== null && r.current > 0) { sXirrNum += x * r.current; sXirrDen += r.current }
                      }
                      const sXirr = sXirrDen > 0 ? sXirrNum / sXirrDen : null

                      const hasTodayData = bucketAllocRows.some(r => r.todayGain !== null)
                      const sTodayGain = hasTodayData
                        ? bucketAllocRows.reduce((sum, r) => sum + (r.todayGain ?? 0), 0)
                        : null
                      const sPriorValue = sTodayGain !== null ? b.value - sTodayGain : null
                      const sTodayPct = sTodayGain !== null && sPriorValue ? sTodayGain / sPriorValue * 100 : null

                      const sXirrColor = sXirr !== null ? (sXirr >= 0 ? 'text-green-600' : 'text-red-400') : 'text-slate-400'
                      const sTodayColor = sTodayPct !== null ? (sTodayPct >= 0 ? 'text-green-600' : 'text-red-400') : 'text-slate-400'

                      return (
                        <div key={b.name} className="border border-slate-100 rounded-lg mb-1">
                          <button
                            className="w-full px-2 py-1.5 text-left active:opacity-60"
                            onClick={() => setExpandedMktCapBuckets(prev => {
                              const next = new Set(prev)
                              next.has(b.name) ? next.delete(b.name) : next.add(b.name)
                              return next
                            })}
                          >
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="flex-1 min-w-0 flex items-center gap-1">
                                <span className="text-[10px] font-medium text-slate-700 truncate">{b.name}</span>
                                <span className="text-[8px] text-slate-400 whitespace-nowrap shrink-0">({bucketAllocRows.length} holdings)</span>
                              </span>
                              <span className="text-[9px] text-slate-500 whitespace-nowrap w-[52px]">{b.pct.toFixed(1)}%</span>
                              <span className="text-[9px] font-medium text-slate-700 whitespace-nowrap w-[48px]">{fmtCompact(b.value, currency)}</span>
                              <span className={`text-[9px] font-medium whitespace-nowrap w-[40px] ${sXirrColor}`}>{sXirr !== null ? `${sXirr >= 0 ? '+' : ''}${sXirr.toFixed(1)}%` : '—'}</span>
                              <span className={`text-[8px] font-medium whitespace-nowrap w-[80px] ${sTodayColor}`}>
                                {sTodayGain !== null ? `${fmtTodayGain(sTodayGain)}${sTodayPct !== null ? ` (${sTodayPct >= 0 ? '+' : ''}${sTodayPct.toFixed(1)}%)` : ''}` : '—'}
                              </span>
                              <span className="text-[8px] text-slate-300 w-[8px]">{isOpen ? '▲' : '▼'}</span>
                            </div>
                            <div className="h-1.5 rounded-full overflow-hidden bg-slate-100">
                              <div className="h-full rounded-full" style={{ width: `${b.pct}%`, backgroundColor: MARKET_CAP_COLOR[b.name] }} />
                            </div>
                          </button>
                          {isOpen && bucketAllocRows.length > 0 && (
                            <div className="border-t border-slate-100">
                              <div className="py-2 space-y-1.5">
                                {bucketAllocRows.map(r => {
                                  const hPct = totalValue > 0 ? r.current / totalValue * 100 : 0
                                  const hXirr = allocXirrMap.get(r.key) ?? null
                                  const xirrColor = hXirr !== null ? (hXirr >= 0 ? 'text-green-600' : 'text-red-400') : 'text-slate-400'
                                  const todayColor = r.todayPct !== null ? (r.todayPct >= 0 ? 'text-green-600' : 'text-red-400') : 'text-slate-400'
                                  return (
                                    <div key={r.key} className="flex items-center gap-1.5 bg-slate-50 rounded-lg px-2 py-1.5">
                                      <div className="flex-1 min-w-0">
                                        <span className="text-[10px] text-slate-600 truncate block">{r.subLabel || r.ticker}</span>
                                      </div>
                                      <span className="text-[9px] text-slate-500 w-[52px] whitespace-nowrap">{hPct.toFixed(1)}%</span>
                                      <span className="text-[9px] font-medium text-slate-700 w-[48px] whitespace-nowrap">{fmtCompact(r.current, currency)}</span>
                                      <span className={`text-[9px] font-medium w-[40px] whitespace-nowrap ${xirrColor}`}>{hXirr !== null ? `${hXirr >= 0 ? '+' : ''}${hXirr.toFixed(1)}%` : '—'}</span>
                                      <span className={`text-[8px] font-medium whitespace-nowrap w-[80px] ${todayColor}`}>
                                        {r.todayGain !== null ? `${fmtTodayGain(r.todayGain)}${r.todayPct !== null ? ` (${r.todayPct >= 0 ? '+' : ''}${r.todayPct.toFixed(1)}%)` : ''}` : '—'}
                                      </span>
                                      <span className="w-[8px]" />
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                    </div>
                  </div>
                )
              })()}
            </div>
          )}

          {analysisSubTab === 'benchmarking' && (
            <div>
              {benchLoading && (
                <div className="py-10 text-center text-[11px] text-slate-400">
                  Loading benchmark data…
                </div>
              )}

              {!benchLoading && benchHasError && (
                <div className="py-6 text-center text-[11px] text-red-400">
                  Could not load one or more benchmarks.
                </div>
              )}

              {!benchLoading && !benchHasError && benchSectors.length > 0 && (
                <div>
                  {/* Overall card */}
                  <div className="bg-slate-50 rounded-lg px-3 py-2 mb-3 border border-slate-100">
                    <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Overall</p>
                    <div className="grid grid-cols-3 gap-1">
                      <div>
                        <p className="text-[7px] text-slate-400">Your XIRR</p>
                        <p className="text-[13px] font-bold text-slate-800 whitespace-nowrap">
                          {benchActualXirr !== null ? `${benchActualXirr >= 0 ? '+' : ''}${benchActualXirr.toFixed(1)}%` : '—'}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-[7px] text-slate-400">Benchmark</p>
                        <p className="text-[13px] font-bold text-slate-500 whitespace-nowrap">
                          {benchBenchXirr !== null ? `${benchBenchXirr >= 0 ? '+' : ''}${benchBenchXirr.toFixed(1)}%` : '—'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[7px] text-slate-400">Alpha</p>
                        <p className={`text-[13px] font-bold whitespace-nowrap ${benchAlpha !== null ? benchAlpha >= 0 ? 'text-green-500' : 'text-red-400' : 'text-slate-400'}`}>
                          {benchAlpha !== null ? `${benchAlpha >= 0 ? '+' : ''}${benchAlpha.toFixed(1)}%` : '—'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {(() => {
                    const symToYf = new Map(filteredHoldings.map(h => [h.symbol, h.yf_symbol]))
                    const fmtX = (v: number | null) => v !== null ? `${v >= 0 ? '+' : ''}${v.toFixed(1)}%` : '—'
                    const maxXirr = Math.max(...benchSectors.map(s => Math.abs(s.actualXirr ?? 0)), 1)
                    return (
                      <div>
                        {benchSectors.map(s => {
                          const isOpen = expandedSectors.has(s.sector)
                          const sectorRows = rows.filter(r =>
                            getSectorForHolding(symToYf.get(r.navSym) ?? r.navSym) === s.sector
                          )
                          const barPct = Math.max(0, s.actualXirr ?? 0) / maxXirr * 100
                          const xirrColor = s.actualXirr !== null ? s.actualXirr >= 0 ? 'text-green-600' : 'text-red-400' : 'text-slate-400'
                          return (
                            <div key={s.sector} className="border border-slate-100 rounded-lg mb-1">
                              <button
                                className="w-full px-2 py-1.5 text-left active:opacity-60"
                                onClick={() => setExpandedSectors(prev => {
                                  const next = new Set(prev)
                                  next.has(s.sector) ? next.delete(s.sector) : next.add(s.sector)
                                  return next
                                })}
                              >
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-[10px] font-medium text-slate-700 flex-1 truncate">{s.sector}</span>
                                  <span className="text-[7px] text-slate-400 whitespace-nowrap">{sectorRows.length} · {BENCHMARK_LABEL[s.benchSymbol] ?? s.benchSymbol}</span>
                                  <span className="text-[7px] text-slate-400 whitespace-nowrap">vs {fmtX(s.benchXirr)}</span>
                                  <span className={`text-[10px] font-semibold whitespace-nowrap w-[40px] text-right ${xirrColor}`}>{fmtX(s.actualXirr)}</span>
                                  <span className="text-[8px] text-slate-300 w-[8px] text-right">{isOpen ? '▲' : '▼'}</span>
                                </div>
                                <div className="h-1.5 rounded-full overflow-hidden bg-slate-100">
                                  <div className="h-full rounded-full" style={{ width: `${barPct}%`, backgroundColor: SECTOR_COLOR[s.sector] }} />
                                </div>
                              </button>
                              {isOpen && sectorRows.length > 0 && (
                                <div className="px-2 pb-1.5 space-y-1 border-t border-slate-100">
                                  {sectorRows.map(r => {
                                    const hXirr   = xirrMap.get(r.key) ?? null
                                    const yfSym   = symToYf.get(r.navSym) ?? r.navSym
                                    const hBenchX = holdingBenchXirr.get(yfSym) ?? null
                                    const hBarPct = Math.max(0, hXirr ?? 0) / maxXirr * 100
                                    const hColor  = hXirr !== null ? hXirr >= 0 ? 'text-green-600' : 'text-red-400' : 'text-slate-400'
                                    return (
                                      <div key={r.key}>
                                        <div className="flex items-center gap-2 mb-0.5">
                                          <div className="flex-1 min-w-0">
                                            <span className="text-[10px] text-slate-600 truncate block">{r.subLabel || r.ticker}</span>
                                            <span className="text-[7px] text-slate-400">{r.ticker}</span>
                                          </div>
                                          <span className="text-[7px] text-slate-400 whitespace-nowrap">vs {fmtX(hBenchX)}</span>
                                          <span className={`text-[10px] font-semibold whitespace-nowrap w-[40px] text-right ${hColor}`}>{fmtX(hXirr)}</span>
                                          <span className="w-[8px]" />
                                        </div>
                                        <div className="h-1 rounded-full overflow-hidden bg-slate-100">
                                          <div className="h-full rounded-full" style={{ width: `${hBarPct}%`, backgroundColor: SECTOR_COLOR[s.sector] + 'AA' }} />
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
