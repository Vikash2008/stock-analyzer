import React, { useMemo, useState, useEffect, useRef } from 'react'
import { AddTransactionModal } from '../components/AddTransactionModal'
import { PullHoldingsModal } from '../components/PullHoldingsModal'
import { DeleteHoldingModal } from '../components/DeleteHoldingModal'
import { ManagePortfolioModal } from '../components/ManagePortfolioModal'
import { DividendsTab } from '../components/DividendsTab'
import { FxGainsTab } from '../components/FxGainsTab'
import { useDividends, useRefreshAllDividends, getIncludeDividends, getIncludeFxGains, getDividendsLastFetched } from '../hooks/useDividends'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import {
  LineChart, Line, BarChart, Bar, ComposedChart,
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
  PieChart, Pie, Cell, LabelList,
} from 'recharts'
import { usePortfolio } from '../hooks/usePortfolio'
import { logDebug } from '../utils/debugLog'
import { useQueryClient } from '@tanstack/react-query'
import { usePortfolioHistory, sliceSeries } from '../hooks/usePortfolioHistory'
import { usePrefetchHoldingCharts, REFRESH_MS } from '../hooks/useHistory'
import type { DatedSeries, PortfolioSeries } from '../hooks/usePortfolioHistory'
import { HoldingCard } from '../components/HoldingCard'
import { SummaryCard } from '../components/SummaryCard'
import { LoadingSkeleton, ErrorState } from '../components/LoadingSkeleton'
import { aggRealized, realizedForPorts } from '../utils/realized'
import { SKIP_PORTS, USD_PORTS } from '../utils/segments'
import { getLabel, resolveLabel, filterByLabel } from '../utils/buckets'
import { fmt, fmtGainLine, fmtCompact } from '../utils/fmt'
import { getSectorForHolding, SECTOR_COLOR, BENCHMARK_LABEL, type SectorKey, getMarketCapForHolding, MARKET_CAP_COLOR, type MarketCapKey } from '../utils/sectors'
import { useBenchmarkXirr, useRefreshAllBenchmarks } from '../hooks/useBenchmarkXirr'
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

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const PIE_COLORS = [
  '#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444',
  '#06b6d4','#ec4899','#84cc16','#f97316','#6366f1',
  '#14b8a6','#a855f7','#22c55e','#eab308','#e11d48',
  '#0ea5e9','#d946ef','#4ade80','#fb923c','#818cf8',
]

const METRIC_STYLE: Record<ChartMetric, { active: string; inactive: string; line: string; strip: string; sync: string; trackBg: string }> = {
  'Portfolio Value':  { active: 'bg-blue-600 text-white shadow-sm border border-blue-700',           inactive: 'bg-blue-100 text-blue-600 border border-blue-200',    line: '#3b82f6', strip: 'bg-blue-50 border-blue-100',    sync: 'bg-gradient-to-br from-blue-600 to-blue-800 border-blue-700',    trackBg: '#bfdbfe88' },
  'Invested':         { active: 'bg-violet-600 text-white shadow-sm border border-violet-700',        inactive: 'bg-violet-100 text-violet-600 border border-violet-200',  line: '#8b5cf6', strip: 'bg-violet-50 border-violet-100', sync: 'bg-gradient-to-br from-violet-600 to-purple-800 border-violet-700', trackBg: '#ddd6fe88' },
  'Unrealized Gains': { active: 'bg-teal-500 text-white shadow-sm border border-teal-600',            inactive: 'bg-teal-100 text-teal-700 border border-teal-200',    line: '#14b8a6', strip: 'bg-teal-50 border-teal-100',    sync: 'bg-gradient-to-br from-teal-600 to-emerald-700 border-teal-700',  trackBg: '#99f6e488' },
  'Realized Gains':   { active: 'bg-pink-600 text-white shadow-sm border border-pink-700',            inactive: 'bg-pink-100 text-pink-600 border border-pink-200',    line: '#ec4899', strip: 'bg-pink-50 border-pink-100',    sync: 'bg-gradient-to-br from-pink-600 to-rose-700 border-pink-700',     trackBg: '#fbcfe888' },
  'Total Gains':      { active: 'bg-emerald-600 text-white shadow-sm border border-emerald-700',      inactive: 'bg-emerald-100 text-emerald-700 border border-emerald-200', line: '#10b981', strip: 'bg-emerald-50 border-emerald-100', sync: 'bg-gradient-to-br from-emerald-600 to-green-800 border-emerald-700', trackBg: '#bbf7d088' },
  'Return %':         { active: 'bg-sky-500 text-white shadow-sm border border-sky-600',              inactive: 'bg-sky-100 text-sky-600 border border-sky-200',     line: '#0ea5e9', strip: 'bg-sky-50 border-sky-100',      sync: 'bg-gradient-to-br from-sky-600 to-cyan-700 border-sky-700',       trackBg: '#bae6fd88' },
  'XIRR Trend':       { active: 'bg-rose-500 text-white shadow-sm border border-rose-600',            inactive: 'bg-rose-100 text-rose-600 border border-rose-200',    line: '#f43f5e', strip: 'bg-rose-50 border-rose-100',    sync: 'bg-gradient-to-br from-rose-600 to-pink-800 border-rose-700',     trackBg: '#fecdd388' },
}

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
): CardRow[] {
  if (mode === 'standalone') {
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

  // Backfill portfolios that no longer hold this symbol (fully closed position) but still
  // contributed realized gain/cost — otherwise their transaction history silently drops out
  // of the merged card's nav target and its realized total understates the true gain.
  for (const [key, [rg, rc]] of realizedMap) {
    const ci   = key.indexOf(':')
    const port = key.slice(0, ci)
    const sym  = key.slice(ci + 1)
    if (SKIP_PORTS.has(port)) continue
    const existing = map.get(sym)
    if (existing && !existing.portfolios.includes(port)) {
      existing.portfolios.push(port)
      existing.realGain += rg
      existing.realCost += rc
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
  const { portfolio, segment, bucket: bucketParam, label: labelParam } = useParams<{ portfolio?: string; segment?: string; bucket?: string; label?: string }>()
  const bucket = bucketParam ? decodeURIComponent(bucketParam) : undefined
  const label  = labelParam  ? decodeURIComponent(labelParam)  : undefined
  const { data, isLoading, error } = usePortfolio(currency)
  // Pre-fetch history for ALL holdings across all portfolios so switching portfolio views
  // hits cache instead of waiting for per-symbol fetches to restart.
  const allSymbols = useMemo(
    () => data ? [...new Set(data.holdings.map((h: Holding) => h.yf_symbol))] : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data?.holdings.length],
  )
  usePrefetchHoldingCharts(allSymbols)
  const { data: divData, isLoading: divLoading, isFetching: divFetching } = useDividends(portfolio)
  const refreshAllDividends = useRefreshAllDividends()
  const [includeDivs, setIncludeDivs] = useState(getIncludeDividends)
  useEffect(() => {
    const handler = () => setIncludeDivs(getIncludeDividends())
    window.addEventListener('dividends-toggle', handler)
    return () => window.removeEventListener('dividends-toggle', handler)
  }, [])
  const [includeFxGains, setIncludeFxGainsLocal] = useState(getIncludeFxGains)
  useEffect(() => {
    const handler = () => setIncludeFxGainsLocal(getIncludeFxGains())
    window.addEventListener('fxgains-toggle', handler)
    return () => window.removeEventListener('fxgains-toggle', handler)
  }, [])
  const [viewMode,    setViewMode]    = useState<'cumulative' | 'standalone'>(
    () => (localStorage.getItem('hp:viewMode') as 'cumulative' | 'standalone') ?? 'cumulative'
  )
  const [holdingFilter, setHoldingFilter] = useState<'open' | 'closed' | 'all'>(
    () => (localStorage.getItem('hp:holdingFilter') as 'open' | 'closed' | 'all') ?? 'all'
  )
  const [activeTab,   setActiveTab]   = useState<'holdings' | 'charts' | 'analysis' | 'dividends' | 'fx'>(
    () => (localStorage.getItem('hp:activeTab') as 'holdings' | 'charts' | 'analysis' | 'dividends' | 'fx') ?? 'holdings'
  )
  const [analysisSubTab, setAnalysisSubTab] = useState<'allocation' | 'benchmarking' | 'returns'>('allocation')
  const [chartMetric, setChartMetric] = useState<ChartMetric>('Portfolio Value')
  const [chartRange,  setChartRange]  = useState<ChartRange>('1y')
  const [sortField,   setSortField]   = useState<SortField>(
    () => (localStorage.getItem('hp:sortField') as SortField) ?? 'current'
  )
  const [sortDir,     setSortDir]     = useState<'desc' | 'asc'>(
    () => (localStorage.getItem('hp:sortDir') as 'desc' | 'asc') ?? 'desc'
  )
  const [sortOpen,    setSortOpen]    = useState(false)
  const [searchQuery,  setSearchQuery]  = useState('')
  const [sectorFilter, setSectorFilter] = useState<SectorKey | 'all'>(
    () => (localStorage.getItem('hp:sectorFilter') as SectorKey | 'all') ?? 'all'
  )
  const [sectorOpen,   setSectorOpen]   = useState(false)
  const [settingsOpen,   setSettingsOpen]   = useState(false)
  const [addHoldingOpen, setAddHoldingOpen] = useState(false)
  const [manageOpen, setManageOpen] = useState(false)
  const [deleteHoldingOpen, setDeleteHoldingOpen] = useState(false)
  const [manageMenuOpen, setManageMenuOpen] = useState(false)
  const [showClosed,   setShowClosed]   = useState(
    () => localStorage.getItem('hp:showClosed') === 'true'
  )
  useEffect(() => {
    localStorage.setItem('hp:holdingFilter', holdingFilter)
    localStorage.setItem('hp:showClosed',    String(showClosed))
    localStorage.setItem('hp:activeTab',     activeTab)
    localStorage.setItem('hp:viewMode',      viewMode)
    localStorage.setItem('hp:sortField',     sortField)
    localStorage.setItem('hp:sortDir',       sortDir)
    localStorage.setItem('hp:sectorFilter',  sectorFilter)
  }, [holdingFilter, showClosed, activeTab, viewMode, sortField, sortDir, sectorFilter])
  const [syncing,        setSyncing]        = useState(false)
  const [benchSyncing,   setBenchSyncing]   = useState(false)
  const refreshAllBenchmarks = useRefreshAllBenchmarks()
  const [histLastSynced,  setHistLastSynced]  = useState<Date | null>(null)
  const [chartsUpToDate,  setChartsUpToDate]  = useState(false)
  const [benchLastSynced, setBenchLastSynced] = useState<Date | null>(null)
  const [divSyncing,      setDivSyncing]      = useState(false)
  const [divLastSynced,   setDivLastSynced]   = useState<Date | null>(null)
  const [divUpToDate,     setDivUpToDate]     = useState(false)
  const [divSkipped,      setDivSkipped]      = useState<string[]>([])
  const [expandedSectors,     setExpandedSectors]     = useState<Set<string>>(new Set())
  const [benchSectorSectionOpen, setBenchSectorSectionOpen] = useState(true)
  const [concentrationTop, setConcentrationTop] = useState<5 | 10 | 20>(10)
  const [expandedAllocSectors,     setExpandedAllocSectors]     = useState<Set<string>>(new Set())
  const [expandedMktCapBuckets,    setExpandedMktCapBuckets]    = useState<Set<string>>(new Set())
  const [sectorSectionOpen,        setSectorSectionOpen]        = useState(true)
  const [mktCapSectionOpen,        setMktCapSectionOpen]        = useState(false)
  const [concentrationSectionOpen, setConcentrationSectionOpen] = useState(false)
  const [returnsMode,   setReturnsMode]   = useState<'year' | 'month'>('year')
  const [returnsYears,  setReturnsYears]  = useState<number[]>([new Date().getFullYear()])
  const [returnsMetric] = useState<'gains'>('gains')
  const [returnsSector, setReturnsSector] = useState<SectorKey | 'all'>('all')
  const [returnsConfigOpen, setReturnsConfigOpen] = useState(false)
  const [benchConfigOpen,  setBenchConfigOpen]  = useState(false)
  const [chartZoomed,      setChartZoomed]      = useState(false)
  const [benchDateEnabled, setBenchDateEnabled] = useState(false)
  const [benchStartMonth,  setBenchStartMonth]  = useState(1)
  const [benchStartYear,   setBenchStartYear]   = useState(new Date().getFullYear() - 1)
  const [benchEndMonth,    setBenchEndMonth]    = useState(new Date().getMonth() + 1)
  const [benchEndYear,     setBenchEndYear]     = useState(new Date().getFullYear())
  const qc = useQueryClient()

  const pendingScrollY = useRef<number | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const key = `holdingsScroll:${location.pathname}`
    const saved = sessionStorage.getItem(key)
    if (saved) {
      sessionStorage.removeItem(key)
      pendingScrollY.current = parseInt(saved, 10)
    } else {
      if (scrollRef.current) scrollRef.current.scrollTop = 0
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps


  const realizedMap = useMemo(
    () => (data ? aggRealized(data.realized, data.usd_inr) : new Map()),
    [data],
  )

  // Realized rows don't carry quote_type — resolve a symbol's Asset Class via any holding/
  // transaction that has it, same "first matching row" precedent used elsewhere in this file.
  const quoteTypeBySymbol = useMemo(() => {
    const map = new Map<string, string>()
    if (!data) return map
    for (const h of data.holdings) map.set(h.symbol, h.quote_type)
    return map
  }, [data])

  const filteredHoldings = useMemo(() => {
    if (!data) return []
    let h = data.holdings.filter(r => !SKIP_PORTS.has(r.portfolio))
    if (portfolio) h = h.filter(r => r.portfolio === portfolio)
    else if (bucket && label) h = filterByLabel(h, bucket, label)
    return h
  }, [data, portfolio, bucket, label])

  const sectorData = useMemo(() => {
    const map = new Map<SectorKey, { value: number; count: number; todayGain: number }>()
    for (const h of filteredHoldings) {
      const sector = getSectorForHolding(h.yf_symbol)
      const e = map.get(sector) ?? { value: 0, count: 0, todayGain: 0 }
      map.set(sector, { value: e.value + h.disp_current, count: e.count + 1, todayGain: e.todayGain + (h.disp_today_gain ?? 0) })
    }
    const total = [...map.values()].reduce((s, v) => s + v.value, 0)
    return [...map.entries()]
      .map(([name, { value, count, todayGain }]) => ({ name, value, count, pct: total > 0 ? value / total * 100 : 0, todayGain }))
      .sort((a, b) => b.value - a.value)
  }, [filteredHoldings])

  const mktCapData = useMemo(() => {
    const map = new Map<MarketCapKey, { value: number; count: number; todayGain: number }>()
    for (const h of filteredHoldings) {
      const bucket = getMarketCapForHolding(h.yf_symbol)
      const e = map.get(bucket) ?? { value: 0, count: 0, todayGain: 0 }
      map.set(bucket, { value: e.value + h.disp_current, count: e.count + 1, todayGain: e.todayGain + (h.disp_today_gain ?? 0) })
    }
    const total = [...map.values()].reduce((s, v) => s + v.value, 0)
    return [...map.entries()]
      .map(([name, { value, count, todayGain }]) => ({ name, value, count, pct: total > 0 ? value / total * 100 : 0, todayGain }))
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

    if (segment === 'total') {
      // Every realized record, regardless of Bucket/Label — this is the "ALL holdings" view.
      for (const r of data?.realized ?? []) {
        if (SKIP_PORTS.has(r.portfolio)) continue
        const fx = r.currency === 'USD' ? data!.usd_inr : 1.0
        realGain += r.realized_pnl * fx
        realCost += r.quantity * r.buy_price * fx
      }
    } else if (bucket && label && data) {
      // Includes fully-exited positions (not in filteredHoldings) via quoteTypeBySymbol fallback.
      for (const r of data.realized) {
        if (SKIP_PORTS.has(r.portfolio)) continue
        if (resolveLabel(r.tags, bucket, quoteTypeBySymbol.get(r.symbol)) !== label) continue
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
  }, [filteredHoldings, realizedMap, segment, bucket, label, data, quoteTypeBySymbol])

  const rows = useMemo(
    () => buildRows(filteredHoldings, realizedMap, viewMode),
    [filteredHoldings, realizedMap, viewMode],
  )

  // FX gain per symbol — only populated when toggle is ON; sums across portfolios for cumulative views
  const fxGainBySymbol = useMemo(() => {
    if (!includeFxGains) return new Map<string, number>()
    const map = new Map<string, number>()
    for (const h of filteredHoldings) {
      if (!h.disp_fx_gain || !USD_PORTS.has(h.portfolio)) continue
      map.set(h.symbol, (map.get(h.symbol) ?? 0) + h.disp_fx_gain)
    }
    return map
  }, [includeFxGains, filteredHoldings])

  // fx_lots filtered to the current portfolio/segment/bucket-label view
  const filteredFxLots = useMemo(() => {
    if (!data) return []
    const lots = data.fx_lots ?? []
    if (portfolio) return lots.filter(lot => lot.portfolio === portfolio)
    if (segment) {
      const usdSegments = new Set(['us_stock', 'total', 'stk'])
      return usdSegments.has(segment) ? lots : []
    }
    // Bucket/label views (e.g. Asset Class → "Mutual Fund") previously fell through to
    // "show everything" — dumping the full USD fx-lots list onto views that hold no USD
    // stocks at all. Resolve each lot's own label the same way dividends already do, and
    // only keep lots that actually belong to the selected label.
    if (bucket && label) {
      return lots.filter(lot => {
        const tx  = data.transactions.find(t => t.symbol === lot.symbol)
        const lbl = tx ? getLabel(tx, bucket) : resolveLabel('', bucket, quoteTypeBySymbol.get(lot.symbol))
        return lbl === label
      })
    }
    return lots
  }, [data, portfolio, segment, bucket, label, quoteTypeBySymbol])

  // Dividend lookup maps — only populated when toggle is ON
  const divBySymbol = useMemo(() => {
    if (!includeDivs || !divData) return new Map<string, number>()
    return new Map(divData.by_symbol.map(s => [s.symbol, s.total_dividends]))
  }, [includeDivs, divData])

  // Segment filter only — portfolio filtering is handled by the backend via the portfolio param
  const filteredDivSymbols = useMemo(() => {
    if (!bucket || !label) return undefined
    if (!divData || !data) return new Set<string>()
    const syms = new Set<string>()
    for (const s of divData.by_symbol) {
      const tx = data.transactions.find(t => t.symbol === s.symbol)
      const lbl = tx ? getLabel(tx, bucket) : resolveLabel('', bucket, quoteTypeBySymbol.get(s.symbol))
      if (lbl === label) syms.add(s.symbol)
    }
    return syms
  }, [bucket, label, divData, data, quoteTypeBySymbol])

  const totalDivForView = useMemo(() => {
    if (!includeDivs || !divData) return 0
    if (!filteredDivSymbols && !portfolio) return divData.by_symbol.reduce((sum, s) => sum + s.total_dividends, 0)
    const syms = filteredDivSymbols ?? new Set(filteredHoldings.map(h => h.symbol))
    return divData.by_symbol.filter(s => syms.has(s.symbol)).reduce((sum, s) => sum + s.total_dividends, 0)
  }, [includeDivs, divData, filteredDivSymbols, portfolio, filteredHoldings])

  // Allocation tab always uses one-per-symbol grouping regardless of viewMode
  const allocGroupedRows = useMemo(
    () => buildRows(filteredHoldings, realizedMap, 'cumulative'),
    [filteredHoldings, realizedMap],
  )

  const allocSectorXirrMap = useMemo(() => {
    if (!data) return new Map<SectorKey, number | null>()
    const symToYf = new Map(filteredHoldings.map(h => [h.symbol, h.yf_symbol]))
    const today = new Date()
    const sectorCfs = new Map<SectorKey, { date: Date; amount: number }[]>()
    const sectorTerminal = new Map<SectorKey, number>()
    for (const row of allocGroupedRows) {
      const sector = getSectorForHolding(symToYf.get(row.navSym) ?? row.navSym)
      const cfs = sectorCfs.get(sector) ?? []
      for (const tx of data.transactions.filter(t => t.symbol === row.navSym && row.portfolios.includes(t.portfolio))) {
        if (tx.type === 'DIVIDEND') continue
        const isUsd = USD_PORTS.has(tx.portfolio)
        const fx = isUsd ? data.usd_inr : 1
        const amt = tx.quantity * tx.price * fx
        const chg = (tx.charges ?? 0) * fx
        if (tx.type === 'BUY')  cfs.push({ date: new Date(tx.date), amount: -(amt + chg) })
        if (tx.type === 'SELL') cfs.push({ date: new Date(tx.date), amount:   amt - chg })
      }
      sectorCfs.set(sector, cfs)
      if (row.current > 0) sectorTerminal.set(sector, (sectorTerminal.get(sector) ?? 0) + row.current)
    }
    const map = new Map<SectorKey, number | null>()
    for (const [sector, cfs] of sectorCfs) {
      const terminal = sectorTerminal.get(sector) ?? 0
      if (terminal > 0) cfs.push({ date: today, amount: terminal })
      const r = computeXIRR(cfs)
      map.set(sector, r !== null ? r * 100 : null)
    }
    return map
  }, [allocGroupedRows, filteredHoldings, data, currency])

  const allocMktCapXirrMap = useMemo(() => {
    if (!data) return new Map<MarketCapKey, number | null>()
    const symToYf = new Map(filteredHoldings.map(h => [h.symbol, h.yf_symbol]))
    const today = new Date()
    const bucketCfs = new Map<MarketCapKey, { date: Date; amount: number }[]>()
    const bucketTerminal = new Map<MarketCapKey, number>()
    for (const row of allocGroupedRows) {
      const bucket = getMarketCapForHolding(symToYf.get(row.navSym) ?? row.navSym)
      const cfs = bucketCfs.get(bucket) ?? []
      for (const tx of data.transactions.filter(t => t.symbol === row.navSym && row.portfolios.includes(t.portfolio))) {
        if (tx.type === 'DIVIDEND') continue
        const isUsd = USD_PORTS.has(tx.portfolio)
        const fx = isUsd ? data.usd_inr : 1
        const amt = tx.quantity * tx.price * fx
        const chg = (tx.charges ?? 0) * fx
        if (tx.type === 'BUY')  cfs.push({ date: new Date(tx.date), amount: -(amt + chg) })
        if (tx.type === 'SELL') cfs.push({ date: new Date(tx.date), amount:   amt - chg })
      }
      bucketCfs.set(bucket, cfs)
      if (row.current > 0) bucketTerminal.set(bucket, (bucketTerminal.get(bucket) ?? 0) + row.current)
    }
    const map = new Map<MarketCapKey, number | null>()
    for (const [bucket, cfs] of bucketCfs) {
      const terminal = bucketTerminal.get(bucket) ?? 0
      if (terminal > 0) cfs.push({ date: today, amount: terminal })
      const r = computeXIRR(cfs)
      map.set(bucket, r !== null ? r * 100 : null)
    }
    return map
  }, [allocGroupedRows, filteredHoldings, data, currency])

  const concentrationData = useMemo(() => {
    if (!allocGroupedRows.length) return []
    const sorted = [...allocGroupedRows].sort((a, b) => b.current - a.current)
    const top = sorted.slice(0, concentrationTop)
    const other = sorted.slice(concentrationTop)
    const otherTotal = other.reduce((s, r) => s + r.current, 0)
    const result: { name: string; ticker: string; key: string; value: number; color: string }[] = top.map((r, i) => ({
      name: r.subLabel || r.ticker,
      ticker: r.ticker,
      key: r.key,
      value: r.current,
      color: PIE_COLORS[i % PIE_COLORS.length],
    }))
    if (otherTotal > 0) result.push({ name: 'Other', ticker: '', key: '', value: otherTotal, color: '#94a3b8' })
    return result
  }, [allocGroupedRows, concentrationTop])


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
        const fx = isUsd ? data.usd_inr : 1
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

    const symMap = new Map<string, { rg: number; rc: number; firstPort: string; ports: string[] }>()
    for (const r of data.realized) {
      if (SKIP_PORTS.has(r.portfolio)) continue
      if (portfolio && r.portfolio !== portfolio) continue
      if (bucket && label && resolveLabel(r.tags, bucket, quoteTypeBySymbol.get(r.symbol)) !== label) continue
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
  }, [data, portfolio, bucket, label, filteredHoldings, quoteTypeBySymbol])

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
  // Benchmarking needs transactions from fully-closed portfolios too (e.g. Upstox)
  // filtPorts only covers portfolios with open holdings; closedRows captures the rest.
  // Under a Bucket/Label filter, portfolio-level inclusion isn't enough: the same symbol can
  // carry a different label in a different portfolio (e.g. AMZN tagged "Stocks" in one
  // portfolio, something else in another) — including that portfolio wholesale would pull in
  // (or drop) that other portfolio's same-symbol transactions and skew the qty/unit tracking.
  // Resolve the label per-transaction instead, same as closedRows/filtRealized already do.
  const benchTxns = useMemo(() => {
    if (!data) return []
    if (portfolio) return data.transactions.filter(t => t.portfolio === portfolio)
    if (segment === 'total') return data.transactions.filter(t => !SKIP_PORTS.has(t.portfolio))
    if (!bucket || !label) {
      const ports = new Set(filtPorts)
      for (const r of closedRows) for (const p of r.portfolios) ports.add(p)
      return data.transactions.filter(t => ports.has(t.portfolio))
    }
    return data.transactions.filter(t =>
      !SKIP_PORTS.has(t.portfolio) && resolveLabel(t.tags, bucket, quoteTypeBySymbol.get(t.symbol)) === label,
    )
  }, [data, filtPorts, closedRows, portfolio, segment, bucket, label, quoteTypeBySymbol])
  const txnYears = useMemo(() => {
    if (!data) return [new Date().getFullYear()]
    const years = new Set(data.transactions.map(t => parseInt(t.date.slice(0, 4), 10)))
    const cur = new Date().getFullYear()
    const sorted = [...years].filter(y => y <= cur).sort()
    return sorted.length ? sorted : [cur]
  }, [data])
  const benchPeriodStart = useMemo((): string | null => {
    if (!benchDateEnabled) return null
    return `${benchStartYear}-${String(benchStartMonth).padStart(2, '0')}-01`
  }, [benchDateEnabled, benchStartYear, benchStartMonth])

  const benchPeriodEnd = useMemo((): string | null => {
    if (!benchDateEnabled) return null
    const now = new Date()
    if (benchEndMonth === now.getMonth() + 1 && benchEndYear === now.getFullYear()) return null
    const lastDay = new Date(benchEndYear, benchEndMonth, 0).getDate()
    return `${benchEndYear}-${String(benchEndMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  }, [benchDateEnabled, benchEndYear, benchEndMonth])
  const filtRealized = useMemo(() => {
    if (!data) return []
    if (portfolio) return data.realized.filter(r => r.portfolio === portfolio)
    if (segment === 'total') return data.realized.filter(r => !SKIP_PORTS.has(r.portfolio))
    if (!bucket || !label) return data.realized.filter(r => filtPorts.has(r.portfolio))
    return data.realized.filter(r =>
      !SKIP_PORTS.has(r.portfolio) && resolveLabel(r.tags, bucket, quoteTypeBySymbol.get(r.symbol)) === label,
    )
  }, [data, filtPorts, segment, bucket, label, portfolio, quoteTypeBySymbol])

  // Placed before useBenchmarkXirr so symbolPriceMap is available for period XIRR opening balance
  const { series: portSeries, isLoading: histLoading, isFetching: histIsFetching, loadedCount, totalCount, fetchingCount: histFetchingCount, symbolPriceMap, lastFetchedAt: histLastFetchedAt } = usePortfolioHistory(
    filteredHoldings,
    filtTxns,
    filtRealized,
    data?.usd_inr ?? 95.5,
    currency,
    !!data,
    closedYfSymbolsArr,
    closedYfSymbolsArr,
  )

  // Stop sync spinner once all history queries have finished refetching
  useEffect(() => {
    if (syncing && !histIsFetching) setSyncing(false)
  }, [syncing, histIsFetching])

  const {
    sectors:           benchSectors,
    overallActualXirr: benchActualXirr,
    overallBenchXirr:  benchBenchXirr,
    overallAlpha:      benchAlpha,
    holdingBenchXirr:  holdingBenchXirr,
    isLoading:         benchLoading,
    isFetching:        benchFetching,
    hasError:          benchHasError,
    loadedCount:       benchLoadedCount,
    totalCount:        benchTotalCount,
    fetchingCount:     benchFetchingCount,
    lastFetchedAt:     benchLastFetchedAt,
  } = useBenchmarkXirr(
    filteredHoldings,
    closedYfSymbolsArr,
    benchTxns,
    data?.usd_inr ?? 95.5,
    currency,
    !!data,
    benchPeriodStart,
    benchPeriodEnd,
    symbolPriceMap,
  )

  useEffect(() => {
    if (benchSyncing && !benchLoading && !benchFetching) setBenchSyncing(false)
  }, [benchSyncing, benchLoading, benchFetching])

  const fmtSyncTime = (d: Date) => {
    const hh  = String(d.getHours()).padStart(2, '0')
    const mm  = String(d.getMinutes()).padStart(2, '0')
    const dd  = String(d.getDate()).padStart(2, '0')
    const mon = d.toLocaleString('en-US', { month: 'short' })
    return `${hh}:${mm} ${dd} ${mon}`
  }

  // Set histLastSynced to the real cache timestamp (not "now") whenever it's available —
  // reopening the app with hours-old cached data should show its true age, not look freshly synced.
  useEffect(() => {
    if (!histLoading && histLastFetchedAt) setHistLastSynced(new Date(histLastFetchedAt))
  }, [histLoading, histLastFetchedAt])

  // Progress-bar "done" count must never visibly decrease — totalCount - histFetchingCount
  // (used once everything has loaded at least once) tracks *currently in-flight* requests,
  // which rises and falls non-monotonically as the backend's concurrency cap (4 at a time)
  // works through a burst of refetches (e.g. every symbol going stale at once after the app
  // was backgrounded a while). Clamp to the highest value seen this cycle; reset when a new
  // fetch cycle actually starts.
  const histMaxDoneRef = useRef(0)
  const histWasFetchingRef = useRef(false)
  if (histIsFetching && !histWasFetchingRef.current) histMaxDoneRef.current = 0
  histWasFetchingRef.current = histIsFetching

  // Set benchLastSynced to the real cache timestamp (not "now") whenever it's available —
  // reopening the app with hours-old cached benchmark data should show its true age.
  useEffect(() => {
    if (!benchLoading && benchLastFetchedAt) setBenchLastSynced(new Date(benchLastFetchedAt))
  }, [benchLoading, benchLastFetchedAt])

  // Set divLastSynced to the real cache timestamp (not "now") whenever dividend data is
  // available — reopening the app with hours/days-old cached data shows its true age.
  useEffect(() => {
    if (divLoading || divFetching || !divData) return
    const ts = getDividendsLastFetched(portfolio)
    if (ts) setDivLastSynced(new Date(ts))
  }, [divLoading, divFetching, divData, portfolio])
  const xirrMap = useMemo(() => {
    if (!data) return new Map<string, number | null>()
    const today = new Date()
    const map   = new Map<string, number | null>()
    const isCumulative = !!segment && viewMode === 'cumulative'
    const divEventsMap = (includeDivs && divData)
      ? new Map(divData.by_symbol.map(s => [s.symbol, s.events]))
      : new Map<string, never[]>()

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
          ? (includeFxGains && tx.type === 'BUY' && tx.buy_fx_rate && tx.buy_fx_rate > 10 ? tx.buy_fx_rate : data.usd_inr)
          : 1
        const amt = tx.quantity * tx.price * fx
        const chg = (tx.charges ?? 0) * fx
        if (tx.type === 'BUY')  cfs.push({ date: new Date(tx.date), amount: -(amt + chg) })
        if (tx.type === 'SELL') cfs.push({ date: new Date(tx.date), amount:   amt - chg })
      }
      for (const ev of divEventsMap.get(row.navSym) ?? []) {
        cfs.push({ date: new Date(ev.ex_date), amount: ev.amount })
      }
      if (row.current > 0) cfs.push({ date: today, amount: row.current })

      const r = computeXIRR(cfs)
      map.set(row.key, r !== null ? r * 100 : null)
    }
    return map
  }, [rows, closedRows, holdingFilter, data, currency, filtPorts, segment, viewMode, includeDivs, divData, includeFxGains])

  // Patch ltp on closed rows using latest price from symbolPriceMap (available after usePortfolioHistory)
  const closedRowsWithLtp = useMemo(() => {
    if (!symbolPriceMap.size || !data) return closedRows
    const symToYf = new Map<string, string>()
    for (const tx of data.transactions) symToYf.set(tx.symbol, tx.yf_symbol)
    return closedRows.map(r => {
      const yfSym  = symToYf.get(r.navSym)
      if (!yfSym) return r
      const dateMap = symbolPriceMap.get(yfSym)
      if (!dateMap?.size) return r
      const lastDate = [...dateMap.keys()].sort().at(-1)!
      const price    = dateMap.get(lastDate) ?? null
      return price !== null ? { ...r, ltp: price } : r
    })
  }, [closedRows, symbolPriceMap, data])

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
    const closed = [...closedRowsWithLtp].sort(sortFn)
    if (holdingFilter === 'closed') return closed
    if (holdingFilter === 'all')    return showClosed ? [...open, ...closed] : open
    return open
  }, [rows, closedRowsWithLtp, holdingFilter, showClosed, sortField, sortDir, xirrMap])

  useEffect(() => {
    if (sortedRows.length > 0 && pendingScrollY.current !== null && scrollRef.current) {
      const y = pendingScrollY.current
      pendingScrollY.current = null
      requestAnimationFrame(() => { if (scrollRef.current) scrollRef.current.scrollTop = y })
    }
  }, [sortedRows.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const symbolSectorMap = useMemo(() => {
    const map = new Map<string, SectorKey>()
    for (const h of filteredHoldings) map.set(h.symbol, getSectorForHolding(h.yf_symbol))
    if (data) {
      const symToYf = new Map<string, string>()
      for (const tx of data.transactions) symToYf.set(tx.symbol, tx.yf_symbol)
      for (const r of closedRows) {
        if (!map.has(r.navSym)) {
          const yf = symToYf.get(r.navSym) ?? r.navSym
          map.set(r.navSym, getSectorForHolding(yf))
        }
      }
    }
    return map
  }, [filteredHoldings, closedRows, data])

  const availableSectors = useMemo((): SectorKey[] => {
    const sectors = new Set<SectorKey>()
    for (const r of sortedRows) {
      const sec = symbolSectorMap.get(r.navSym)
      if (sec) sectors.add(sec)
    }
    return [...sectors].sort()
  }, [sortedRows, symbolSectorMap])

  const visibleRows = useMemo(() => {
    let result = sortedRows
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      result = result.filter(r =>
        r.ticker.toLowerCase().includes(q) ||
        r.subLabel.toLowerCase().includes(q)
      )
    }
    if (sectorFilter !== 'all') {
      result = result.filter(r => symbolSectorMap.get(r.navSym) === sectorFilter)
    }
    return result
  }, [sortedRows, searchQuery, sectorFilter, symbolSectorMap])

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
    const divEventsMap = (includeDivs && divData)
      ? new Map(divData.by_symbol.map(s => [s.symbol, s.events]))
      : new Map<string, never[]>()
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
          ? (includeFxGains && tx.type === 'BUY' && tx.buy_fx_rate ? tx.buy_fx_rate : data.usd_inr)
          : 1
        const amt = tx.quantity * tx.price * fx
        const chg = (tx.charges ?? 0) * fx
        if (tx.type === 'BUY')  cfs.push({ date: new Date(tx.date), amount: -(amt + chg) })
        if (tx.type === 'SELL') cfs.push({ date: new Date(tx.date), amount:   amt - chg })
      }
      for (const ev of divEventsMap.get(row.navSym) ?? []) {
        cfs.push({ date: new Date(ev.ex_date), amount: ev.amount })
      }
      if (row.current > 0) cfs.push({ date: today, amount: row.current })
    }
    const r = computeXIRR(cfs)
    return r !== null ? r * 100 : null
  }, [holdingFilter, data, closedRows, rows, filtPorts, segment, viewMode, currency, includeDivs, divData, includeFxGains])


  // ── Returns tab: per-sector daily value series ──────────────────────────────
  const sectorValueSeries = useMemo((): Map<SectorKey | 'all', Array<{ dateStr: string; value: number }>> => {
    if (!symbolPriceMap.size || !filteredHoldings.length || !data) return new Map()
    const usdInr  = data.usd_inr
    const dateSet = new Set<string>()
    for (const [, m] of symbolPriceMap) for (const dt of m.keys()) dateSet.add(dt)
    const allDates = [...dateSet].sort()
    if (!allDates.length) return new Map()
    const qtyDelta   = new Map<string, Map<string, number>>()
    const firstDateM = new Map<string, string>()
    for (const tx of filtTxns) {
      if (tx.type === 'DIVIDEND') continue
      const delta   = tx.type === 'BUY' ? tx.quantity : -tx.quantity
      const key     = `${tx.portfolio}:${tx.yf_symbol}`
      const dateStr = tx.date.slice(0, 10)
      if (!qtyDelta.has(key)) qtyDelta.set(key, new Map())
      qtyDelta.get(key)!.set(dateStr, (qtyDelta.get(key)!.get(dateStr) ?? 0) + delta)
      if (!firstDateM.has(key) || dateStr < firstDateM.get(key)!) firstDateM.set(key, dateStr)
    }
    const groups = new Map<SectorKey | 'all', Holding[]>()
    groups.set('all', filteredHoldings)
    for (const h of filteredHoldings) {
      const s = getSectorForHolding(h.yf_symbol)
      if (!groups.has(s)) groups.set(s, [])
      groups.get(s)!.push(h)
    }
    const result = new Map<SectorKey | 'all', Array<{ dateStr: string; value: number }>>()
    for (const [gk, gh] of groups) {
      const valArr = new Array<number>(allDates.length).fill(0)
      for (const h of gh) {
        const pm     = symbolPriceMap.get(h.yf_symbol)
        if (!pm?.size) continue
        const key    = `${h.portfolio}:${h.yf_symbol}`
        const deltas = qtyDelta.get(key) ?? new Map<string, number>()
        const first  = firstDateM.get(key) ?? allDates[0]
        const isUsd  = USD_PORTS.has(h.portfolio)
        const fx     = isUsd ? usdInr : 1
        let qty = 0, lastPx: number | null = null
        for (let i = 0; i < allDates.length; i++) {
          const d = allDates[i]
          if (d < first) continue
          const dlt = deltas.get(d)
          if (dlt !== undefined) qty = Math.max(0, qty + dlt)
          const px = pm.get(d)
          if (px !== undefined) lastPx = px
          if (lastPx === null || qty <= 0) continue
          valArr[i] += lastPx * qty * fx
        }
      }
      const si = valArr.findIndex(v => v > 0)
      if (si < 0) continue
      result.set(gk, allDates.slice(si).map((d, i) => ({ dateStr: d, value: valArr[si + i] })))
    }
    return result
  }, [symbolPriceMap, filteredHoldings, filtTxns, data, currency])

  const returnsSectors = useMemo((): SectorKey[] =>
    ([...new Set(filteredHoldings.map(h => getSectorForHolding(h.yf_symbol)))].sort() as SectorKey[]),
  [filteredHoldings])

  const returnsAvailableYears = useMemo((): number[] => {
    const s = sectorValueSeries.get(returnsSector) ?? []
    const yrs = [...new Set(s.map(pt => parseInt(pt.dateStr.slice(0, 4), 10)))].sort()
    return yrs.length ? yrs : [new Date().getFullYear()]
  }, [sectorValueSeries, returnsSector])

  const periodData = useMemo(() => {
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    const isAll = returnsSector === 'all'
    const ps    = portSeries

    // For "all sectors": use portSeries.total (unrealized + cumulative realized P&L).
    // This correctly includes closed positions. Period gains = total[end] - total[start]
    // — no netInvested subtraction needed because portSeries.total already excludes capital.
    // Sum of all period gains ≈ current total P&L (unrealized + all realized).
    const portPts = (isAll && ps)
      ? ps.total.dates.map((d, i) => ({
          dateStr:   d.toISOString().slice(0, 10),
          total:     ps.total.values[i],
          invested:  ps.invested.values[i],
          value:     ps.value.values[i],
          returnPct: ps.returnPct.values[i],
        }))
      : null

    const series = sectorValueSeries.get(returnsSector) ?? []
    if (!data) return []
    if (isAll ? !portPts?.length : !series.length) return []

    const now            = new Date()
    const currentYearStr = String(now.getFullYear())
    const currentMoStr   = String(now.getMonth() + 1).padStart(2, '0')
    const usdInrSnap     = data.usd_inr
    const sectorTxns     = isAll
      ? filtTxns
      : filtTxns.filter(tx => getSectorForHolding(tx.yf_symbol) === returnsSector)

    // Returns cumulative total-gains (isAll) or open-position value (sector) at or before cutoff
    function lastValueAtOrBefore(cutoff: string): number {
      if (portPts) { let v = 0; for (const pt of portPts) { if (pt.dateStr > cutoff) break; v = pt.total } return v }
      let v = 0; for (const pt of series) { if (pt.dateStr > cutoff) break; v = pt.value } return v
    }
    // Invested capital at or before cutoff — denominator for returnPct in 'all' mode
    function lastInvAtOrBefore(cutoff: string): number {
      let v = 0; if (portPts) for (const pt of portPts) { if (pt.dateStr > cutoff) break; v = pt.invested } return v
    }
    // Cumulative return % at or before cutoff — already uses (invested + realCost) denominator
    function lastReturnPctAtOrBefore(cutoff: string): number {
      let v = 0; if (portPts) for (const pt of portPts) { if (pt.dateStr > cutoff) break; v = pt.returnPct } return v
    }
    // Open-holdings market value at or before cutoff — terminal value for XIRR in 'all' mode
    function lastOpenValAtOrBefore(cutoff: string): number {
      let v = 0; if (portPts) for (const pt of portPts) { if (pt.dateStr > cutoff) break; v = pt.value } return v
    }
    function netInvested(afterDate: string, upToDate: string): number {
      let net = 0
      for (const tx of sectorTxns) {
        const d = tx.date.slice(0, 10)
        if (d <= afterDate || d > upToDate || tx.type === 'DIVIDEND') continue
        const isUsd = USD_PORTS.has(tx.portfolio)
        const fx = isUsd ? usdInrSnap : 1
        const amt = tx.quantity * tx.price * fx
        const chg = (tx.charges ?? 0) * fx
        if (tx.type === 'BUY')  net += amt + chg
        if (tx.type === 'SELL') net -= amt - chg
      }
      return net
    }
    function buildXirr(upTo: string, terminal: number): number | null {
      const cfs: { date: Date; amount: number }[] = []
      for (const tx of sectorTxns) {
        if (tx.date.slice(0, 10) > upTo || tx.type === 'DIVIDEND') continue
        const isUsd = USD_PORTS.has(tx.portfolio)
        const fx    = isUsd ? usdInrSnap : 1
        const amt   = tx.quantity * tx.price * fx
        const chg   = (tx.charges ?? 0) * fx
        if (tx.type === 'BUY')  cfs.push({ date: new Date(tx.date), amount: -(amt + chg) })
        if (tx.type === 'SELL') cfs.push({ date: new Date(tx.date), amount: amt - chg })
      }
      if (terminal > 0) cfs.push({ date: new Date(upTo), amount: terminal })
      const r = computeXIRR(cfs)
      return r !== null && isFinite(r) && r > -0.99 && r < 50 ? r * 100 : null
    }

    function computePeriod(endDate: string, prevEnd: string, label: string, isYtdMtd: boolean) {
      const endV   = lastValueAtOrBefore(endDate)
      const startV = lastValueAtOrBefore(prevEnd)
      if (portPts) {
        const gains      = endV - startV
        const startPortV = lastOpenValAtOrBefore(prevEnd) || lastInvAtOrBefore(prevEnd)
        return { label, returnPct: startPortV > 0 ? gains / startPortV * 100 : 0, gains, cumulGains: endV, cumulReturnPct: lastReturnPctAtOrBefore(endDate), xirr: buildXirr(endDate, lastOpenValAtOrBefore(endDate)), isYtd: isYtdMtd }
      }
      const gains = endV - startV - netInvested(prevEnd, endDate)
      return { label, returnPct: startV > 0 ? gains / startV * 100 : 0, gains, cumulGains: endV, cumulReturnPct: null, xirr: buildXirr(endDate, endV), isYtd: isYtdMtd }
    }

    const srcDates = portPts ? portPts.map(pt => pt.dateStr) : series.map(pt => pt.dateStr)

    if (returnsMode === 'year') {
      const yrMap = new Map<string, string[]>()
      for (const d of srcDates) { const yr = d.slice(0, 4); if (!yrMap.has(yr)) yrMap.set(yr, []); yrMap.get(yr)!.push(d) }
      return [...yrMap.keys()].sort().map(yr => {
        const dates = yrMap.get(yr)!
        return computePeriod(dates[dates.length - 1], `${parseInt(yr, 10) - 1}-12-31`, yr === currentYearStr ? `${yr} YTD` : yr, yr === currentYearStr)
      })
    } else {
      const effYears  = returnsYears.filter(y => returnsAvailableYears.includes(y))
      const activeYears = (effYears.length > 0 ? effYears : [returnsAvailableYears[returnsAvailableYears.length - 1] ?? new Date().getFullYear()]).slice().sort((a, b) => a - b)
      const isMultiYear = activeYears.length > 1
      const results: ReturnType<typeof computePeriod>[] = []
      for (const yr of activeYears) {
        const yearStr   = String(yr)
        const yearDates = srcDates.filter(d => d.startsWith(yearStr))
        if (!yearDates.length) continue
        const moMap = new Map<string, string[]>()
        for (const d of yearDates) { const mo = d.slice(5, 7); if (!moMap.has(mo)) moMap.set(mo, []); moMap.get(mo)!.push(d) }
        for (const mo of [...moMap.keys()].sort()) {
          const dates   = moMap.get(mo)!
          const moStart = new Date(`${yearStr}-${mo}-01`)
          moStart.setDate(moStart.getDate() - 1)
          const isMtd   = yearStr === currentYearStr && mo === currentMoStr
          const label   = isMultiYear
            ? `${MONTHS[parseInt(mo, 10) - 1]} '${yearStr.slice(2)}${isMtd ? ' MTD' : ''}`
            : `${MONTHS[parseInt(mo, 10) - 1]}${isMtd ? ' MTD' : ''}`
          results.push(computePeriod(dates[dates.length - 1], moStart.toISOString().slice(0, 10), label, isMtd))
        }
      }
      return results
    }
  }, [sectorValueSeries, returnsSector, returnsMode, returnsYears, returnsAvailableYears, filtTxns, data, currency, portSeries])

  useEffect(() => {
    if (!returnsAvailableYears.length) return
    setReturnsYears(prev => {
      const valid = prev.filter(y => returnsAvailableYears.includes(y))
      return valid.length > 0 ? valid : [returnsAvailableYears[returnsAvailableYears.length - 1]]
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [returnsAvailableYears])

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

  // Switch away from FX tab if toggle turned off
  useEffect(() => {
    if (!includeFxGains && activeTab === 'fx') setActiveTab('holdings')
  }, [includeFxGains]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-switch to "closed" filter when a page has no open holdings (e.g. fully-exited Upstox),
  // and switch back when navigating to a page that does have open holdings — otherwise a
  // "closed" filter forced on a fully-exited page would stick and hide real holdings on the
  // next bucket/portfolio page visited, since this component doesn't remount on route changes.
  useEffect(() => {
    if (!isLoading && data && filteredHoldings.length === 0 && closedRows.length > 0 && holdingFilter !== 'closed') {
      setHoldingFilter('closed')
    } else if (!isLoading && data && filteredHoldings.length > 0 && holdingFilter === 'closed') {
      setHoldingFilter('all')
    }
  }, [isLoading, data, filteredHoldings.length, closedRows.length]) // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) return <LoadingSkeleton />
  if (error || !data) return <ErrorState message={(error as Error)?.message ?? 'Unknown error'} />

  const pageTitle  = portfolio ?? label ?? (segment === 'total' ? 'All Holdings' : 'Holdings')
  const backLabel  = (segment || bucket) ? '← Overview' : '← All Portfolios'
  const isPct      = PCT_METRICS.has(chartMetric)
  const chartLast  = metricSeries?.values[metricSeries.values.length - 1] ?? null
  const chartFirst = metricSeries?.values[0] ?? null
  const chartChange = chartLast !== null && chartFirst !== null ? chartLast - chartFirst : null
  const lineColor  = METRIC_STYLE[chartMetric].line
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
    <div className="max-w-xl mx-auto flex flex-col h-[100dvh]">
      {chartsUpToDate && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[9999] bg-emerald-600 text-white font-bold text-[12px] px-4 py-2 rounded-full shadow-lg whitespace-nowrap">
          Charts already up to date
        </div>
      )}
      {divUpToDate && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[9999] bg-emerald-600 text-white font-bold text-[12px] px-4 py-2 rounded-full shadow-lg whitespace-nowrap">
          Dividends recently updated
        </div>
      )}
      {divSkipped.length > 0 && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[9999] bg-amber-600 text-white font-bold text-[12px] px-4 py-2 rounded-full shadow-lg max-w-[90vw] truncate">
          {divSkipped.length} symbol{divSkipped.length > 1 ? 's' : ''} didn't refresh: {divSkipped.join(', ')}
        </div>
      )}
      <div className="shrink-0 px-2 pt-4 bg-white relative z-20">
      {/* Nav bar */}
      <div className="flex items-center justify-between px-3 py-2 mb-3 bg-gradient-to-r from-emerald-600 to-teal-500 rounded-xl">
        <button onClick={() => navigate('/')} className="shrink-0 flex items-center gap-0.5 text-white active:text-white/80 min-h-[44px]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          <span className="text-[15px] font-bold whitespace-nowrap">{backLabel.replace('← ', '')}</span>
        </button>
        <div className="relative shrink-0">
          <button
            onClick={() => setSettingsOpen(o => !o)}
            className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${settingsOpen ? 'bg-white/20 text-white' : 'text-emerald-100 active:bg-white/20 active:text-white'}`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
          {settingsOpen && (
            <>
              <div className="fixed inset-0 z-[9]" onClick={() => setSettingsOpen(false)} />
              <div className="absolute right-0 top-full mt-1.5 rounded-2xl shadow-xl overflow-hidden border border-emerald-100 z-10 min-w-[270px]">
                <div className="bg-gradient-to-r from-emerald-600 to-teal-500 px-3 py-2 flex items-center justify-between">
                  <p className="text-[12px] font-semibold text-white tracking-tight">Settings</p>
                  <button onClick={() => setSettingsOpen(false)} className="text-emerald-200 active:text-white text-lg leading-none">×</button>
                </div>
                <div className="bg-white px-2 py-1.5 flex flex-col gap-1">
                  <p className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 uppercase tracking-widest px-1 pt-0.5"><svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><path d="M1.5 2h9L7 6.5V10l-2-1V6.5L1.5 2z"/></svg>Filters</p>
                  <div className="bg-emerald-50/60 border border-emerald-100 rounded-lg overflow-hidden">
                    <div className="px-2.5 py-1.5 flex items-center justify-between gap-2">
                      <p className="text-[10px] text-slate-400 uppercase tracking-widest shrink-0">Status</p>
                      <div className="relative flex w-[150px] bg-white rounded-full p-[2px] border border-emerald-100">
                        <div className="absolute top-[2px] bottom-[2px] w-1/3 rounded-full bg-emerald-500 shadow-sm transition-transform duration-150" style={{ transform: `translateX(${holdingFilter === 'open' ? '0%' : holdingFilter === 'closed' ? '100%' : '200%'})` }} />
                        {(['open', 'closed', 'all'] as const).map(v => (
                          <button key={v} onClick={() => setHoldingFilter(v)} className={`relative z-10 flex-1 text-[10px] py-[3px] px-2 text-center capitalize transition-colors ${holdingFilter === v ? 'text-white font-semibold' : 'text-slate-400'}`}>{v}</button>
                        ))}
                      </div>
                    </div>
                    {holdingFilter === 'all' && (
                      <div className="px-2.5 py-1.5 flex items-center justify-between gap-3 border-t border-emerald-100/70">
                        <p className="text-[10px] text-slate-400 uppercase tracking-widest">Show Closed</p>
                        <button onClick={() => setShowClosed(v => !v)} className={`relative shrink-0 w-9 h-5 rounded-full transition-colors duration-200 ${showClosed ? 'bg-teal-500' : 'bg-slate-200'}`}>
                          <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${showClosed ? 'translate-x-4' : 'translate-x-0'}`} />
                        </button>
                      </div>
                    )}
                  </div>
                  {segment && (
                    <div className="bg-emerald-50/60 border border-emerald-100 rounded-lg px-2.5 py-1.5 flex items-center justify-between gap-2">
                      <p className="text-[10px] text-slate-400 uppercase tracking-widest shrink-0">View</p>
                      <div className="relative flex w-[150px] bg-white rounded-full p-[2px] border border-emerald-100">
                        <div className="absolute top-[2px] bottom-[2px] w-1/2 rounded-full bg-emerald-500 shadow-sm transition-transform duration-150" style={{ transform: `translateX(${viewMode === 'standalone' ? '100%' : '0%'})` }} />
                        {(['cumulative', 'standalone'] as const).map(m => (
                          <button key={m} onClick={() => setViewMode(m)} className={`relative z-10 flex-1 text-[10px] py-[3px] px-2 text-center whitespace-nowrap transition-colors ${viewMode === m ? 'text-white font-semibold' : 'text-slate-400'}`}>{m === 'cumulative' ? 'Grouped' : 'Standalone'}</button>
                        ))}
                      </div>
                    </div>
                  )}
                  <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-widest px-1 pt-0.5">Actions</p>
                  <div className="bg-emerald-50/60 border border-emerald-100 rounded-lg px-2.5 py-1.5 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-medium text-emerald-700">Manage Portfolio</span>
                    <div className="flex flex-col items-center gap-0.5 shrink-0">
                      <button onClick={() => { setSettingsOpen(false); setManageMenuOpen(true) }} className="w-[70px] text-center bg-emerald-700 text-white text-[10px] font-semibold rounded-full px-3 py-1 active:bg-emerald-800">
                        Manage
                      </button>
                    </div>
                  </div>
                  <div className="bg-emerald-50/60 border border-emerald-100 rounded-lg px-2.5 py-1.5 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-medium text-emerald-700">Charts</span>
                    <div className="flex flex-col items-center gap-0.5 shrink-0">
                      <button
                        onClick={() => {
                          if (syncing) return
                          if (histLastSynced && Date.now() - histLastSynced.getTime() < REFRESH_MS) {
                            setChartsUpToDate(true)
                            setTimeout(() => setChartsUpToDate(false), 3000)
                            return
                          }
                          setSyncing(true)
                          // Priority: the symbols of the view you clicked Refresh from finish first;
                          // everything else (other portfolios already prefetched in the background) follows.
                          const activeSymbols = new Set(filteredHoldings.map(h => h.yf_symbol))
                          qc.refetchQueries({
                            predicate: q => q.queryKey[0] === 'history' && activeSymbols.has(q.queryKey[1] as string),
                            type: 'active',
                          }).then(() => qc.refetchQueries({
                            predicate: q => q.queryKey[0] === 'history' && !activeSymbols.has(q.queryKey[1] as string),
                            type: 'active',
                          }))
                        }}
                        className="w-[70px] text-center bg-emerald-700 text-white text-[10px] font-semibold rounded-full px-3 py-1 active:bg-emerald-800"
                      >
                        {syncing ? 'Syncing…' : 'Refresh'}
                      </button>
                      {histLastSynced && (
                        <span className="text-[9px] text-slate-400 whitespace-nowrap leading-none">{fmtSyncTime(histLastSynced)}</span>
                      )}
                    </div>
                  </div>
                  <div className="bg-emerald-50/60 border border-emerald-100 rounded-lg px-2.5 py-1.5 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-medium text-emerald-700">Dividends</span>
                    <div className="flex flex-col items-center gap-0.5 shrink-0">
                      <button
                        onClick={() => {
                          if (divSyncing) return
                          if (divLastSynced && Date.now() - divLastSynced.getTime() < REFRESH_MS) {
                            setDivUpToDate(true)
                            setTimeout(() => setDivUpToDate(false), 3000)
                            return
                          }
                          setDivSyncing(true)
                          refreshAllDividends(data?.all_portfolios ?? [], portfolio)
                            .then(skipped => {
                              if (skipped.length === 0) return
                              logDebug(`Dividends refresh: skipped ${skipped.length} symbol(s) — ${skipped.join(', ')}`)
                              setDivSkipped(skipped)
                              setTimeout(() => setDivSkipped([]), 6000)
                            })
                            .finally(() => setDivSyncing(false))
                        }}
                        className="w-[70px] text-center bg-emerald-700 text-white text-[10px] font-semibold rounded-full px-3 py-1 active:bg-emerald-800"
                      >
                        {divSyncing ? 'Syncing…' : 'Update'}
                      </button>
                      {divLastSynced && (
                        <span className="text-[9px] text-slate-400 whitespace-nowrap leading-none">{fmtSyncTime(divLastSynced)}</span>
                      )}
                    </div>
                  </div>
                  <div className="bg-emerald-50/60 border border-emerald-100 rounded-lg px-2.5 py-1.5 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-medium text-emerald-700">Benchmarking analysis</span>
                    <div className="flex flex-col items-center gap-0.5 shrink-0">
                      <button
                        onClick={() => {
                          if (benchSyncing) return
                          setBenchSyncing(true)
                          refreshAllBenchmarks().finally(() => setBenchSyncing(false))
                        }}
                        className="w-[70px] text-center bg-emerald-700 text-white text-[10px] font-semibold rounded-full px-3 py-1 active:bg-emerald-800"
                      >
                        {benchSyncing ? 'Syncing…' : 'Refresh'}
                      </button>
                      {benchLastSynced && (
                        <span className="text-[9px] text-slate-400 whitespace-nowrap leading-none">{fmtSyncTime(benchLastSynced)}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Summary card — USD portfolio-specific views convert to USD; aggregates stay INR */}
      {(() => {
        const isUsdPortView = portfolio ? USD_PORTS.has(portfolio) : false
        const summCur: Currency = isUsdPortView && currency === 'USD' ? 'USD' : 'INR'
        const summFx = summCur === 'USD' ? 1 / (data?.usd_inr ?? 95.5) : 1
        const totalFxForView = includeFxGains
          ? filteredHoldings.filter(h => h.currency === 'USD').reduce((s, h) => s + (h.disp_fx_gain ?? 0), 0)
          : 0
        return (
      <SummaryCard
        label={pageTitle}
        current={displayStats.cur * summFx}
        invested={displayStats.inv * summFx}
        realGain={displayStats.realGain * summFx}
        realCost={displayStats.realCost * summFx}
        todayGain={(displayStats.tg || null) !== null ? (displayStats.tg || 0) * summFx : null}
        todayPct={displayStats.todayPct}
        xirr={filteredSummaryXirr}
        dividends={totalDivForView > 0 ? totalDivForView * summFx : undefined}
        fxGain={totalFxForView > 0 ? totalFxForView * summFx : undefined}
        currency={summCur}
        highlight={
          segment === 'total'
            ? { bg: 'linear-gradient(to right, #f0fdfa, #d1fae5 45%, #ecfdf5)', accent: '#0d9488' }
            : { bg: 'linear-gradient(to right, #d1fae5, #ecfdf5 40%, #f0fdf4)', accent: '#34d399' }
        }
      />
        )
      })()}

      {/* Tabs */}
      <div className="flex bg-slate-100 rounded-full p-0.5 gap-0.5 mb-2">
        {([...(['holdings', 'charts', 'analysis', 'dividends'] as const), ...(includeFxGains && filteredFxLots.length > 0 ? ['fx' as const] : [])]).map(tab => {
          const activeClass: Record<string, string> = {
            holdings:  'bg-teal-200 text-teal-800',
            charts:    'bg-sky-200 text-sky-800',
            analysis:  'bg-violet-200 text-violet-800',
            dividends: 'bg-teal-200 text-teal-800',
            fx:        'bg-teal-200 text-teal-800',
          }
          const tabLabel: Record<string, string> = { fx: 'FX' }
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 text-[11px] py-1.5 rounded-full capitalize font-medium transition-all ${
                activeTab === tab ? `${activeClass[tab]} shadow-sm` : 'text-slate-500'
              }`}
            >
              {tabLabel[tab] ?? tab}
            </button>
          )
        })}
      </div>
      {/* Charts strip — metric pills + sync */}
      {activeTab === 'charts' && (
        <div className="bg-sky-50 border border-sky-200 rounded-xl px-2.5 py-1.5 mt-2">
          <div
            className="flex gap-0.5 overflow-x-auto rounded-lg p-0.5"
            style={{ backgroundColor: '#bae6fd44', scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
          >
            {METRICS.map(m => (
              <button
                key={m}
                onClick={() => setChartMetric(m)}
                className={`text-[10px] whitespace-nowrap px-2.5 py-1 rounded-md font-medium transition-all ${
                  chartMetric === m ? METRIC_STYLE[m].active : METRIC_STYLE[m].inactive
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      )}
      {/* Holdings strip — search + sector + sort (single row) */}
      {activeTab === 'holdings' && (
        <div className="bg-teal-50 border border-teal-100 rounded-xl px-2.5 py-1.5 mt-2">
          <div className="flex items-center gap-1.5">
            <div className="flex-1 relative">
              <svg className="absolute left-2 top-1/2 -translate-y-1/2 text-teal-600 pointer-events-none" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={`Search name or symbol (${
                  holdingFilter === 'open'   ? `${rows.length} open` :
                  holdingFilter === 'closed' ? `${closedRows.length} closed` :
                  (rows.length && closedRows.length)
                    ? `${rows.length} open · ${closedRows.length} closed`
                    : rows.length ? `${rows.length} open` : `${closedRows.length} closed`
                } holdings)`}
                className="w-full pl-6 pr-6 py-[3px] text-[10px] bg-white border border-slate-200 rounded-full outline-none focus:border-teal-400 text-slate-700 placeholder-slate-300"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 active:text-slate-500">
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
              )}
            </div>
            {/* Sector filter */}
            <div className="relative shrink-0">
              <button
                onClick={() => setSectorOpen(o => !o)}
                className={`flex items-center gap-0.5 text-[10px] px-2 py-[3px] rounded-full border transition-colors whitespace-nowrap ${sectorFilter !== 'all' ? 'bg-teal-500 text-white border-teal-600' : 'bg-white text-teal-600 font-medium border-slate-200'}`}
              >
                <span>{sectorFilter === 'all' ? 'Sector' : sectorFilter}</span>
                <span className="text-[10px] leading-none">▾</span>
              </button>
              {sectorOpen && (
                <>
                  <div className="fixed inset-0 z-[9]" onClick={() => setSectorOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-10 py-1 min-w-[120px] max-h-[220px] overflow-y-auto">
                    <button
                      onClick={() => { setSectorFilter('all'); setSectorOpen(false) }}
                      className={`w-full text-left px-3 py-1.5 text-[10px] ${sectorFilter === 'all' ? 'text-teal-600 font-semibold' : 'text-slate-600'}`}
                    >
                      All Sectors
                    </button>
                    {availableSectors.map(s => (
                      <button
                        key={s}
                        onClick={() => { setSectorFilter(s); setSectorOpen(false) }}
                        className={`w-full text-left px-3 py-1.5 text-[10px] ${sectorFilter === s ? 'text-teal-600 font-semibold' : 'text-slate-600'}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            {/* Sort */}
            <div className="relative shrink-0">
              <button onClick={() => setSortOpen(o => !o)} className="flex items-center gap-1 text-[10px] text-teal-600 font-medium">
                <svg width="11" height="10" viewBox="0 0 11 10" fill="currentColor">
                  <rect x="0" y="0" width="11" height="1.5" rx="0.75"/>
                  <rect x="1.5" y="3.5" width="8" height="1.5" rx="0.75"/>
                  <rect x="3" y="7" width="5" height="1.5" rx="0.75"/>
                </svg>
                <span>{SORT_OPTIONS.find(o => o.field === sortField)?.label}</span>
                <span className="text-[10px]">{sortDir === 'desc' ? '↓' : '↑'}</span>
              </button>
              {sortOpen && (
                <>
                  <div className="fixed inset-0 z-[9]" onClick={() => setSortOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-10 py-1 min-w-[140px]">
                    {SORT_OPTIONS.map(opt => (
                      <button key={opt.field}
                        onClick={() => { if (sortField === opt.field) setSortDir(d => d === 'desc' ? 'asc' : 'desc'); else { setSortField(opt.field); setSortDir('desc') } setSortOpen(false) }}
                        className={`w-full text-left px-3 py-1.5 text-[10px] flex items-center justify-between ${sortField === opt.field ? 'text-teal-600 font-semibold' : 'text-slate-600'}`}
                      >
                        <span>{opt.label}</span>
                        {sortField === opt.field && <span>{sortDir === 'desc' ? '↓' : '↑'}</span>}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Analysis strip — segmented control */}
      {activeTab === 'analysis' && (
        <div className="bg-violet-50 border border-violet-100 rounded-xl px-2.5 py-1.5 mt-2">
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5 flex-1 bg-violet-100 rounded-lg p-0.5">
              {(['allocation', 'benchmarking', 'returns'] as const).map(st => (
                <button
                  key={st}
                  onClick={() => setAnalysisSubTab(st)}
                  className={`text-[10px] whitespace-nowrap px-2.5 py-1 rounded-md font-medium transition-all ${
                    analysisSubTab === st
                      ? st === 'allocation'   ? 'bg-orange-500 text-white shadow-sm border border-orange-600'
                      : st === 'benchmarking' ? 'bg-sky-500 text-white shadow-sm border border-sky-600'
                      :                         'bg-emerald-500 text-white shadow-sm border border-emerald-600'
                      : st === 'allocation'   ? 'bg-orange-100 text-orange-600 border border-orange-200'
                      : st === 'benchmarking' ? 'bg-sky-100 text-sky-600 border border-sky-200'
                      :                         'bg-emerald-100 text-emerald-600 border border-emerald-200'
                  }`}
                >
                  {st === 'allocation' ? 'Allocation' : st === 'benchmarking' ? 'Benchmarking' : 'Returns'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-2 pt-2 pb-4">

      {/* ── Holdings tab ── */}
      {activeTab === 'holdings' && (
        <div>
          {visibleRows.length === 0 && (
            <p className="text-slate-400 text-sm text-center py-6">No holdings</p>
          )}
          <div className="space-y-2">
            {visibleRows.map(r => {
              const usdInr   = data?.usd_inr ?? 95.5
              const isUsdRow = r.portfolios.some(p => USD_PORTS.has(p))
              const cardCur: Currency = isUsdRow && currency === 'USD' ? 'USD' : 'INR'
              const cardFx   = cardCur === 'USD' ? 1 / usdInr : 1
              const rawDiv   = divBySymbol.get(r.ticker) ?? 0
              const rawFx    = fxGainBySymbol.get(r.ticker) ?? 0
              return (
              <HoldingCard
                key={r.key}
                ticker={r.ticker}
                subLabel={r.subLabel}
                current={r.current * cardFx}
                invested={r.invested * cardFx}
                realGain={r.realGain * cardFx}
                realCost={r.realCost * cardFx}
                todayGain={r.todayGain !== null ? r.todayGain * cardFx : null}
                todayPct={r.todayPct}
                ltp={r.ltp}
                xirr={xirrMap.get(r.key) ?? null}
                dividends={rawDiv > 0 ? rawDiv * cardFx : undefined}
                fxGain={rawFx > 0 ? rawFx * cardFx : undefined}
                currency={cardCur}
                onClick={() => {
                  sessionStorage.setItem(`holdingsScroll:${location.pathname}`, String(scrollRef.current?.scrollTop ?? 0))
                  navigate(`/transactions/${encodeURIComponent(r.navPort)}/${encodeURIComponent(r.navSym)}`, { state: { from: label, portfolios: r.portfolios } })
                }}
              />
              )
            })}
          </div>
        </div>
      )}

      {/* ── Charts tab ── */}
      {activeTab === 'charts' && (
        <div className="pt-1 pb-3">
          {/* Progress bar — true cold load, a manual sync in flight, or (for the heavier
              aggregate "Total" view) any background refresh including 30-min auto-ticks */}
          {(histLoading || (syncing && histIsFetching) || (segment === 'total' && histIsFetching)) && (() => {
            const isFirst = loadedCount < totalCount
            const rawDone = isFirst ? loadedCount : totalCount - histFetchingCount
            histMaxDoneRef.current = Math.max(histMaxDoneRef.current, rawDone)
            const done    = histMaxDoneRef.current
            const pct     = totalCount > 0 ? done / totalCount * 100 : 0
            const color   = METRIC_STYLE[chartMetric].line
            return (
              <div className="mb-3">
                <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                  <span className="flex items-center gap-1">
                    <span className="inline-block animate-spin leading-none text-[10px]">↻</span>
                    {isFirst ? 'Loading' : 'Syncing'} price history… {done} / {totalCount}
                  </span>
                  <span>{Math.round(pct)}%</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden relative">
                  {/* Ghost pulse on full bar — visible when count is stuck between batches */}
                  <div className="absolute inset-0 rounded-full animate-pulse opacity-20" style={{ backgroundColor: color }} />
                  {/* Actual fill — long transition smooths out batch jumps */}
                  <div className="h-full rounded-full transition-all duration-700 relative z-10" style={{ width: `${pct}%`, backgroundColor: color }} />
                </div>
              </div>
            )
          })()}

          {/* Charts already rendered from cache — silent background revalidation, no blocking bar.
              Aggregate "Total" view uses the fuller progress bar above instead (heavier, many symbols). */}
          {!histLoading && !syncing && histIsFetching && segment !== 'total' && (
            <div className="flex justify-end text-[9px] text-slate-400 mb-2">
              <span className="flex items-center gap-1">
                <span className="inline-block animate-spin leading-none text-[9px]">↻</span>
                Refreshing…
              </span>
            </div>
          )}

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
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-3 mt-1">
              {/* Stat line + zoom */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-baseline gap-2 min-w-0">
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
                <button onClick={() => setChartZoomed(true)} className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-slate-100 text-slate-400 active:opacity-70">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                </button>
              </div>

              {/* Line chart */}
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={rechartsData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="t"
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
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
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
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
                    labelStyle={{ fontSize: 10, color: '#94a3b8' }}
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
            </div>
          )}
        </div>
      )}

      {/* ── Analysis tab ── */}
      {activeTab === 'analysis' && (
        <div className="pt-2">
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
                    <button className="flex items-center gap-1 w-full text-left text-[10px] font-semibold text-slate-500 uppercase tracking-widest px-3 py-2.5" onClick={() => { if (!sectorSectionOpen) { setMktCapSectionOpen(false); setConcentrationSectionOpen(false) } setSectorSectionOpen(o => !o) }}>
                      <span className="text-blue-600">By Sector</span> <span className="text-[10px] text-slate-300 ml-0.5">{sectorSectionOpen ? '▲' : '▼'}</span>
                    </button>
                    {sectorSectionOpen && <div className="flex items-center gap-1.5 px-2 py-1.5 mx-1 mb-2 bg-violet-100 rounded-lg">
                      <span className="text-[10px] font-semibold text-violet-700 flex-1">Sector</span>
                      <span className="text-[10px] font-semibold text-violet-700 w-[52px] text-center">Alloc</span>
                      <span className="text-[10px] font-semibold text-violet-700 w-[90px] text-right">Value (XIRR)</span>
                      <span className="text-[10px] font-semibold text-violet-700 w-[80px] text-right">Today</span>
                      <span className="w-[8px]" />
                    </div>}
                    {sectorSectionOpen && sectorData.map(s => {
                      const isOpen = expandedAllocSectors.has(s.name)
                      const sectorAllocRows = allocGroupedRows
                        .filter(r => getSectorForHolding(symToYf.get(r.navSym) ?? r.navSym) === s.name)
                        .sort((a, b) => b.current - a.current)

                      const sXirr = allocSectorXirrMap.get(s.name) ?? null

                      const hasTodayData = sectorAllocRows.some(r => r.todayGain !== null)
                      const sTodayGain = hasTodayData
                        ? sectorAllocRows.reduce((sum, r) => sum + (r.todayGain ?? 0), 0)
                        : null
                      const sPriorValue = sTodayGain !== null ? s.value - sTodayGain : null
                      const sTodayPct = sTodayGain !== null && sPriorValue ? sTodayGain / sPriorValue * 100 : null

                      const sXirrColor = sXirr !== null ? (sXirr >= 0 ? 'text-green-600' : 'text-red-400') : 'text-slate-400'
                      const sTodayColor = sTodayPct !== null ? (sTodayPct >= 0 ? 'text-green-600' : 'text-red-400') : 'text-slate-400'

                      return (
                        <div key={s.name} className="border border-slate-200 rounded-lg mb-2">
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
                                <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0">(#{sectorAllocRows.length})</span>
                              </span>
                              <span className="text-[10px] text-slate-500 whitespace-nowrap w-[52px] text-center">{s.pct.toFixed(1)}%</span>
                              <span className="text-[10px] font-medium text-slate-700 whitespace-nowrap w-[90px] text-right">
                                {fmtCompact(s.value, currency)}{sXirr !== null && <span className={sXirrColor}> ({sXirr >= 0 ? '+' : ''}{sXirr.toFixed(1)}%)</span>}
                              </span>
                              <span className={`text-[10px] font-medium whitespace-nowrap w-[80px] text-right ${sTodayColor}`}>
                                {sTodayGain !== null ? `${fmtTodayGain(sTodayGain)}${sTodayPct !== null ? ` (${sTodayPct >= 0 ? '+' : ''}${sTodayPct.toFixed(1)}%)` : ''}` : '—'}
                              </span>
                              <span className="text-[10px] text-slate-300 w-[8px]">{isOpen ? '▲' : '▼'}</span>
                            </div>
                            <div className="h-1.5 rounded-full overflow-hidden bg-slate-100">
                              <div className="h-full rounded-full" style={{ width: `${s.pct}%`, backgroundColor: SECTOR_COLOR[s.name] }} />
                            </div>
                          </button>
                          {isOpen && sectorAllocRows.length > 0 && (
                            <div className="border-t border-slate-200 bg-slate-50 rounded-b-lg">
                              <div className="py-2 px-1 space-y-1.5">
                                {sectorAllocRows.map(r => {
                                  const hPct = totalValue > 0 ? r.current / totalValue * 100 : 0
                                  const hXirr = allocXirrMap.get(r.key) ?? null
                                  const xirrColor = hXirr !== null ? (hXirr >= 0 ? 'text-green-600' : 'text-red-400') : 'text-slate-400'
                                  const todayColor = r.todayPct !== null ? (r.todayPct >= 0 ? 'text-green-600' : 'text-red-400') : 'text-slate-400'
                                  return (
                                    <button key={r.key} className="flex items-center gap-1.5 bg-white border border-slate-100 rounded-lg px-2 py-1.5 w-full text-left active:opacity-60" onClick={() => { sessionStorage.setItem(`holdingsScroll:${location.pathname}`, String(scrollRef.current?.scrollTop ?? 0)); navigate(`/transactions/${encodeURIComponent(r.navPort)}/${encodeURIComponent(r.navSym)}`, { state: { from: label, portfolios: r.portfolios } }) }}>
                                      <div className="flex-1 min-w-0">
                                        <span className="text-[10px] text-slate-600 truncate block">{r.subLabel || r.ticker}</span>
                                      </div>
                                      <span className="text-[10px] text-slate-500 w-[52px] whitespace-nowrap text-center">{hPct.toFixed(1)}%</span>
                                      <span className="text-[10px] font-medium text-slate-700 w-[90px] whitespace-nowrap text-right">
                                        {fmtCompact(r.current, currency)}{hXirr !== null && <span className={xirrColor}> ({hXirr >= 0 ? '+' : ''}{hXirr.toFixed(1)}%)</span>}
                                      </span>
                                      <span className={`text-[10px] font-medium whitespace-nowrap w-[80px] text-right ${todayColor}`}>
                                        {r.todayGain !== null ? `${fmtTodayGain(r.todayGain)}${r.todayPct !== null ? ` (${r.todayPct >= 0 ? '+' : ''}${r.todayPct.toFixed(1)}%)` : ''}` : '—'}
                                      </span>
                                      <span className="w-[8px]" />
                                    </button>
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
                    <button className="flex items-center gap-1 w-full text-left text-[10px] font-semibold text-slate-500 uppercase tracking-widest px-3 py-2.5" onClick={() => { if (!mktCapSectionOpen) { setSectorSectionOpen(false); setConcentrationSectionOpen(false) } setMktCapSectionOpen(o => !o) }}>
                      <span className="text-orange-600">By Market Cap</span> <span className="text-[10px] text-slate-300 ml-0.5">{mktCapSectionOpen ? '▲' : '▼'}</span>
                    </button>
                    {mktCapSectionOpen && <div className="flex items-center gap-1.5 px-2 py-1.5 mx-1 mb-2 bg-violet-100 rounded-lg">
                      <span className="text-[10px] font-semibold text-violet-700 flex-1">Bucket</span>
                      <span className="text-[10px] font-semibold text-violet-700 w-[52px] text-center">Alloc</span>
                      <span className="text-[10px] font-semibold text-violet-700 w-[90px] text-right">Value (XIRR)</span>
                      <span className="text-[10px] font-semibold text-violet-700 w-[80px] text-right">Today</span>
                      <span className="w-[8px]" />
                    </div>}
                    {mktCapSectionOpen && mktCapData.map(b => {
                      const isOpen = expandedMktCapBuckets.has(b.name)
                      const bucketAllocRows = allocGroupedRows
                        .filter(r => getMarketCapForHolding(symToYf.get(r.navSym) ?? r.navSym) === b.name)
                        .sort((x, y) => y.current - x.current)

                      const sXirr = allocMktCapXirrMap.get(b.name) ?? null

                      const hasTodayData = bucketAllocRows.some(r => r.todayGain !== null)
                      const sTodayGain = hasTodayData
                        ? bucketAllocRows.reduce((sum, r) => sum + (r.todayGain ?? 0), 0)
                        : null
                      const sPriorValue = sTodayGain !== null ? b.value - sTodayGain : null
                      const sTodayPct = sTodayGain !== null && sPriorValue ? sTodayGain / sPriorValue * 100 : null

                      const sXirrColor = sXirr !== null ? (sXirr >= 0 ? 'text-green-600' : 'text-red-400') : 'text-slate-400'
                      const sTodayColor = sTodayPct !== null ? (sTodayPct >= 0 ? 'text-green-600' : 'text-red-400') : 'text-slate-400'

                      return (
                        <div key={b.name} className="border border-slate-200 rounded-lg mb-2">
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
                                <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0">(#{bucketAllocRows.length})</span>
                              </span>
                              <span className="text-[10px] text-slate-500 whitespace-nowrap w-[52px] text-center">{b.pct.toFixed(1)}%</span>
                              <span className="text-[10px] font-medium text-slate-700 whitespace-nowrap w-[90px] text-right">
                                {fmtCompact(b.value, currency)}{sXirr !== null && <span className={sXirrColor}> ({sXirr >= 0 ? '+' : ''}{sXirr.toFixed(1)}%)</span>}
                              </span>
                              <span className={`text-[10px] font-medium whitespace-nowrap w-[80px] text-right ${sTodayColor}`}>
                                {sTodayGain !== null ? `${fmtTodayGain(sTodayGain)}${sTodayPct !== null ? ` (${sTodayPct >= 0 ? '+' : ''}${sTodayPct.toFixed(1)}%)` : ''}` : '—'}
                              </span>
                              <span className="text-[10px] text-slate-300 w-[8px]">{isOpen ? '▲' : '▼'}</span>
                            </div>
                            <div className="h-1.5 rounded-full overflow-hidden bg-slate-100">
                              <div className="h-full rounded-full" style={{ width: `${b.pct}%`, backgroundColor: MARKET_CAP_COLOR[b.name] }} />
                            </div>
                          </button>
                          {isOpen && bucketAllocRows.length > 0 && (
                            <div className="border-t border-slate-200 bg-slate-50 rounded-b-lg">
                              <div className="py-2 px-1 space-y-1.5">
                                {bucketAllocRows.map(r => {
                                  const hPct = totalValue > 0 ? r.current / totalValue * 100 : 0
                                  const hXirr = allocXirrMap.get(r.key) ?? null
                                  const xirrColor = hXirr !== null ? (hXirr >= 0 ? 'text-green-600' : 'text-red-400') : 'text-slate-400'
                                  const todayColor = r.todayPct !== null ? (r.todayPct >= 0 ? 'text-green-600' : 'text-red-400') : 'text-slate-400'
                                  return (
                                    <button key={r.key} className="flex items-center gap-1.5 bg-white border border-slate-100 rounded-lg px-2 py-1.5 w-full text-left active:opacity-60" onClick={() => { sessionStorage.setItem(`holdingsScroll:${location.pathname}`, String(scrollRef.current?.scrollTop ?? 0)); navigate(`/transactions/${encodeURIComponent(r.navPort)}/${encodeURIComponent(r.navSym)}`, { state: { from: label, portfolios: r.portfolios } }) }}>
                                      <div className="flex-1 min-w-0">
                                        <span className="text-[10px] text-slate-600 truncate block">{r.subLabel || r.ticker}</span>
                                      </div>
                                      <span className="text-[10px] text-slate-500 w-[52px] whitespace-nowrap text-center">{hPct.toFixed(1)}%</span>
                                      <span className="text-[10px] font-medium text-slate-700 w-[90px] whitespace-nowrap text-right">
                                        {fmtCompact(r.current, currency)}{hXirr !== null && <span className={xirrColor}> ({hXirr >= 0 ? '+' : ''}{hXirr.toFixed(1)}%)</span>}
                                      </span>
                                      <span className={`text-[10px] font-medium whitespace-nowrap w-[80px] text-right ${todayColor}`}>
                                        {r.todayGain !== null ? `${fmtTodayGain(r.todayGain)}${r.todayPct !== null ? ` (${r.todayPct >= 0 ? '+' : ''}${r.todayPct.toFixed(1)}%)` : ''}` : '—'}
                                      </span>
                                      <span className="w-[8px]" />
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                    </div>
                    {/* Concentration section */}
                    <div className="border border-slate-200 rounded-xl mt-3">
                      <button className="flex items-center gap-1 w-full text-left text-[10px] font-semibold text-slate-500 uppercase tracking-widest px-3 py-2.5" onClick={() => { if (!concentrationSectionOpen) { setSectorSectionOpen(false); setMktCapSectionOpen(false) } setConcentrationSectionOpen(o => !o) }}>
                        <span className="text-emerald-600">By Holdings Concentration</span> <span className="text-[10px] text-slate-300 ml-0.5">{concentrationSectionOpen ? '▲' : '▼'}</span>
                      </button>
                      {concentrationSectionOpen && (
                        <div className="px-3 pb-3">
                          <div className="flex bg-slate-100 rounded-full p-[2px] mb-3">
                            {([5, 10, 20] as const).map(n => (
                              <button
                                key={n}
                                onClick={() => setConcentrationTop(n)}
                                className={`flex-1 text-[10px] py-[4px] rounded-full transition-colors ${concentrationTop === n ? 'bg-white shadow-sm text-slate-700 font-semibold' : 'text-slate-400'}`}
                              >
                                Top {n}
                              </button>
                            ))}
                          </div>
                          {(() => {
                            const topValue = concentrationData.filter(e => e.name !== 'Other').reduce((s, e) => s + e.value, 0)
                            const topPct = totalValue > 0 ? topValue / totalValue * 100 : 0
                            return (
                              <div className="flex items-center gap-2">
                                <div className="flex-1 min-w-0">
                                  <ResponsiveContainer width="100%" height={180}>
                                    <PieChart>
                                      <Pie data={concentrationData} cx="50%" cy="50%" outerRadius={80} dataKey="value" strokeWidth={0}>
                                        {concentrationData.map((_, i) => (
                                          <Cell key={i} fill={concentrationData[i].color} />
                                        ))}
                                      </Pie>
                                      <Tooltip
                                        formatter={(v: number, name: string) => [fmtCompact(v, currency), name]}
                                        contentStyle={{ fontSize: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}
                                      />
                                    </PieChart>
                                  </ResponsiveContainer>
                                </div>
                                <div className="shrink-0 text-right">
                                  <p className="text-[10px] text-slate-400 whitespace-nowrap">Top {concentrationTop} stocks</p>
                                  <p className="text-[22px] font-bold text-slate-700">{topPct.toFixed(1)}%</p>
                                  <p className="text-[10px] text-slate-400">of portfolio</p>
                                </div>
                              </div>
                            )
                          })()}
                          <div className="space-y-1.5 mt-1">
                            {concentrationData.map((entry, i) => {
                              const entryXirr = entry.key ? allocXirrMap.get(entry.key) ?? null : null
                              const xirrColor = entryXirr !== null ? (entryXirr >= 0 ? 'text-green-600' : 'text-red-400') : 'text-slate-400'
                              return (
                                <button
                                  key={i}
                                  className={`flex items-center gap-2 w-full text-left ${entry.key ? 'active:opacity-60' : ''}`}
                                  onClick={() => {
                                    if (!entry.key) return
                                    const row = allocGroupedRows.find(r => r.key === entry.key)
                                    if (!row) return
                                    sessionStorage.setItem(`holdingsScroll:${location.pathname}`, String(scrollRef.current?.scrollTop ?? 0))
                                    navigate(`/transactions/${encodeURIComponent(row.navPort)}/${encodeURIComponent(row.navSym)}`, { state: { from: label, portfolios: row.portfolios } })
                                  }}
                                >
                                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                                  <span className="text-[10px] text-slate-600 flex-1 truncate">{entry.name}{entry.ticker ? ` · ${entry.ticker}` : ''}</span>
                                  <span className="text-[10px] font-medium text-slate-700 whitespace-nowrap">
                                    {fmtCompact(entry.value, currency)}
                                    {entryXirr !== null && <span className={`ml-1 ${xirrColor}`}>({entryXirr >= 0 ? '+' : ''}{entryXirr.toFixed(1)}%)</span>}
                                  </span>
                                  <span className="text-[10px] text-slate-400 whitespace-nowrap w-[36px] text-right">{totalValue > 0 ? `${(entry.value / totalValue * 100).toFixed(1)}%` : '—'}</span>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })()}
            </div>
          )}

          {analysisSubTab === 'returns' && (
            <div>
              {!portSeries && histLoading ? (
                <p className="text-center text-[11px] text-slate-400 py-6">Loading price history…</p>
              ) : periodData.length === 0 ? (
                <p className="text-center text-[11px] text-slate-400 py-6">No data for this selection.</p>
              ) : (() => {
                const liveReturnPct = (displayStats.inv + displayStats.realCost) > 0
                  ? (displayStats.cur - displayStats.inv + displayStats.realGain) / (displayStats.inv + displayStats.realCost) * 100
                  : null
                const histData = periodData.map(row => {
                  const raw   = row.gains
                  const cumul = row.isYtd && liveReturnPct !== null ? liveReturnPct : row.cumulReturnPct
                  return { label: row.label, value: raw ?? 0, cumul: cumul ?? null, isYtd: row.isYtd, raw }
                })
                const symToYfLocal = new Map(filteredHoldings.map(h => [h.symbol, h.yf_symbol]))
                const summaryGains = periodData.reduce((s, r) => s + r.gains, 0)
                const summaryLabel = returnsMode === 'year'
                  ? 'by year'
                  : returnsYears.length === 1
                    ? String(returnsYears[0])
                    : `${Math.min(...returnsYears)}–${Math.max(...returnsYears)}`
                const fmtV = (v: number) => `${v >= 0 ? '+' : '−'}${fmtCompact(Math.abs(v), currency)}`
                const metricLabel = 'Gains'
                const yTickFmtR = (v: number) =>
                  Math.abs(v) >= 1e7 ? `${(v/1e7).toFixed(1)}Cr` : Math.abs(v) >= 1e5 ? `${(v/1e5).toFixed(1)}L` : Math.abs(v) >= 1e3 ? `${(v/1e3).toFixed(0)}K` : String(v)
                return (
                  <>
                    {/* Summary line */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-[13px] font-bold whitespace-nowrap ${summaryGains >= 0 ? 'text-green-600' : 'text-red-400'}`}>
                        {`${summaryGains >= 0 ? '+' : '−'}${fmtCompact(Math.abs(summaryGains), currency)}`}
                      </span>
                      <span className="text-[10px] text-slate-400 flex-1 min-w-0 truncate">
                        {`${returnsSector === 'all' ? 'all sectors' : returnsSector} · ${summaryLabel}`}
                      </span>
                      <div className="relative shrink-0">
                        <button
                          onClick={() => setReturnsConfigOpen(o => !o)}
                          className={`w-6 h-6 flex items-center justify-center rounded-full transition-colors ${returnsConfigOpen ? 'bg-slate-100 text-slate-700' : 'text-slate-400 active:bg-slate-100'}`}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="3"/>
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                          </svg>
                        </button>
                        {returnsConfigOpen && (
                          <>
                            <div className="fixed inset-0 z-[9]" onClick={() => setReturnsConfigOpen(false)} />
                            <div className="absolute right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg z-10 p-3 min-w-[160px]">
                              <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">Sector</p>
                              <div className="flex flex-col gap-0.5 mb-3">
                                {(['all', ...returnsSectors] as Array<SectorKey | 'all'>).map(s => (
                                  <button
                                    key={s}
                                    onClick={() => setReturnsSector(s)}
                                    className={`flex items-center gap-1.5 text-left px-2 py-1 rounded-lg text-[10px] ${returnsSector === s ? 'bg-slate-100 text-slate-700 font-semibold' : 'text-slate-500'}`}
                                  >
                                    {s !== 'all' && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: SECTOR_COLOR[s] }} />}
                                    {s === 'all' ? 'All Sectors' : s}
                                  </button>
                                ))}
                              </div>
                              <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">Period</p>
                              <div className="relative flex bg-slate-100 rounded-full p-[2px] mb-3">
                                <div
                                  className="absolute top-[2px] bottom-[2px] w-1/2 rounded-full bg-white shadow-sm transition-transform duration-150"
                                  style={{ transform: `translateX(${returnsMode === 'month' ? '100%' : '0%'})` }}
                                />
                                {(['year', 'month'] as const).map(m => (
                                  <button key={m} onClick={() => setReturnsMode(m)}
                                    className={`relative z-10 flex-1 text-[10px] py-[4px] capitalize transition-colors ${returnsMode === m ? 'text-slate-700 font-semibold' : 'text-slate-400'}`}
                                  >{m}</button>
                                ))}
                              </div>
                              {returnsMode === 'month' && (
                                <>
                                  <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">Year</p>
                                  <div className="flex flex-wrap gap-1 mb-3">
                                    {returnsAvailableYears.map(yr => (
                                      <button
                                        key={yr}
                                        onClick={() => setReturnsYears(prev => {
                                          if (prev.includes(yr)) return prev.length > 1 ? prev.filter(y => y !== yr) : prev
                                          return [...prev, yr]
                                        })}
                                        className={`text-[10px] px-2 py-0.5 rounded-full border ${returnsYears.includes(yr) ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-500 border-slate-200'}`}
                                      >{yr}</button>
                                    ))}
                                  </div>
                                </>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Histogram + cumulative return % line */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-3 mt-1">
                    <ResponsiveContainer width="100%" height={220}>
                      <ComposedChart data={histData} margin={{ top: 16, right: 4, left: 0, bottom: 0 }} barCategoryGap="20%">
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 10, fill: '#94a3b8' }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          yAxisId="left"
                          tick={{ fontSize: 10, fill: '#94a3b8' }}
                          tickFormatter={yTickFmtR}
                          width={40}
                          tickLine={false}
                          axisLine={false}
                          domain={['auto', 'auto']}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          width={0}
                          tick={false}
                          tickLine={false}
                          axisLine={false}
                          domain={['auto', 'auto']}
                        />
                        <Tooltip
                          formatter={(v: number, name: string) => [
                            name === 'cumul' ? `${v >= 0 ? '+' : ''}${v.toFixed(2)}%` : fmtV(v),
                            name === 'cumul' ? 'Cumul Return' : metricLabel,
                          ]}
                          contentStyle={{ fontSize: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}
                          labelStyle={{ fontSize: 10, color: '#94a3b8' }}
                          cursor={{ fill: '#f1f5f9' }}
                        />
                        <ReferenceLine yAxisId="left" y={0} stroke="#cbd5e1" strokeWidth={1} />
                        <Bar yAxisId="left" dataKey="value" radius={[3, 3, 0, 0]}>
                          {histData.map((entry, i) => (
                            <Cell key={i} fill={entry.value >= 0 ? '#4ade80' : '#f87171'} fillOpacity={entry.isYtd ? 0.5 : 1} />
                          ))}
                          {returnsMode === 'year' && histData.length <= 8 && (
                            <LabelList dataKey="value" position="top" content={(props: any) => {
                              const { x, y, width, value } = props
                              if (value == null) return null
                              const v = value as number
                              return (
                                <text x={Number(x) + Number(width) / 2} y={Number(y) - 4} textAnchor="middle" fontSize={7} fill={v >= 0 ? '#16a34a' : '#ef4444'}>
                                  {fmtV(v)}
                                </text>
                              )
                            }} />
                          )}
                        </Bar>
                        <Line
                          yAxisId="right"
                          dataKey="cumul"
                          stroke="#6366f1"
                          strokeWidth={1.5}
                          dot={{ r: 2.5, fill: '#6366f1', strokeWidth: 0 }}
                          activeDot={{ r: 4, strokeWidth: 0 }}
                          connectNulls
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                    </div>
                  </>
                )
              })()}
            </div>
          )}

          {analysisSubTab === 'benchmarking' && (
            <div>

              {benchLoading && (() => {
                const hasProgress = benchLoadedCount > 0 && benchTotalCount > 0
                const pct = hasProgress ? Math.round(benchLoadedCount / benchTotalCount * 100) : 0
                return (
                  <div className="py-6">
                    <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                      <span>Loading benchmark data…{hasProgress ? ` ${benchLoadedCount} / ${benchTotalCount}` : ''}</span>
                      {hasProgress && <span>{pct}%</span>}
                    </div>
                    <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                      {hasProgress
                        ? <div className="h-full bg-sky-400 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
                        : <div className="h-full bg-sky-400 rounded-full animate-pulse" style={{ width: '100%' }} />
                      }
                    </div>
                  </div>
                )
              })()}
              {benchSyncing && benchFetching && benchTotalCount > 0 && (() => {
                const done = benchTotalCount - benchFetchingCount
                const pct  = Math.round(done / benchTotalCount * 100)
                return (
                  <div className="mb-3">
                    <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                      <span>Syncing benchmarks… {done} / {benchTotalCount}</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-sky-400 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })()}

              {!benchLoading && benchHasError && (
                <div className="py-6 text-center text-[11px] text-red-400">
                  Could not load one or more benchmarks.
                </div>
              )}

              {!benchLoading && !benchHasError && benchSectors.length > 0 && (() => {
                const symToYf = new Map(filteredHoldings.map(h => [h.symbol, h.yf_symbol]))
                const fmtX = (v: number | null) => v !== null ? `${v >= 0 ? '+' : ''}${v.toFixed(1)}%` : '—'
                const maxAlpha = Math.max(...benchSectors.map(s => Math.abs(s.alpha ?? 0)), 1)
                const overallAlphaPos = (benchAlpha ?? 0) >= 0
                return (
                  <div>
                    {/* Overall card */}
                    <div
                      className="rounded-xl px-3 py-2.5 mb-3 border"
                      style={{
                        background:      overallAlphaPos ? '#f0fdf8' : '#fff5f5',
                        borderColor:     '#e2e8f0',
                        borderLeftWidth: 4,
                        borderLeftColor: overallAlphaPos ? '#10b981' : '#f43f5e',
                      }}
                    >
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Overall</p>
                      <div className="flex items-center gap-1">
                        <div className="flex items-center gap-1.5 flex-1">
                          <span className="text-[10px] text-slate-400 whitespace-nowrap">Your XIRR</span>
                          <span className={`text-[13px] font-bold whitespace-nowrap ${benchActualXirr !== null ? benchActualXirr >= 0 ? 'text-green-600' : 'text-red-400' : 'text-slate-400'}`}>
                            {benchActualXirr !== null ? `${benchActualXirr >= 0 ? '+' : ''}${benchActualXirr.toFixed(1)}%` : '—'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-1">
                          <span className="text-[10px] text-slate-400 whitespace-nowrap">Benchmark</span>
                          <span className="text-[13px] font-bold text-slate-500 whitespace-nowrap">
                            {benchBenchXirr !== null ? `${benchBenchXirr >= 0 ? '+' : ''}${benchBenchXirr.toFixed(1)}%` : '—'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-1 justify-end">
                          <span className="text-[10px] text-slate-400 whitespace-nowrap">Alpha</span>
                          <span className={`text-[13px] font-bold whitespace-nowrap ${benchAlpha !== null ? benchAlpha >= 0 ? 'text-green-500' : 'text-red-400' : 'text-slate-400'}`}>
                            {benchAlpha !== null ? `${benchAlpha >= 0 ? '+' : ''}${benchAlpha.toFixed(1)}%` : '—'}
                          </span>
                        </div>
                        <span className="w-[8px]" />
                      </div>
                      <div className="relative h-1.5 bg-slate-100 rounded-full overflow-hidden mt-2.5">
                        {benchAlpha !== null && benchAlpha > 0 && (
                          <div className="absolute top-0 bottom-0 bg-green-400 rounded-r-sm" style={{ left: '50%', width: `${Math.min(Math.abs(benchAlpha) / maxAlpha * 50, 50)}%` }} />
                        )}
                        {benchAlpha !== null && benchAlpha < 0 && (
                          <div className="absolute top-0 bottom-0 bg-red-400 rounded-l-sm" style={{ right: '50%', width: `${Math.min(Math.abs(benchAlpha) / maxAlpha * 50, 50)}%` }} />
                        )}
                        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-slate-300" />
                      </div>
                    </div>

                    {/* By Sector — bordered collapsible section */}
                    <div className="border border-slate-200 rounded-xl">
                      {/* Header row: By Sector toggle + date filter on right */}
                      <div className="flex items-center px-3 py-2.5">
                        <button
                          className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 uppercase tracking-widest"
                          onClick={() => setBenchSectorSectionOpen(o => !o)}
                        >
                          <span className="text-sky-600">By Sector</span>
                          <span className="text-[10px] text-slate-300 ml-0.5">{benchSectorSectionOpen ? '▲' : '▼'}</span>
                        </button>
                        <div className="flex-1" />
                        <div className="relative shrink-0">
                          <button
                            className="flex items-center gap-1 bg-sky-50 border border-sky-100 rounded-lg px-2 py-1"
                            onClick={() => setBenchConfigOpen(o => !o)}
                          >
                            <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-sky-500" style={{flexShrink:0}}><path d="M1.5 2h9L7 6.5V10l-2-1V6.5L1.5 2z"/></svg>
                            <span className="text-[10px] text-sky-700 whitespace-nowrap">
                              {benchDateEnabled
                                ? `${MONTHS[benchStartMonth - 1]} ${benchStartYear} → ${benchPeriodEnd === null ? 'today' : `${MONTHS[benchEndMonth - 1]} ${benchEndYear}`}`
                                : 'All dates'}
                            </span>
                            {benchDateEnabled && <span className="text-[10px] bg-sky-100 text-sky-600 rounded px-1 font-medium ml-0.5">Active</span>}
                          </button>

                          {/* Date config panel — overlay popover, does not push page content */}
                          {benchConfigOpen && (
                            <>
                              <div className="fixed inset-0 z-[9]" onClick={() => setBenchConfigOpen(false)} />
                              <div className="absolute right-0 top-full mt-1.5 bg-white border border-sky-100 rounded-xl shadow-lg z-10 p-3 w-[190px] space-y-2.5">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-slate-400 w-[28px] shrink-0">From</span>
                                  <select value={benchStartMonth} onChange={e => setBenchStartMonth(+e.target.value)} className="text-[10px] bg-white border border-slate-200 rounded-lg px-1.5 py-1 text-slate-700 flex-1">
                                    {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                                  </select>
                                  <select value={benchStartYear} onChange={e => setBenchStartYear(+e.target.value)} className="text-[10px] bg-white border border-slate-200 rounded-lg px-1.5 py-1 text-slate-700 flex-1">
                                    {txnYears.map(y => <option key={y} value={y}>{y}</option>)}
                                  </select>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-slate-400 w-[28px] shrink-0">To</span>
                                  <select value={benchEndMonth} onChange={e => setBenchEndMonth(+e.target.value)} className="text-[10px] bg-white border border-slate-200 rounded-lg px-1.5 py-1 text-slate-700 flex-1">
                                    {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                                  </select>
                                  <select value={benchEndYear} onChange={e => setBenchEndYear(+e.target.value)} className="text-[10px] bg-white border border-slate-200 rounded-lg px-1.5 py-1 text-slate-700 flex-1">
                                    {txnYears.map(y => <option key={y} value={y}>{y}</option>)}
                                  </select>
                                </div>
                                <div className="flex gap-2 pt-0.5">
                                  <button onClick={() => { setBenchDateEnabled(true); setBenchConfigOpen(false) }} className="flex-1 text-[11px] bg-sky-500 text-white rounded-full py-3 font-medium">Apply</button>
                                  {benchDateEnabled && (
                                    <button onClick={() => { setBenchDateEnabled(false); setBenchConfigOpen(false) }} className="flex-1 text-[11px] bg-slate-200 text-slate-600 rounded-full py-3 font-medium">Clear</button>
                                  )}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {benchSectorSectionOpen && (
                        <div className="flex items-center gap-1 px-2 py-1.5 mx-1 mb-2 bg-green-100 rounded-lg">
                          <span className="text-[10px] font-semibold text-green-700 flex-[2]">Sector (XIRR)</span>
                          <span className="text-[10px] font-semibold text-green-700 flex-1">Benchmark (XIRR)</span>
                          <span className="text-[10px] font-semibold text-green-700 flex-1 text-right">Alpha</span>
                          <span className="w-[8px]" />
                        </div>
                      )}

                      {benchSectorSectionOpen && [...benchSectors.filter(s => s.holdingCount > 0 && s.sector !== 'Other')].sort((a, b) => b.currentValue - a.currentValue).map(s => {
                        const isOpen = expandedSectors.has(s.sector)
                        const sectorRows = rows.filter(r =>
                          getSectorForHolding(symToYf.get(r.navSym) ?? r.navSym) === s.sector
                        ).sort((a, b) => b.current - a.current)
                        const xirrColor  = s.actualXirr !== null ? s.actualXirr >= 0 ? 'text-green-600' : 'text-red-400' : 'text-slate-400'
                        const alphaColor = s.alpha !== null ? s.alpha >= 0 ? 'text-green-600' : 'text-red-400' : 'text-slate-400'
                        return (
                          <div key={s.sector} className="border border-slate-200 rounded-lg mb-2">
                            <button
                              className="w-full px-2 py-1.5 text-left active:opacity-60"
                              onClick={() => setExpandedSectors(prev => {
                                const next = new Set(prev)
                                next.has(s.sector) ? next.delete(s.sector) : next.add(s.sector)
                                return next
                              })}
                            >
                              <div className="flex items-center gap-1">
                                <span className={`text-[10px] font-medium flex-[2] overflow-hidden text-ellipsis whitespace-nowrap`}><span className="text-slate-700">{s.sector}</span> <span className={xirrColor}>({fmtX(s.actualXirr)})</span></span>
                                <span className="text-[10px] text-slate-400 flex-1 min-w-0 flex items-center gap-0.5">
                                  <span className="truncate">{BENCHMARK_LABEL[s.benchSymbol] ?? s.benchSymbol}</span>
                                  <span className="shrink-0 whitespace-nowrap">({fmtX(s.benchXirr)})</span>
                                </span>
                                <span className={`text-[10px] font-semibold flex-1 whitespace-nowrap text-right ${alphaColor}`}>{fmtX(s.alpha)}</span>
                                <span className="text-[10px] text-slate-300 w-[8px] text-right">{isOpen ? '▲' : '▼'}</span>
                              </div>
                              <div className="relative h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1.5">
                                {s.alpha !== null && s.alpha > 0 && (
                                  <div className="absolute top-0 bottom-0 bg-green-400 rounded-r-sm" style={{ left: '50%', width: `${Math.min(Math.abs(s.alpha) / maxAlpha * 50, 50)}%` }} />
                                )}
                                {s.alpha !== null && s.alpha < 0 && (
                                  <div className="absolute top-0 bottom-0 bg-red-400 rounded-l-sm" style={{ right: '50%', width: `${Math.min(Math.abs(s.alpha) / maxAlpha * 50, 50)}%` }} />
                                )}
                                <div className="absolute top-0 bottom-0 left-1/2 w-px bg-slate-300" />
                              </div>
                            </button>
                            {isOpen && sectorRows.length > 0 && (
                              <div className="px-2 pb-1.5 space-y-1 border-t border-slate-100">
                                {sectorRows.map(r => {
                                  const hXirr   = xirrMap.get(r.key) ?? null
                                  const yfSym   = symToYf.get(r.navSym) ?? r.navSym
                                  const hBenchX = holdingBenchXirr.get(yfSym) ?? null
                                  const hAlpha  = hXirr !== null && hBenchX !== null ? hXirr - hBenchX : null
                                  const hColor  = hXirr !== null ? hXirr >= 0 ? 'text-green-600' : 'text-red-400' : 'text-slate-400'
                                  const hAlphaColor = hAlpha !== null ? hAlpha >= 0 ? 'text-green-600' : 'text-red-400' : 'text-slate-400'
                                  return (
                                    <button key={r.key} className="bg-slate-50 rounded-lg px-2 py-1.5 w-full text-left active:opacity-60" onClick={() => { sessionStorage.setItem(`holdingsScroll:${location.pathname}`, String(scrollRef.current?.scrollTop ?? 0)); navigate(`/transactions/${encodeURIComponent(r.navPort)}/${encodeURIComponent(r.navSym)}`, { state: { from: label, portfolios: r.portfolios } }) }}>
                                      <div className="flex items-center gap-1">
                                        <span className="flex items-center gap-1 flex-[2] min-w-0">
                                          <span className="text-[10px] font-medium text-slate-600 truncate min-w-0">{r.subLabel || r.ticker}</span>
                                          <span className={`text-[10px] font-medium shrink-0 ${hColor}`}>{fmtX(hXirr)}</span>
                                        </span>
                                        <span className="text-[10px] text-slate-400 flex-1 min-w-0 flex items-center gap-0.5">
                                          <span className="truncate">{BENCHMARK_LABEL[s.benchSymbol] ?? s.benchSymbol}</span>
                                          <span className="shrink-0 whitespace-nowrap">({fmtX(hBenchX)})</span>
                                        </span>
                                        <span className={`text-[10px] font-semibold flex-1 whitespace-nowrap text-right ${hAlphaColor}`}>{fmtX(hAlpha)}</span>
                                        <span className="w-[8px]" />
                                      </div>
                                      <div className="relative h-1 bg-slate-100 rounded-full overflow-hidden mt-1">
                                        {hAlpha !== null && hAlpha > 0 && (
                                          <div className="absolute top-0 bottom-0 bg-green-400 rounded-r-sm" style={{ left: '50%', width: `${Math.min(Math.abs(hAlpha) / maxAlpha * 50, 50)}%` }} />
                                        )}
                                        {hAlpha !== null && hAlpha < 0 && (
                                          <div className="absolute top-0 bottom-0 bg-red-400 rounded-l-sm" style={{ right: '50%', width: `${Math.min(Math.abs(hAlpha) / maxAlpha * 50, 50)}%` }} />
                                        )}
                                        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-slate-300" />
                                      </div>
                                    </button>
                                  )
                                })}
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
        </div>
      )}

      {/* ── Dividends tab ── */}
      {activeTab === 'dividends' && (
        <DividendsTab key={`${portfolio ?? ''}:${segment ?? ''}`} currency={currency} portfolio={portfolio} filterSymbols={filteredDivSymbols} usdInr={data?.usd_inr ?? 95.5} />
      )}
      {activeTab === 'fx' && (
        <FxGainsTab fxLots={filteredFxLots} usdInr={data.usd_inr} currency={currency} asOf={data.as_of} />
      )}
      </div>

      {/* Landscape zoom overlay */}
      {chartZoomed && (
        <div className="fixed inset-0 z-[200] bg-black flex items-center justify-center" onClick={() => setChartZoomed(false)}>
          <div
            style={{ transform: 'rotate(90deg)', width: '100dvh', height: '100dvw', transformOrigin: 'center center', background: '#0f172a', display: 'flex', flexDirection: 'column', padding: '14px 16px', boxSizing: 'border-box' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{chartMetric}</span>
              <button onClick={() => setChartZoomed(false)} style={{ color: '#94a3b8', fontSize: 22, lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
            </div>
            {metricSeries && rechartsData.length > 0 ? (
              <>
                <div style={{ flex: 1, minHeight: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={rechartsData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="t" tick={{ fontSize: 10, fill: '#94a3b8' }} interval={Math.max(0, Math.floor(rechartsData.length / 8) - 1)} tickFormatter={(d: string) => { const ms = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; const [yr, mo] = d.split('-'); return `${ms[parseInt(mo,10)-1]}'${yr.slice(2)}` }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={yTickFmt} width={52} tickLine={false} axisLine={false} domain={['auto','auto']} />
                      <Tooltip formatter={(v: number) => [isPct ? `${v >= 0 ? '+' : ''}${v.toFixed(2)}%` : fmt(v, currency), chartMetric]} contentStyle={{ fontSize: 10, borderRadius: 6, border: '1px solid #334155', background: '#1e293b', color: '#e2e8f0' }} labelStyle={{ fontSize: 10, color: '#94a3b8' }} />
                      {ZERO_LINE_METRICS.has(chartMetric) && <ReferenceLine y={0} stroke="#475569" strokeDasharray="3 3" strokeWidth={1} />}
                      <Line type="monotone" dataKey="v" stroke={lineColor} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ display: 'flex', background: '#1e293b', borderRadius: 8, padding: 2, marginTop: 10, flexShrink: 0 }}>
                  {RANGES.map(r => (
                    <button key={r} onClick={() => setChartRange(r)} style={{ flex: 1, fontSize: 10, padding: '5px 0', borderRadius: 6, fontWeight: 500, background: chartRange === r ? '#fff' : 'transparent', color: chartRange === r ? '#2563eb' : '#94a3b8', border: 'none', cursor: 'pointer' }}>{r}</button>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 13 }}>No data available</div>
            )}
          </div>
        </div>
      )}

      {data && (
        <AddTransactionModal
          open={addHoldingOpen}
          onClose={() => setAddHoldingOpen(false)}
          data={data}
          preFilledPortfolio={portfolio ?? undefined}
        />
      )}

      {data && (
        <PullHoldingsModal
          open={manageOpen}
          onClose={() => setManageOpen(false)}
          data={data}
          preFilledPortfolio={portfolio ?? undefined}
          preFilledBucket={bucket}
          preFilledLabel={label}
        />
      )}

      {data && (
        <DeleteHoldingModal
          open={deleteHoldingOpen}
          onClose={() => setDeleteHoldingOpen(false)}
          data={data}
          preFilledPortfolio={portfolio ?? undefined}
          preFilledBucket={bucket}
          preFilledLabel={label}
        />
      )}

      <ManagePortfolioModal
        open={manageMenuOpen}
        onClose={() => setManageMenuOpen(false)}
        disableAdd={!portfolio}
        disableCopy={!!portfolio}
        onSelect={action => {
          setManageMenuOpen(false)
          if (action === 'add') setAddHoldingOpen(true)
          if (action === 'delete') setDeleteHoldingOpen(true)
          if (action === 'copy') setManageOpen(true)
        }}
      />
    </div>
  )
}
