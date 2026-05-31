import React, { useMemo, useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { usePortfolio } from '../hooks/usePortfolio'
import { usePortfolioHistory, sliceSeries } from '../hooks/usePortfolioHistory'
import type { DatedSeries, PortfolioSeries } from '../hooks/usePortfolioHistory'
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
  'Realized Gains':   { stripBg: '#fffbeb', stripBorder: '#fef3c7', syncFrom: '#d97706', syncTo: '#92400e', syncBorder: '#b45309', line: '#f59e0b', pillActiveBg: 'linear-gradient(to right,#fbbf24,#f97316)', pillActiveBorder: '#b45309', pillInactiveBg: '#fffbeb', pillInactiveBorder: '#fde68a', pillInactiveColor: '#b45309' },
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

  const decoded = {
    portfolio: decodeURIComponent(portfolio),
    symbol:    decodeURIComponent(symbol),
  }

  // portfolios passed via nav state when navigating from a segment (cumulative) view;
  // falls back to the single portfolio in the URL for direct/broker navigation
  const portfolioFilter: string[] = useMemo(() => {
    const s = (location.state as { from?: string; portfolios?: string[] } | null)?.portfolios
    return s?.length ? s : [decoded.portfolio]
  }, [location.state, decoded.portfolio])

  const realizedMap = useMemo(
    () => (data ? aggRealized(data.realized, data.usd_inr) : new Map()),
    [data],
  )

  const holdingList = useMemo(() => {
    if (!data) return []
    return data.holdings.filter(
      h => portfolioFilter.includes(h.portfolio) && h.symbol === decoded.symbol,
    )
  }, [data, portfolioFilter, decoded.symbol])

  const holding = holdingList[0] ?? null  // reference holding for ltp, company, yf_symbol, avg_cost

  const symTxns = useMemo(() => {
    if (!data) return []
    return data.transactions
      .filter(t =>
        t.symbol === decoded.symbol &&
        portfolioFilter.includes(t.portfolio) &&
        (t.type === 'BUY' || t.type === 'SELL') &&
        !SKIP_PORTS.has(t.portfolio),
      )
      .sort((a, b) => b.date.localeCompare(a.date))  // newest first
  }, [data, decoded.symbol, portfolioFilter])

  const holdingArr = useMemo(() => holdingList, [holdingList])

  // Pre-compute yf_symbol before early returns so useQuickStats hook order is stable
  const yf_for_hook = useMemo(() => {
    if (!data) return decoded.symbol
    return (
      data.holdings.find(
        h => portfolioFilter.includes(h.portfolio) && h.symbol === decoded.symbol && !SKIP_PORTS.has(h.portfolio),
      )?.yf_symbol ?? decoded.symbol
    )
  }, [data, portfolioFilter, decoded.symbol])

  const { data: quickStats, isLoading: qsLoading } = useQuickStats(yf_for_hook, activeTab === 'report')

  const symRealized = useMemo(() => {
    if (!data) return []
    return data.realized.filter(
      r => portfolioFilter.includes(r.portfolio) && r.symbol === decoded.symbol,
    )
  }, [data, portfolioFilter, decoded.symbol])

  const holdingXirr = useMemo(() => {
    if (!symTxns.length || !data) return null
    const today = new Date()
    const aggCurrent = holdingList.reduce((s, h) => s + h.disp_current, 0)
    const cfs: { date: Date; amount: number }[] = []
    for (const tx of symTxns) {
      const isUsd = USD_PORTS.has(tx.portfolio)
      const fx = isUsd ? (currency === 'INR' ? data.usd_inr : 1) : (currency === 'USD' ? 1 / data.usd_inr : 1)
      const amt = tx.quantity * tx.price * fx
      const chg = (tx.charges ?? 0) * fx
      if (tx.type === 'BUY')  cfs.push({ date: new Date(tx.date), amount: -(amt + chg) })
      if (tx.type === 'SELL') cfs.push({ date: new Date(tx.date), amount:   amt - chg })
    }
    if (aggCurrent > 0) cfs.push({ date: today, amount: aggCurrent })
    const r = computeXIRR(cfs)
    return r !== null ? r * 100 : null
  }, [symTxns, holdingList, data, currency])

  const txGains = useMemo(() => {
    if (!data) return []
    const isUsdPort = USD_PORTS.has(decoded.portfolio)
    const fx = isUsdPort ? data.usd_inr : 1

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
  }, [symTxns, symRealized, holding, data, decoded.portfolio])

  const { series: portSeries, isLoading: histLoading, loadedCount: txLoaded, totalCount: txTotal, fetchingCount: txFetching } = usePortfolioHistory(
    holdingArr,
    symTxns,
    symRealized,
    data?.usd_inr ?? 95.5,
    currency,
    chartMetric !== 'Price' && !!data,
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

  const dispCur = currency
  // Aggregate realized across all portfolios in view
  const [realGain, realCost] = portfolioFilter.reduce<[number, number]>(
    ([g, c], p) => {
      const [rg, rc] = realizedMap.get(`${p}:${decoded.symbol}`) ?? [0, 0]
      return [g + rg, c + rc]
    },
    [0, 0],
  )
  const realColor = realGain >= 0 ? '#0a7a42' : '#be1c1c'
  const fromLabel = (location.state as { from?: string } | null)?.from ?? decoded.portfolio
  const backLabel = `← ${fromLabel} Holdings`

  // Symbol overview card values — aggregated across all portfolios in view
  const cur     = holdingList.reduce((s, h) => s + h.disp_current, 0)
  const inv     = holdingList.reduce((s, h) => s + h.disp_invested, 0)
  const gain    = cur - inv
  const pct     = inv !== 0 ? (gain / inv) * 100 : 0
  const gainPos = gain >= 0
  const border  = gainPos ? '#10b981' : '#f43f5e'
  const bg      = gainPos ? '#f0fdf8' : '#fff5f5'
  const tc      = gainPos ? '#0a7a42' : '#be1c1c'

  const tgRaw = holdingList.some(h => h.disp_today_gain !== null)
    ? holdingList.reduce((s, h) => s + (h.disp_today_gain ?? 0), 0)
    : null
  const tg    = tgRaw
  const prior = cur - (tgRaw ?? 0)
  const tp    = tgRaw !== null && prior !== 0 ? (tgRaw / prior) * 100 : null
  const tgC   = tg !== null ? (tg >= 0 ? '#0a7a42' : '#be1c1c') : '#94a3b8'

  const aggQty    = holdingList.reduce((s, h) => s + h.quantity, 0)
  const aggAvgCost = aggQty > 0 ? holdingList.reduce((s, h) => s + h.avg_cost * h.quantity, 0) / aggQty : 0
  // for closed holdings (no open position), try any portfolio's holding for LTP/name/yf_symbol
  const anyHolding = holding ?? data.holdings.find(h => h.symbol === decoded.symbol && !SKIP_PORTS.has(h.portfolio)) ?? null
  const lastSellPrice = symTxns.find(t => t.type === 'SELL')?.price
  const ltp   = anyHolding?.current_price?.toFixed(2) ?? lastSellPrice?.toFixed(2) ?? '—'
  const qty   = holdingList.length ? aggQty.toFixed(3) : '—'
  const avg   = holdingList.length ? aggAvgCost.toFixed(2) : '—'
  const co    = anyHolding?.company ?? ''
  const yf    = anyHolding?.yf_symbol ?? decoded.symbol

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
    <div className="max-w-xl mx-auto px-4 py-4">
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
          <span className="text-[9px] font-bold text-slate-700 uppercase tracking-wider truncate max-w-[75%]">
            {co || decoded.symbol}
          </span>
          <span className="text-[9px] text-slate-400 shrink-0">
            LTP <span className="text-slate-600 font-semibold">{ltp}</span>
          </span>
        </div>

        {/* Current value + today gain */}
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-[20px] font-bold text-slate-900 tracking-tight">
            {fmt(cur, dispCur)}
          </span>
          <span className="flex items-center gap-1 shrink-0 whitespace-nowrap">
            <span className="text-[9px] text-slate-400">Today</span>
            <span className="text-[10px]" style={{ color: tgC }}>
              {tg !== null ? fmtCompactGainLine(tg, tp, dispCur) : '—'}
            </span>
          </span>
        </div>

        {/* XIRR | Total G/L */}
        <div className="flex items-baseline justify-between mb-2">
          {holdingXirr !== null
            ? <span className="text-[9px]" style={{ color: holdingXirr >= 0 ? '#0a7a42' : '#be1c1c' }}>XIRR {fmtPct(holdingXirr)}</span>
            : <span className="text-[9px] text-slate-400">XIRR —</span>
          }
          <span className="flex items-center gap-1 shrink-0 whitespace-nowrap">
            <span className="text-[9px] text-slate-400">Total</span>
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
          <span className="text-[9px] text-slate-400">
            Invested{' '}
            <span className="text-slate-600 font-semibold">{fmt(inv, dispCur)}</span>
            {holding && <span className="text-slate-400"> · {qty} sh · {avg}/sh</span>}
          </span>
          <span className="text-[9px] text-slate-400">
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
        {([['transactions','Txns'],['charts','Charts'],['report','Report'],['notes','Notes']] as const).map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 text-[10px] py-1 rounded-full font-medium transition-all ${
              activeTab === tab
                ? tab === 'transactions' ? 'bg-teal-100 text-teal-700 shadow-sm'
                : tab === 'charts'       ? 'bg-sky-100 text-sky-700 shadow-sm'
                : tab === 'report'       ? 'bg-violet-100 text-violet-700 shadow-sm'
                : 'bg-amber-100 text-amber-700 shadow-sm'
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
      {/* Report strip */}
      {activeTab === 'report' && (
        <div className="bg-violet-50 border border-violet-100 rounded-xl px-2.5 py-1.5 mb-2 flex items-center justify-between">
          <span className="text-[10px] text-violet-700">Quick Stats &amp; Research</span>
          <button
            className="flex items-center gap-0.5 rounded-full px-1.5 py-0.5 border active:opacity-60 bg-gradient-to-br from-violet-600 to-purple-800 border-violet-700"
            onClick={() => { if (reportSyncing) return; setReportSyncing(true); qc.invalidateQueries({ queryKey: ['quickstats', yf] }); setTimeout(() => setReportSyncing(false), 1500) }}
          >
            <span className={`text-[9px] text-white leading-none inline-block ${reportSyncing ? 'animate-spin' : ''}`}>↻</span>
          </button>
        </div>
      )}
      {/* Notes strip */}
      {activeTab === 'notes' && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl px-2.5 py-1.5 mb-2">
          <span className="text-[10px] text-amber-700">Personal notes</span>
        </div>
      )}
      {/* Charts strip — metric pills + sync */}
      {activeTab === 'charts' && (
        <div
          className="border rounded-xl px-2.5 py-1.5 mb-2"
          style={{ backgroundColor: METRIC_HEX[chartMetric].stripBg, borderColor: METRIC_HEX[chartMetric].stripBorder }}
        >
          <div className="flex items-center gap-2">
            <div
              className="flex gap-1.5 overflow-x-auto flex-1"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
            >
              {METRICS.map(m => (
                <button
                  key={m}
                  onClick={() => setChartMetric(m)}
                  className="text-[10px] whitespace-nowrap px-2.5 py-0.5 rounded-full border transition-all"
                  style={chartMetric === m
                    ? { background: METRIC_HEX[m].pillActiveBg, borderColor: METRIC_HEX[m].pillActiveBorder, color: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.15)' }
                    : { backgroundColor: METRIC_HEX[m].pillInactiveBg, borderColor: METRIC_HEX[m].pillInactiveBorder, color: METRIC_HEX[m].pillInactiveColor }
                  }
                >
                  {m}
                </button>
              ))}
            </div>
            <button
              className="flex items-center gap-0.5 shrink-0 rounded-full px-1.5 py-0.5 border active:opacity-60"
              style={{ background: `linear-gradient(135deg,${METRIC_HEX[chartMetric].syncFrom},${METRIC_HEX[chartMetric].syncTo})`, borderColor: METRIC_HEX[chartMetric].syncBorder }}
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
        </>
      )}

      {activeTab === 'notes' && (
        <AnalysisTab portfolio={decoded.portfolio} symbol={decoded.symbol} />
      )}

      {activeTab === 'report' && (
        <ReportTab
          yf_symbol={yf}
          name={co || decoded.symbol}
          qs={quickStats}
          loading={qsLoading}
        />
      )}

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
                    <div className="flex justify-between text-[9px] text-slate-400 mb-1">
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
  )
}
