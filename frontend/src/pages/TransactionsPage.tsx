import React, { useMemo, useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { usePortfolio } from '../hooks/usePortfolio'
import { useDividendForSymbol } from '../hooks/useDividends'
import { usePortfolioHistory, sliceSeries } from '../hooks/usePortfolioHistory'
import type { DatedSeries, PortfolioSeries } from '../hooks/usePortfolioHistory'
import type { Holding } from '../api/types'
import { TxRow } from '../components/TxRow'
import { PriceChart } from '../components/PriceChart'
import { LoadingSkeleton, ErrorState } from '../components/LoadingSkeleton'
import { AnalysisTab } from '../components/AnalysisTab'
import { ReportTab } from '../components/ReportTab'
import { useQuickStats } from '../hooks/useQuickStats'
import { aggRealized } from '../utils/realized'
import { SKIP_PORTS, USD_PORTS } from '../utils/segments'
import { computeXIRR } from '../utils/xirr'
import { fmt, fmtCompactGainLine, fmtGainLine, fmtPct } from '../utils/fmt'
import type { Currency } from '../App'

const METRICS = [
  'Price',
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

const METRIC_SERIES_KEY: Record<Exclude<ChartMetric, 'Price'>, keyof PortfolioSeries> = {
  'Portfolio Value':  'value',
  'Invested':         'invested',
  'Unrealized Gains': 'unrealized',
  'Realized Gains':   'realized',
  'Total Gains':      'total',
  'Return %':         'returnPct',
  'XIRR Trend':       'xirrTrend',
}

const PCT_METRICS     = new Set<ChartMetric>(['Return %', 'XIRR Trend'])
const ZERO_LINE_METRICS = new Set<ChartMetric>([
  'Unrealized Gains', 'Realized Gains', 'Total Gains', 'Return %', 'XIRR Trend',
])

const METRIC_STYLE: Record<ChartMetric, { active: string; inactive: string; line: string; strip: string; sync: string }> = {
  'Price':            { active: 'bg-gradient-to-r from-slate-600 to-slate-700 text-white border-slate-700 shadow-sm',      inactive: 'bg-slate-50 text-slate-600 border-slate-200',      line: '#64748b', strip: 'bg-slate-50 border-slate-200',    sync: 'bg-gradient-to-br from-slate-600 to-slate-800 border-slate-700' },
  'Portfolio Value':  { active: 'bg-gradient-to-r from-blue-500 to-blue-600 text-white border-blue-600 shadow-sm',         inactive: 'bg-blue-50 text-blue-600 border-blue-200',         line: '#3b82f6', strip: 'bg-blue-50 border-blue-100',      sync: 'bg-gradient-to-br from-blue-600 to-blue-800 border-blue-700' },
  'Invested':         { active: 'bg-gradient-to-r from-violet-500 to-purple-600 text-white border-violet-600 shadow-sm',   inactive: 'bg-violet-50 text-violet-600 border-violet-200',   line: '#8b5cf6', strip: 'bg-violet-50 border-violet-100',  sync: 'bg-gradient-to-br from-violet-600 to-purple-800 border-violet-700' },
  'Unrealized Gains': { active: 'bg-gradient-to-r from-teal-400 to-emerald-500 text-white border-teal-500 shadow-sm',      inactive: 'bg-teal-50 text-teal-700 border-teal-200',         line: '#14b8a6', strip: 'bg-teal-50 border-teal-100',      sync: 'bg-gradient-to-br from-teal-600 to-emerald-700 border-teal-700' },
  'Realized Gains':   { active: 'bg-gradient-to-r from-amber-400 to-orange-500 text-white border-amber-500 shadow-sm',    inactive: 'bg-amber-50 text-amber-700 border-amber-200',      line: '#f59e0b', strip: 'bg-amber-50 border-amber-100',    sync: 'bg-gradient-to-br from-amber-500 to-orange-700 border-amber-600' },
  'Total Gains':      { active: 'bg-gradient-to-r from-emerald-500 to-green-600 text-white border-emerald-600 shadow-sm', inactive: 'bg-emerald-50 text-emerald-700 border-emerald-200', line: '#10b981', strip: 'bg-emerald-50 border-emerald-100', sync: 'bg-gradient-to-br from-emerald-600 to-green-800 border-emerald-700' },
  'Return %':         { active: 'bg-gradient-to-r from-sky-400 to-cyan-500 text-white border-sky-500 shadow-sm',           inactive: 'bg-sky-50 text-sky-600 border-sky-200',            line: '#0ea5e9', strip: 'bg-sky-50 border-sky-100',        sync: 'bg-gradient-to-br from-sky-600 to-cyan-700 border-sky-700' },
  'XIRR Trend':       { active: 'bg-gradient-to-r from-rose-500 to-pink-600 text-white border-rose-500 shadow-sm',        inactive: 'bg-rose-50 text-rose-600 border-rose-200',         line: '#f43f5e', strip: 'bg-rose-50 border-rose-100',      sync: 'bg-gradient-to-br from-rose-600 to-pink-800 border-rose-700' },
}

const METRIC_HEX: Record<ChartMetric, { stripBg: string; stripBorder: string; syncFrom: string; syncTo: string; syncBorder: string; line: string; pillActiveBg: string; pillActiveBorder: string; pillInactiveBg: string; pillInactiveBorder: string; pillInactiveColor: string }> = {
  'Price':            { stripBg: '#eef2ff', stripBorder: '#e0e7ff', syncFrom: '#4f46e5', syncTo: '#312e81', syncBorder: '#4338ca', line: '#6366f1', pillActiveBg: 'linear-gradient(to right,#4f46e5,#4338ca)', pillActiveBorder: '#4338ca', pillInactiveBg: '#eef2ff', pillInactiveBorder: '#c7d2fe', pillInactiveColor: '#4f46e5' },
  'Portfolio Value':  { stripBg: '#eff6ff', stripBorder: '#dbeafe', syncFrom: '#2563eb', syncTo: '#1e40af', syncBorder: '#1d4ed8', line: '#3b82f6', pillActiveBg: 'linear-gradient(to right,#3b82f6,#2563eb)', pillActiveBorder: '#1d4ed8', pillInactiveBg: '#eff6ff', pillInactiveBorder: '#bfdbfe', pillInactiveColor: '#2563eb' },
  'Invested':         { stripBg: '#f5f3ff', stripBorder: '#ede9fe', syncFrom: '#7c3aed', syncTo: '#4c1d95', syncBorder: '#6d28d9', line: '#8b5cf6', pillActiveBg: 'linear-gradient(to right,#8b5cf6,#7c3aed)', pillActiveBorder: '#6d28d9', pillInactiveBg: '#f5f3ff', pillInactiveBorder: '#ddd6fe', pillInactiveColor: '#7c3aed' },
  'Unrealized Gains': { stripBg: '#f0fdfa', stripBorder: '#ccfbf1', syncFrom: '#0d9488', syncTo: '#064e3b', syncBorder: '#0f766e', line: '#14b8a6', pillActiveBg: 'linear-gradient(to right,#2dd4bf,#10b981)', pillActiveBorder: '#0f766e', pillInactiveBg: '#f0fdfa', pillInactiveBorder: '#99f6e4', pillInactiveColor: '#0d9488' },
  'Realized Gains':   { stripBg: '#fdf2f8', stripBorder: '#fbcfe8', syncFrom: '#be185d', syncTo: '#9d174d', syncBorder: '#9d174d', line: '#ec4899', pillActiveBg: 'linear-gradient(to right,#ec4899,#db2777)', pillActiveBorder: '#be185d', pillInactiveBg: '#fdf2f8', pillInactiveBorder: '#fbcfe8', pillInactiveColor: '#be185d' },
  'Total Gains':      { stripBg: '#f0fdf4', stripBorder: '#dcfce7', syncFrom: '#16a34a', syncTo: '#14532d', syncBorder: '#15803d', line: '#10b981', pillActiveBg: 'linear-gradient(to right,#10b981,#16a34a)', pillActiveBorder: '#15803d', pillInactiveBg: '#f0fdf4', pillInactiveBorder: '#bbf7d0', pillInactiveColor: '#15803d' },
  'Return %':         { stripBg: '#f0f9ff', stripBorder: '#e0f2fe', syncFrom: '#0284c7', syncTo: '#0c4a6e', syncBorder: '#0369a1', line: '#0ea5e9', pillActiveBg: 'linear-gradient(to right,#38bdf8,#0ea5e9)', pillActiveBorder: '#0369a1', pillInactiveBg: '#f0f9ff', pillInactiveBorder: '#bae6fd', pillInactiveColor: '#0369a1' },
  'XIRR Trend':       { stripBg: '#fff1f2', stripBorder: '#ffe4e6', syncFrom: '#e11d48', syncTo: '#881337', syncBorder: '#be123c', line: '#f43f5e', pillActiveBg: 'linear-gradient(to right,#fb7185,#e11d48)', pillActiveBorder: '#be123c', pillInactiveBg: '#fff1f2', pillInactiveBorder: '#fecdd3', pillInactiveColor: '#be123c' },
}

const fmtSyncTime = (d: Date) => {
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  const day = d.getDate()
  const mon = d.toLocaleString('en', { month: 'short' })
  return `${h}:${m} ${day} ${mon}`
}

interface Props { currency: Currency }

export default function TransactionsPage({ currency }: Props) {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { portfolio = '', symbol = '' } = useParams<{ portfolio: string; symbol: string }>()
  const { data, isLoading, error } = usePortfolio(currency)
  const qc = useQueryClient()
  const [activeTab,   setActiveTab]   = useState<'transactions' | 'charts' | 'report' | 'notes'>('transactions')

  useEffect(() => { window.scrollTo(0, 0) }, [])
  const [chartMetric, setChartMetric] = useState<ChartMetric>('Price')
  const [chartRange,  setChartRange]  = useState<ChartRange>('1y')
  const [syncing,       setSyncing]       = useState(false)
  const [reportSyncing, setReportSyncing] = useState(false)
  const [syncedAt,      setSyncedAt]      = useState<Date | null>(null)
  const [reportSubTab,  setReportSubTab]  = useState<'deep' | 'quickstats' | 'links'>('quickstats')
  const [reportUseLite, setReportUseLite] = useState(false)
  const [reportUse31,   setReportUse31]   = useState(false)
  const [reportUseKey,  setReportUseKey]  = useState<0 | 1 | 2>(() => { const v = localStorage.getItem('gemini:key_index'); return (v === '1' ? 1 : v === '2' ? 2 : 0) })
  const chatOpenerRef = React.useRef<{ open: (contextId?: string) => void } | null>(null)
  const [reportGearOpen, setReportGearOpen] = useState(false)
  const [chartZoomed,    setChartZoomed]    = useState(false)

  const decoded = {
    portfolio: decodeURIComponent(portfolio),
    symbol:    decodeURIComponent(symbol),
  }
  const symDividends = useDividendForSymbol(decoded.symbol)
  const [divSectionOpen, setDivSectionOpen] = useState(false)

  // portfolios passed via nav state when navigating from a segment (cumulative) view;
  // falls back to the single portfolio in the URL for direct/broker navigation
  const portfolioFilter: string[] = useMemo(() => {
    const s = (location.state as { from?: string; portfolios?: string[] } | null)?.portfolios
    return s?.length ? s : [decoded.portfolio]
  }, [location.state, decoded.portfolio])

  // When navigating from an aggregate portfolio (Equity / MF_Portfolio), the URL portfolio
  // is a SKIP_PORT but actual transactions live in the constituent portfolios (MF_Vikash etc.)
  const isAggregate = useMemo(() => portfolioFilter.every(p => SKIP_PORTS.has(p)), [portfolioFilter])

  const realizedMap = useMemo(
    () => (data ? aggRealized(data.realized, data.usd_inr) : new Map()),
    [data],
  )

  const holdingList = useMemo(() => {
    if (!data) return []
    return data.holdings.filter(
      h => (isAggregate ? !SKIP_PORTS.has(h.portfolio) : portfolioFilter.includes(h.portfolio)) && h.symbol === decoded.symbol,
    )
  }, [data, portfolioFilter, isAggregate, decoded.symbol])

  const holding = holdingList[0] ?? null  // reference holding for ltp, company, yf_symbol, avg_cost

  const symTxns = useMemo(() => {
    if (!data) return []
    return data.transactions
      .filter(t =>
        t.symbol === decoded.symbol &&
        (t.type === 'BUY' || t.type === 'SELL') &&
        !SKIP_PORTS.has(t.portfolio),
      )
      .sort((a, b) => b.date.localeCompare(a.date))  // newest first
  }, [data, decoded.symbol])

  const holdingArr = useMemo(() => holdingList, [holdingList])

  // For closed holdings (no open position), build synthetic holding objects so
  // usePortfolioHistory can fetch price history and compute historical series.
  const holdingArrForCharts = useMemo((): Holding[] => {
    if (holdingArr.length > 0 || !symTxns.length || !data) return holdingArr
    const yfSym = symTxns.find(t => t.yf_symbol)?.yf_symbol ?? decoded.symbol
    const portSet = new Set(symTxns.map(t => t.portfolio))
    return [...portSet].map(port => {
      const portBuys = symTxns.filter(t => t.portfolio === port && t.type === 'BUY')
      const totalBuyQty  = portBuys.reduce((s, t) => s + t.quantity, 0)
      const totalBuyCost = portBuys.reduce((s, t) => s + t.quantity * t.price + (t.charges ?? 0), 0)
      return {
        portfolio: port, symbol: decoded.symbol, exchange: '', yf_symbol: yfSym,
        currency: (USD_PORTS.has(port) ? 'USD' : 'INR') as 'USD' | 'INR',
        quantity: 0, current_price: 0,
        avg_cost: totalBuyQty > 0 ? totalBuyCost / totalBuyQty : 0,
        total_invested: 0, current_value: 0, unrealized_pnl: 0, pnl_pct: null,
        sector: null, company: null, name: null, previous_close: null,
        disp_invested: 0, disp_current: 0, disp_gain: 0, disp_pnl_pct: null,
        today_gain: null, today_pct: null, disp_today_gain: null,
      } as Holding
    })
  }, [holdingArr, symTxns, data, decoded.symbol])

  // Pre-compute yf_symbol before early returns so useQuickStats hook order is stable
  const yf_for_hook = useMemo(() => {
    if (!data) return decoded.symbol
    return (
      data.holdings.find(
        h => portfolioFilter.includes(h.portfolio) && h.symbol === decoded.symbol && !SKIP_PORTS.has(h.portfolio),
      )?.yf_symbol
      ?? data.transactions.find(
        t => t.symbol === decoded.symbol && portfolioFilter.includes(t.portfolio),
      )?.yf_symbol
      ?? decoded.symbol
    )
  }, [data, portfolioFilter, decoded.symbol])

  const { data: quickStats, isLoading: qsLoading, isFetching: qsFetching } = useQuickStats(yf_for_hook, activeTab === 'report' && !!data)

  const symRealized = useMemo(() => {
    if (!data) return []
    return data.realized.filter(
      r => !SKIP_PORTS.has(r.portfolio) && r.symbol === decoded.symbol,
    )
  }, [data, decoded.symbol])

  const holdingXirr = useMemo(() => {
    if (!symTxns.length || !data) return null
    const today = new Date()
    const aggCurrent = holdingList.reduce((s, h) => s + h.disp_current, 0)
    const cfs: { date: Date; amount: number }[] = []
    for (const tx of symTxns) {
      const isUsd = USD_PORTS.has(tx.portfolio)
      const fx = isUsd ? data.usd_inr : 1
      const amt = tx.quantity * tx.price * fx
      const chg = (tx.charges ?? 0) * fx
      if (tx.type === 'BUY')  cfs.push({ date: new Date(tx.date), amount: -(amt + chg) })
      if (tx.type === 'SELL') cfs.push({ date: new Date(tx.date), amount:   amt - chg })
    }
    if (aggCurrent > 0) cfs.push({ date: today, amount: aggCurrent })
    const r = computeXIRR(cfs)
    return r !== null ? r * 100 : null
  }, [symTxns, holdingList, data])

  const txGains = useMemo(() => {
    if (!data) return []
    const isUsdPort = USD_PORTS.has(decoded.portfolio)
    const fx = isUsdPort ? (currency === 'USD' ? 1 : data.usd_inr) : 1

    // Aggregate realized entries by sell_date (for SELL tx rows) and buy_date (for BUY tx rows)
    const sellMap = new Map<string, { gain: number; cost: number }>()
    const buyMap  = new Map<string, { qtyRealized: number; realGain: number; realCost: number }>()

    for (const r of symRealized) {
      if (r.type !== 'SELL') continue
      const pnl  = r.realized_pnl * fx
      const cost = r.quantity * r.buy_price * fx
      const sk = r.sell_date.slice(0, 10)
      const se = sellMap.get(sk) ?? { gain: 0, cost: 0 }
      sellMap.set(sk, { gain: se.gain + pnl, cost: se.cost + cost })
      if (!r.buy_date) continue
      const bk = r.buy_date.slice(0, 10)
      const be = buyMap.get(bk) ?? { qtyRealized: 0, realGain: 0, realCost: 0 }
      buyMap.set(bk, { qtyRealized: be.qtyRealized + r.quantity, realGain: be.realGain + pnl, realCost: be.realCost + cost })
    }

    // Track how much of each date's qtyRealized has been attributed to earlier same-date lots
    const dateQtyAttributed = new Map<string, number>()

    return symTxns.map(tx => {
      if (tx.type === 'SELL') {
        const s = sellMap.get(tx.date.slice(0, 10))
        if (!s) return null
        return { status: 'realized' as const, gain: s.gain, pct: s.cost !== 0 ? (s.gain / s.cost) * 100 : 0 }
      }

      // BUY — distribute same-date qtyRealized in FIFO order across lots
      // holding may be null for fully closed positions; use current_price=0 (no open qty remains)
      const currentPrice = holding?.current_price ?? 0
      const dateKey  = tx.date.slice(0, 10)
      const bTotal   = buyMap.get(dateKey) ?? { qtyRealized: 0, realGain: 0, realCost: 0 }
      const prevUsed = dateQtyAttributed.get(dateKey) ?? 0
      const qtyRealizedThisLot = Math.max(0, Math.min(tx.quantity, bTotal.qtyRealized - prevUsed))
      dateQtyAttributed.set(dateKey, prevUsed + qtyRealizedThisLot)

      const fraction   = bTotal.qtyRealized > 1e-9 ? qtyRealizedThisLot / bTotal.qtyRealized : 0
      const b          = { qtyRealized: qtyRealizedThisLot, realGain: bTotal.realGain * fraction, realCost: bTotal.realCost * fraction }
      const qtyRemaining   = tx.quantity - qtyRealizedThisLot
      const unrealGain     = (currentPrice - tx.price) * Math.max(0, qtyRemaining) * fx
      const unrealPct      = tx.price !== 0 ? ((currentPrice - tx.price) / tx.price) * 100 : 0
      const currentValue   = currentPrice * Math.max(0, qtyRemaining) * fx

      if (b.qtyRealized <= 1e-9)
        return { status: 'held' as const, gain: unrealGain, pct: unrealPct, currentValue }
      if (qtyRemaining <= 1e-9)
        return { status: 'sold' as const, gain: b.realGain, pct: b.realCost !== 0 ? (b.realGain / b.realCost) * 100 : 0 }
      return {
        status:    'partial' as const,
        realGain:  b.realGain,  realPct:  b.realCost !== 0 ? (b.realGain / b.realCost) * 100 : 0, realQty:  b.qtyRealized,
        unrealGain, unrealPct, unrealQty: qtyRemaining, currentValue,
      }
    })
  }, [symTxns, symRealized, holding, data, decoded.portfolio, currency])

  const { series: portSeries, isLoading: histLoading, loadedCount: txLoaded, totalCount: txTotal, fetchingCount: txFetching, symbolPriceMap: txPriceMap } = usePortfolioHistory(
    holdingArrForCharts,
    symTxns,
    symRealized,
    data?.usd_inr ?? 95.5,
    currency,
    !!data,
  )

  const metricSeries = useMemo((): DatedSeries | null => {
    if (!portSeries || chartMetric === 'Price') return null
    const key = METRIC_SERIES_KEY[chartMetric as Exclude<ChartMetric, 'Price'>]
    const raw = portSeries[key] as DatedSeries
    return sliceSeries(raw, chartRange)
  }, [portSeries, chartMetric, chartRange])

  const yDomain = useMemo((): [number, number] | ['auto', 'auto'] => {
    if (!metricSeries || !metricSeries.values.length) return ['auto', 'auto']
    const vals = metricSeries.values.filter(v => isFinite(v))
    if (!vals.length) return ['auto', 'auto']
    const min = Math.min(...vals)
    const max = Math.max(...vals)
    const pad = Math.abs(max - min) * 0.08 || Math.abs(max || min) * 0.05 || 1
    return [min - pad, max + pad]
  }, [metricSeries])

  const rechartsData = useMemo(
    () => metricSeries?.dates.map((d, i) => ({
      t: d.toISOString().slice(0, 10),
      v: metricSeries.values[i],
    })) ?? [],
    [metricSeries],
  )

  if (isLoading) return <LoadingSkeleton />
  if (error || !data) return <ErrorState message={(error as Error)?.message ?? 'Unknown error'} />

  // USD portfolios (Vested/IndMoney US/IndMoney Mummy) show in USD when toggle is USD;
  // all Indian portfolios always display in INR regardless of the toggle.
  const isUsdHolding = USD_PORTS.has(decoded.portfolio)
  const dispCur: Currency = isUsdHolding ? currency : 'INR'
  const holdFx = isUsdHolding && currency === 'USD' ? 1 / (data?.usd_inr ?? 95.5) : 1

  // Aggregate realized across all portfolios in view (always in INR from aggRealized)
  const [realGainINR, realCostINR] = portfolioFilter.reduce<[number, number]>(
    ([g, c], p) => {
      const [rg, rc] = realizedMap.get(`${p}:${decoded.symbol}`) ?? [0, 0]
      return [g + rg, c + rc]
    },
    [0, 0],
  )
  const realGain = realGainINR * holdFx
  const realCost = realCostINR * holdFx
  const realColor = realGain >= 0 ? '#0a7a42' : '#be1c1c'
  const fromLabel = (location.state as { from?: string } | null)?.from ?? decoded.portfolio
  const backLabel = `← ${fromLabel} Holdings`

  // Symbol overview card values — aggregated across all portfolios in view
  const cur     = holdingList.reduce((s, h) => s + h.disp_current,  0) * holdFx
  const inv     = holdingList.reduce((s, h) => s + h.disp_invested, 0) * holdFx
  const gain    = cur - inv
  const pct     = inv !== 0 ? (gain / inv) * 100 : 0
  const gainPos = (gain + realGain) >= 0
  const border  = gainPos ? '#10b981' : '#f43f5e'
  const bg      = gainPos ? '#f0fdf8' : '#fff5f5'
  const tc      = gainPos ? '#0a7a42' : '#be1c1c'

  const tgRaw = holdingList.some(h => h.disp_today_gain !== null)
    ? holdingList.reduce((s, h) => s + (h.disp_today_gain ?? 0), 0) * holdFx
    : null
  const tg    = tgRaw
  const prior = cur - (tgRaw ?? 0)
  const tp    = tgRaw !== null && prior !== 0 ? (tgRaw / prior) * 100 : null
  const tgC   = tg !== null ? (tg >= 0 ? '#0a7a42' : '#be1c1c') : '#94a3b8'

  const aggQty    = holdingList.reduce((s, h) => s + h.quantity, 0)
  const aggAvgCost = aggQty > 0 ? holdingList.reduce((s, h) => s + h.avg_cost * h.quantity, 0) / aggQty : 0
  // for closed holdings (no open position), try any portfolio's holding for LTP/name/yf_symbol
  const anyHolding = holding ?? data.holdings.find(h => h.symbol === decoded.symbol && !SKIP_PORTS.has(h.portfolio)) ?? null
  const yf    = anyHolding?.yf_symbol ?? symTxns.find(t => t.yf_symbol)?.yf_symbol ?? decoded.symbol
  const co    = anyHolding?.company ?? ''
  const qty   = holdingList.length ? aggQty.toFixed(3) : '—'
  const avg   = holdingList.length ? aggAvgCost.toFixed(2) : '—'
  const ltpPrice: number | null = (() => {
    if (anyHolding?.current_price) return anyHolding.current_price
    const dm = txPriceMap.get(yf)
    if (!dm?.size) return null
    return dm.get([...dm.keys()].sort().at(-1)!) ?? null
  })()
  const ltp   = ltpPrice != null ? ltpPrice.toFixed(2) : '—'

  const isPct       = PCT_METRICS.has(chartMetric)
  const chartLast   = metricSeries?.values[metricSeries.values.length - 1] ?? null
  const chartFirst  = metricSeries?.values[0] ?? null
  const chartChange = chartLast !== null && chartFirst !== null ? chartLast - chartFirst : null
  const lineColor   = METRIC_HEX[chartMetric].line
  const lastColor   = (chartLast ?? 0) >= 0 ? '#0a7a42' : '#be1c1c'

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
      <div className="shrink-0 px-4 pt-3 bg-white">
      {/* Back */}
      <button onClick={() => navigate(-1)} className="text-[11px] text-[#2563eb] mb-3">
        {backLabel}
      </button>

      {/* Symbol overview card */}
      <div
        className="rounded-[10px] border mb-3 overflow-hidden shadow-sm"
        style={{ background: bg, borderColor: '#e2e8f0', borderLeftWidth: 4, borderLeftColor: border }}
      >
        <div className="h-[3px]" style={{ background: `linear-gradient(to right, ${border}, ${border}55)` }} />
        <div className="px-3 py-2.5">
        {/* Label row */}
        <div className="flex justify-between items-center mb-1">
          <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider truncate max-w-[75%]">
            {co || decoded.symbol}
          </span>
          <span className="text-[10px] text-slate-400 shrink-0">
            LTP <span className="text-slate-600 font-semibold">{ltp}</span>
          </span>
        </div>

        {/* Current value + today gain */}
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-[20px] font-bold text-slate-900 tracking-tight">
            {fmt(cur, dispCur)}
          </span>
          <span className="flex items-center gap-1 shrink-0 whitespace-nowrap">
            <span className="text-[10px] text-slate-400">Today</span>
            <span className="text-[10px]" style={{ color: tgC }}>
              {tg !== null ? fmtCompactGainLine(tg, tp, dispCur) : '—'}
            </span>
          </span>
        </div>

        {/* XIRR | Total G/L */}
        <div className="flex items-baseline justify-between mb-2">
          {holdingXirr !== null
            ? <span className="text-[10px]" style={{ color: holdingXirr >= 0 ? '#0a7a42' : '#be1c1c' }}>XIRR {fmtPct(holdingXirr)}</span>
            : <span className="text-[10px] text-slate-400">XIRR —</span>
          }
          <span className="flex items-center gap-1 shrink-0 whitespace-nowrap">
            <span className="text-[10px] text-slate-400">Total</span>
            <span className="text-[10px]" style={{ color: tc }}>
              {fmtCompactGainLine(gain + realGain, inv + realCost !== 0 ? (gain + realGain) / (inv + realCost) * 100 : 0, dispCur)}
            </span>
          </span>
        </div>

        {/* Footer: Invested · qty · avg | Realized */}
        <div
          className="flex justify-between pt-1.5"
          style={{ borderTop: '1px solid #e2e8f0' }}
        >
          <span className="text-[10px] text-slate-400">
            Invested{' '}
            <span className="text-slate-600 font-semibold">{fmt(inv, dispCur)}</span>
            {holding && <span className="text-slate-400"> · {qty} sh · {avg}/sh</span>}
          </span>
          <span className="text-[10px] text-slate-400">
            Realized{' '}
            <span className="font-semibold" style={{ color: realColor }}>
              {fmtGainLine(realGain, null, dispCur)}
            </span>
          </span>
        </div>
        </div>
      </div>

      {/* Tabs — iOS segmented control */}
      <div className="flex bg-slate-100 rounded-full p-0.5 gap-0.5 mb-2">
        {([['transactions','Txns'],['charts','Charts'],['report','Research'],['notes','Notes']] as const).map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 text-[10px] py-1 rounded-full font-medium transition-all ${
              activeTab === tab
                ? tab === 'transactions' ? 'bg-teal-200 text-teal-800 shadow-sm'
                : tab === 'charts'       ? 'bg-sky-200 text-sky-800 shadow-sm'
                : tab === 'report'       ? 'bg-violet-200 text-violet-800 shadow-sm'
                : 'bg-rose-200 text-rose-800 shadow-sm'
                : 'text-slate-400'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Transactions strip */}
      {activeTab === 'transactions' && (
        <div className="bg-teal-50 border border-teal-100 rounded-xl px-2.5 py-1 mb-2">
          <span className="text-[10px] text-teal-700">{symTxns.length} transactions</span>
        </div>
      )}
      {/* Report strip — sub-tab bar */}
      {activeTab === 'report' && (
        <div className="bg-violet-50 border border-violet-100 rounded-xl px-2.5 py-1.5 mb-2 flex items-center justify-between">
          {/* Sub-tabs */}
          <div className="flex items-center bg-violet-100 rounded-lg p-0.5 gap-0.5">
            <button
              onClick={() => setReportSubTab('quickstats')}
              className={`text-[10px] px-2.5 py-1 rounded-md transition-colors font-medium ${reportSubTab === 'quickstats' ? 'bg-emerald-500 text-white shadow-sm border border-emerald-600' : 'bg-emerald-100 text-emerald-700 border border-emerald-200'}`}
            >Quick Stats</button>
            <button
              onClick={() => setReportSubTab('deep')}
              className={`text-[10px] px-2.5 py-1 rounded-md transition-colors font-medium ${reportSubTab === 'deep' ? 'bg-violet-600 text-white shadow-sm border border-violet-700' : 'bg-violet-200 text-violet-600 border border-violet-300'}`}
            >Deep Research</button>
            <button
              onClick={() => setReportSubTab('links')}
              className={`text-[10px] px-2.5 py-1 rounded-md transition-colors font-medium ${reportSubTab === 'links' ? 'bg-sky-500 text-white shadow-sm border border-sky-600' : 'bg-sky-100 text-sky-700 border border-sky-200'}`}
            >Explore</button>
          </div>
          {/* Right controls */}
          {reportSubTab === 'links' ? null : reportSubTab === 'deep' ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => chatOpenerRef.current?.open()}
                className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium border bg-violet-600 text-white border-violet-700 active:bg-violet-700 shrink-0"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2c-.5 4-4 7.5-10 10 6 2.5 9.5 6 10 10 .5-4 4-7.5 10-10-6-2.5-9.5-6-10-10z"/>
                </svg>
                <span>AI Assistant</span>
              </button>
              <div className="relative">
                <button onClick={() => setReportGearOpen(o => !o)} className="p-1 text-violet-400 active:text-violet-600" title="Settings">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
                  </svg>
                </button>
                {reportGearOpen && (
                  <>
                  <div className="fixed inset-0 z-[9]" onClick={() => setReportGearOpen(false)} />
                  <div className="absolute right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg z-10 px-3 py-2.5 flex flex-col gap-2.5 whitespace-nowrap">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[11px] text-slate-500">Model</span>
                      <div className="flex bg-slate-100 rounded-full p-0.5 gap-0.5">
                        {([
                          { label: '2.5 Flash', lite: false, is31: false },
                          { label: '2.5 Lite',  lite: true,  is31: false },
                          { label: '3.1 Lite',  lite: false, is31: true  },
                        ] as const).map(opt => {
                          const active = opt.is31 ? reportUse31 : (!reportUse31 && reportUseLite === opt.lite)
                          return (
                            <button key={opt.label}
                              onClick={() => { setReportUse31(opt.is31); setReportUseLite(opt.lite) }}
                              className={`text-[12px] px-2.5 py-1 rounded-full font-medium transition-colors ${active ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-400'}`}
                            >{opt.label}</button>
                          )
                        })}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[11px] text-slate-500">API Key</span>
                      <div className="flex bg-slate-100 rounded-full p-0.5">
                        {([0, 1, 2] as const).map(i => (
                          <button
                            key={i}
                            onClick={() => { setReportUseKey(i); localStorage.setItem('gemini:key_index', String(i)) }}
                            className={`flex-1 text-[10px] px-3 py-1 rounded-full font-medium transition-all duration-150 ${reportUseKey === i ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400 active:bg-white/60'}`}
                          >Key {i + 1}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <button
              className="flex items-center gap-0.5 rounded-full px-1.5 py-0.5 border active:opacity-60 bg-gradient-to-br from-violet-600 to-purple-800 border-violet-700"
              onClick={() => { if (reportSyncing) return; setReportSyncing(true); qc.resetQueries({ queryKey: ['quickstats', yf] }); setTimeout(() => setReportSyncing(false), 1500) }}
            >
              <span className={`text-[9px] text-white leading-none inline-block ${reportSyncing ? 'animate-spin' : ''}`}>↻</span>
            </button>
          )}
        </div>
      )}
      {/* Notes strip */}
      {activeTab === 'notes' && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl px-2.5 py-1.5 mb-2 flex items-center">
          <span className="text-[10px] text-rose-700">Personal notes</span>
        </div>
      )}
      {/* Charts strip — metric pills + sync */}
      {activeTab === 'charts' && (
        <div className="border rounded-xl px-2.5 py-1.5 mb-2 bg-sky-50 border-sky-200">
          <div className="flex items-center gap-2">
            <div
              className="flex gap-0.5 overflow-x-auto flex-1 rounded-lg p-0.5"
              style={{ backgroundColor: '#bae6fd44', scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
            >
              {METRICS.map(m => (
                <button
                  key={m}
                  onClick={() => setChartMetric(m)}
                  className="text-[10px] whitespace-nowrap px-2.5 py-1 rounded-md font-medium transition-all"
                  style={chartMetric === m
                    ? { backgroundColor: METRIC_HEX[m].pillActiveBorder, color: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.15)', border: `1px solid ${METRIC_HEX[m].pillActiveBorder}` }
                    : { backgroundColor: METRIC_HEX[m].pillInactiveBg, color: METRIC_HEX[m].pillInactiveColor, border: `1px solid ${METRIC_HEX[m].pillInactiveBorder}` }
                  }
                >
                  {m}
                </button>
              ))}
            </div>
            <button
              className="flex items-center gap-0.5 shrink-0 rounded-full px-1.5 py-0.5 border active:opacity-60 bg-gradient-to-br from-sky-600 to-cyan-700 border-sky-700"
              onClick={() => {
                if (syncing) return
                setSyncing(true)
                qc.invalidateQueries({ queryKey: ['history', yf] })
                setTimeout(() => { setSyncedAt(new Date()); setSyncing(false) }, 1200)
              }}
            >
              <span className={`text-[9px] text-white leading-none inline-block ${syncing ? 'animate-spin' : ''}`}>↻</span>
              {syncedAt && <span className="text-[9px] text-white whitespace-nowrap leading-none ml-0.5">{fmtSyncTime(syncedAt)}</span>}
            </button>
          </div>
        </div>
      )}
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-4">

      {activeTab === 'transactions' && (
        <>
          {symTxns.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-6">No transactions found</p>
          ) : (
            <>
              {symTxns.map((t, i) => (
                <TxRow
                  key={`${t.date}-${i}`}
                  tx={t}
                  currency={dispCur}
                  usdInr={data.usd_inr}
                  gain={txGains[i] ?? null}
                />
              ))}
            </>
          )}

          {/* Dividends received section */}
          {symDividends && symDividends.total_dividends > 0 && (
            <div className="mt-4 border border-teal-100 rounded-xl overflow-hidden">
              <button
                onClick={() => setDivSectionOpen(o => !o)}
                className="w-full flex items-center justify-between px-3 py-2.5 bg-teal-50 active:bg-teal-100"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-teal-700 uppercase tracking-wider">Dividends received</span>
                  <span className="text-[10px] bg-teal-200 text-teal-800 rounded-full px-1.5 py-0.5 font-medium">{symDividends.event_count}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-bold text-teal-700">
                    +₹{symDividends.total_dividends.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </span>
                  <svg className={`w-3 h-3 text-teal-400 transition-transform ${divSectionOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="m6 9 6 6 6-6"/>
                  </svg>
                </div>
              </button>

              {divSectionOpen && (
                <div className="bg-white px-3 pb-2 pt-1">
                  {symDividends.yield_on_cost !== null && (
                    <p className="text-[10px] text-teal-600 mb-2">
                      Yield on cost: {symDividends.yield_on_cost.toFixed(1)}%
                      {symDividends.projected_annual > 0 && ` · ~₹${symDividends.projected_annual.toLocaleString('en-IN', { maximumFractionDigits: 0 })}/year projected`}
                    </p>
                  )}
                  <div className="flex items-center gap-2 px-1 py-0.5 mb-1">
                    <span className="text-[9px] font-semibold text-slate-400 w-[80px]">Ex-date</span>
                    <span className="text-[9px] font-semibold text-slate-400 flex-1 text-right">Shares</span>
                    <span className="text-[9px] font-semibold text-slate-400 w-[56px] text-right">₹/share</span>
                    <span className="text-[9px] font-semibold text-slate-400 w-[64px] text-right">Earned</span>
                  </div>
                  {symDividends.events.map(ev => (
                    <div key={ev.ex_date} className="flex items-center gap-2 px-1 py-1 border-t border-slate-50">
                      <span className="text-[10px] text-slate-500 w-[80px] tabular-nums">{ev.ex_date}</span>
                      <span className="text-[10px] text-slate-600 flex-1 text-right tabular-nums">{ev.shares_held.toLocaleString()}</span>
                      <span className="text-[10px] text-slate-600 w-[56px] text-right tabular-nums">
                        {ev.div_currency === 'USD' ? `$${ev.div_per_share.toFixed(2)}` : `₹${ev.div_per_share.toFixed(2)}`}
                      </span>
                      <span className="text-[10px] font-semibold text-teal-700 w-[64px] text-right tabular-nums">
                        +₹{ev.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {activeTab === 'notes' && (
        <AnalysisTab portfolio={decoded.portfolio} symbol={decoded.symbol} />
      )}

      {activeTab === 'report' && reportSubTab !== 'links' && (
        <ReportTab
          yf_symbol={yf}
          name={co || decoded.symbol}
          qs={quickStats}
          loading={qsLoading || qsFetching}
          reportTab={reportSubTab}
          useLite={reportUseLite}
          use31={reportUse31}
          useKey={reportUseKey}
          chatOpenerRef={chatOpenerRef}
        />
      )}
      {activeTab === 'report' && reportSubTab === 'links' && (() => {
        const isIndian = yf.endsWith('.NS') || yf.endsWith('.BO')
        const isMF = portfolioFilter.some(p => p.startsWith('MF_'))
        const cleanSym = yf.replace(/\.(NS|BO)$/i, '')
        const fundName = encodeURIComponent(co || cleanSym)
        const links: { name: string; desc: string; url: string; color: string }[] = isMF ? [
          { name: 'Yahoo Finance',   desc: 'NAV history, news & fund details',            url: `https://finance.yahoo.com/quote/${yf}`,                                                                                    color: '#2563eb' },
          { name: 'Fundoo Data',     desc: 'MF analytics, portfolio overlap & SIP data',  url: `https://www.fundoodata.com/`,                                                                                              color: '#0d9488' },
          { name: 'AdvisorKhoj',     desc: 'Fund comparison, SIP returns & analysis',     url: `https://www.advisorkhoj.com/`,                                                                                             color: '#7c3aed' },
          { name: 'Value Research',  desc: 'Fund ratings, NAV history & star rating',     url: `https://www.valueresearchonline.com/funds/newsearch/?q=${fundName}`,                                                       color: '#dc2626' },
        ] : isIndian ? [
          { name: 'Screener.in',     desc: 'Fundamentals, financials & ratios',           url: `https://www.screener.in/company/${cleanSym}/`,                                                                            color: '#0d9488' },
          { name: 'Trendlyne',       desc: 'Technicals, forecasts & DII/FII data',        url: `https://trendlyne.com/equity/${cleanSym.toUpperCase()}/`,                                                                  color: '#7c3aed' },
          { name: 'NSE India',       desc: 'Exchange quotes, filings & F&O',              url: `https://www.nseindia.com/get-quotes/equity?symbol=${cleanSym}`,                                                           color: '#1d4ed8' },
          { name: 'Yahoo Finance',   desc: 'Price, news & analyst consensus',             url: `https://finance.yahoo.com/quote/${yf}`,                                                                                    color: '#2563eb' },
        ] : [
          { name: 'YFinance',        desc: 'Price, news & analyst consensus',             url: `https://finance.yahoo.com/quote/${yf}`,                                                                                    color: '#2563eb' },
          { name: 'MacroTrends',     desc: 'Long-term historical financials',             url: `https://www.macrotrends.net/stocks/charts/${cleanSym.toUpperCase()}/${cleanSym.toLowerCase()}/stock-price-history`,        color: '#7c3aed' },
          { name: 'TipRanks',        desc: 'Analyst ratings & price targets',             url: `https://www.tipranks.com/stocks/${cleanSym.toLowerCase()}`,                                                                color: '#ea580c' },
          { name: 'SEC EDGAR',       desc: '10-K / 20-F & earnings filings',             url: `https://www.sec.gov/cgi-bin/browse-edgar?company=${cleanSym}&CIK=&type=&dateb=&owner=include&count=40&search_text=&action=getcompany`,        color: '#dc2626' },
          { name: 'Finviz',          desc: 'Charts, screener & insider activity',         url: `https://finviz.com/quote.ashx?t=${cleanSym.toUpperCase()}`,                                                               color: '#0d9488' },
        ]
        return (
          <div className="pt-1 pb-4 flex flex-col gap-2">
            {links.map(link => (
              <a
                key={link.name}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded-xl border border-slate-100 bg-white px-3 py-2.5 shadow-sm active:opacity-60"
              >
                <div>
                  <p className="text-[12px] font-semibold text-slate-700">{link.name}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{link.desc}</p>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={link.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 ml-3">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/>
                  <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </a>
            ))}
          </div>
        )
      })()}

      {activeTab === 'charts' && (
        <div className="px-0 pt-0 pb-3">
          {/* Price chart */}
          {chartMetric === 'Price' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-3">
              <PriceChart
                transactions={symTxns}
                yf_symbol={yf}
                currency={dispCur}
                usdInr={data.usd_inr}
                showZoom
              />
            </div>
          )}

          {/* Historical series charts */}
          {chartMetric !== 'Price' && (
            <>
              {portSeries && !metricSeries && (
                <div className="text-center py-10 text-slate-400 text-xs">
                  No data for this period.
                </div>
              )}

              {histLoading && (() => {
                const isFirst = txLoaded < txTotal
                const done    = isFirst ? txLoaded : txTotal - txFetching
                const pct     = txTotal > 0 ? Math.round(done / txTotal * 100) : 0
                return (
                  <div className="mb-3">
                    <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                      <span>{isFirst ? 'Loading' : 'Syncing'} price history… {done} / {txTotal}</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, backgroundColor: METRIC_HEX[chartMetric].line }} />
                    </div>
                  </div>
                )
              })()}
              {!portSeries && !histLoading && (
                <div className="text-center py-10 text-slate-400 text-xs">
                  No price history available.
                </div>
              )}

              {metricSeries && rechartsData.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-3">
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
                        domain={yDomain}
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

                  {/* Range selector */}
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
            </>
          )}
        </div>
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
            {chartMetric === 'Price' ? (
              <div style={{ flex: 1, minHeight: 0, background: '#fff', borderRadius: 12, padding: 10, overflow: 'hidden' }}>
                <PriceChart transactions={symTxns} yf_symbol={yf} currency={dispCur} usdInr={data.usd_inr} />
              </div>
            ) : metricSeries && rechartsData.length > 0 ? (
              <>
                <div style={{ flex: 1, minHeight: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={rechartsData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="t" tick={{ fontSize: 10, fill: '#94a3b8' }} interval={Math.max(0, Math.floor(rechartsData.length / 8) - 1)} tickFormatter={(d: string) => { const ms = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; const [yr, mo] = d.split('-'); return `${ms[parseInt(mo,10)-1]}'${yr.slice(2)}` }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={yTickFmt} width={52} tickLine={false} axisLine={false} domain={yDomain} />
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
    </div>
  )
}
