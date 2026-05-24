import React, { useMemo, useState } from 'react'
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
import { aggRealized } from '../utils/realized'
import { SKIP_PORTS, USD_PORTS } from '../utils/segments'
import { computeXIRR } from '../utils/xirr'
import { fmt, fmtGainLine, fmtPct } from '../utils/fmt'
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

interface Props { currency: Currency }

export default function TransactionsPage({ currency }: Props) {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { portfolio = '', symbol = '' } = useParams<{ portfolio: string; symbol: string }>()
  const { data, isLoading, error } = usePortfolio(currency)
  const [activeTab,   setActiveTab]   = useState<'transactions' | 'charts'>('transactions')
  const [chartMetric, setChartMetric] = useState<ChartMetric>('Price')
  const [chartRange,  setChartRange]  = useState<ChartRange>('1y')

  const decoded = {
    portfolio: decodeURIComponent(portfolio),
    symbol:    decodeURIComponent(symbol),
  }

  const realizedMap = useMemo(
    () => (data ? aggRealized(data.realized, data.usd_inr) : new Map()),
    [data],
  )

  const holding = useMemo(() => {
    if (!data) return null
    const rows = data.holdings.filter(
      h => h.portfolio === decoded.portfolio && h.symbol === decoded.symbol,
    )
    return rows[0] ?? null
  }, [data, decoded.portfolio, decoded.symbol])

  const symTxns = useMemo(() => {
    if (!data) return []
    return data.transactions
      .filter(t =>
        t.symbol    === decoded.symbol &&
        t.portfolio === decoded.portfolio &&
        (t.type === 'BUY' || t.type === 'SELL') &&
        !SKIP_PORTS.has(t.portfolio),
      )
      .sort((a, b) => b.date.localeCompare(a.date))  // newest first
  }, [data, decoded.portfolio, decoded.symbol])

  const holdingArr = useMemo(() => (holding ? [holding] : []), [holding])

  const symRealized = useMemo(() => {
    if (!data) return []
    return data.realized.filter(
      r => r.portfolio === decoded.portfolio && r.symbol === decoded.symbol,
    )
  }, [data, decoded.portfolio, decoded.symbol])

  const holdingXirr = useMemo(() => {
    if (!symTxns.length || !holding || !data) return null
    const today = new Date()
    const isUsd = USD_PORTS.has(decoded.portfolio)
    const fx = isUsd ? (currency === 'INR' ? data.usd_inr : 1) : (currency === 'USD' ? 1 / data.usd_inr : 1)
    const cfs: { date: Date; amount: number }[] = []
    for (const tx of symTxns) {
      const amt = tx.quantity * tx.price * fx
      const chg = (tx.charges ?? 0) * fx
      if (tx.type === 'BUY')  cfs.push({ date: new Date(tx.date), amount: -(amt + chg) })
      if (tx.type === 'SELL') cfs.push({ date: new Date(tx.date), amount:   amt - chg })
    }
    if (holding.disp_current > 0) cfs.push({ date: today, amount: holding.disp_current })
    const r = computeXIRR(cfs)
    return r !== null ? r * 100 : null
  }, [symTxns, holding, data, decoded.portfolio, currency])

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

    return symTxns.map(tx => {
      if (tx.type === 'SELL') {
        const s = sellMap.get(tx.date.slice(0, 10))
        if (!s) return null
        return { status: 'realized' as const, gain: s.gain, pct: s.cost !== 0 ? (s.gain / s.cost) * 100 : 0 }
      }

      // BUY — held / sold / partial
      if (!holding) return null
      const b            = buyMap.get(tx.date.slice(0, 10)) ?? { qtyRealized: 0, realGain: 0, realCost: 0 }
      const qtyRemaining = tx.quantity - b.qtyRealized
      const unrealGain   = (holding.current_price - tx.price) * Math.max(0, qtyRemaining) * fx
      const unrealPct    = tx.price !== 0 ? ((holding.current_price - tx.price) / tx.price) * 100 : 0

      if (b.qtyRealized <= 1e-9)
        return { status: 'held' as const, gain: unrealGain, pct: unrealPct }
      if (qtyRemaining <= 1e-9)
        return { status: 'sold' as const, gain: b.realGain, pct: b.realCost !== 0 ? (b.realGain / b.realCost) * 100 : 0 }
      return {
        status:    'partial' as const,
        realGain:  b.realGain,  realPct:  b.realCost !== 0 ? (b.realGain / b.realCost) * 100 : 0, realQty:  b.qtyRealized,
        unrealGain, unrealPct, unrealQty: qtyRemaining,
      }
    })
  }, [symTxns, symRealized, holding, data, decoded.portfolio])

  const { series: portSeries, isLoading: histLoading } = usePortfolioHistory(
    holdingArr,
    symTxns,
    symRealized,
    data?.usd_inr ?? 95.5,
    currency,
    activeTab === 'charts' && chartMetric !== 'Price' && !!data,
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
      t: d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
      v: metricSeries.values[i],
    })) ?? [],
    [metricSeries],
  )

  if (isLoading) return <LoadingSkeleton />
  if (error || !data) return <ErrorState message={(error as Error)?.message ?? 'Unknown error'} />

  const isUsd   = USD_PORTS.has(decoded.portfolio)
  const dispCur = currency
  const [realGain, realCost] = realizedMap.get(`${decoded.portfolio}:${decoded.symbol}`) ?? [0, 0]
  const realColor  = realGain >= 0 ? '#0a7a42' : '#be1c1c'
  const fromLabel  = (location.state as { from?: string } | null)?.from ?? decoded.portfolio
  const backLabel  = `← ${fromLabel} Holdings`

  // Symbol overview card values
  const cur     = holding ? holding.disp_current  : 0
  const inv     = holding ? holding.disp_invested : 0
  const gain    = cur - inv
  const pct     = inv !== 0 ? (gain / inv) * 100 : 0
  const gainPos = gain >= 0
  const border  = gainPos ? '#10b981' : '#f43f5e'
  const bg      = gainPos ? '#f0fdf8' : '#fff5f5'
  const tc      = gainPos ? '#0a7a42' : '#be1c1c'

  const tg    = holding?.disp_today_gain ?? null
  const tp    = holding?.today_pct ?? null
  const tgC   = tg !== null ? (tg >= 0 ? '#0a7a42' : '#be1c1c') : '#94a3b8'

  const ltp   = holding?.current_price?.toFixed(2) ?? '—'
  const qty   = holding ? holding.quantity.toFixed(3) : '—'
  const avg   = holding ? holding.avg_cost.toFixed(2) : '—'
  const co    = holding?.company ?? ''
  const yf    = holding?.yf_symbol ?? decoded.symbol

  const isPct       = PCT_METRICS.has(chartMetric)
  const chartLast   = metricSeries?.values[metricSeries.values.length - 1] ?? null
  const chartFirst  = metricSeries?.values[0] ?? null
  const chartChange = chartLast !== null && chartFirst !== null ? chartLast - chartFirst : null
  const lineColor   = (chartLast ?? 0) >= 0 ? '#10b981' : '#f43f5e'
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
        className="rounded-[10px] border px-3 py-2.5 mb-3"
        style={{ background: bg, borderColor: '#e2e8f0', borderLeftWidth: 4, borderLeftColor: border }}
      >
        {/* Label row */}
        <div className="flex justify-between items-center mb-1">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider truncate max-w-[75%]">
            {co || decoded.symbol}
          </span>
          <span className="text-[9px] text-slate-400 shrink-0">
            LTP <span className="text-slate-600 font-semibold">{ltp}</span>
          </span>
        </div>

        {/* Current value + today gain */}
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-[20px] font-bold text-slate-900 tracking-tight">
            {holding ? fmt(cur, dispCur) : '—'}
          </span>
          <span className="text-[10px]" style={{ color: tgC }}>
            {tg !== null
              ? `${tg >= 0 ? '+' : '−'}${fmt(Math.abs(tg), dispCur)}${tp !== null ? ` (${fmtPct(tp)})` : ''}`
              : 'N/A'}
          </span>
        </div>

        {/* XIRR | Total G/L */}
        <div className="flex items-baseline justify-between mb-2">
          {holdingXirr !== null
            ? <span className="text-[9px] font-semibold" style={{ color: holdingXirr >= 0 ? '#0a7a42' : '#be1c1c' }}>XIRR {fmtPct(holdingXirr)}</span>
            : <span className="text-[9px] text-slate-400">XIRR —</span>
          }
          <span className="text-[10px] font-bold" style={{ color: tc }}>
            {fmtGainLine(gain + realGain, inv + realCost !== 0 ? (gain + realGain) / (inv + realCost) * 100 : 0, dispCur)}
          </span>
        </div>

        {/* Footer: Invested · qty · avg | Realized */}
        <div
          className="flex justify-between pt-1.5"
          style={{ borderTop: '1px solid #e2e8f0' }}
        >
          <span className="text-[9px] text-slate-400">
            Invested{' '}
            <span className="text-slate-600 font-semibold">{holding ? fmt(inv, dispCur) : '—'}</span>
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

      {/* Tabs */}
      <div className="flex gap-3 mb-3 border-b border-slate-200">
        {(['transactions', 'charts'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`text-[11px] pb-1.5 capitalize font-medium transition-colors ${
              activeTab === tab
                ? 'text-[#2563eb] border-b-2 border-[#2563eb]'
                : 'text-slate-400'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'transactions' && (
        <>
          {symTxns.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-6">No transactions found</p>
          ) : (
            <>
              <p className="text-[9px] text-slate-400 mb-2">{symTxns.length} transactions</p>
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

          {/* Price chart */}
          {chartMetric === 'Price' && (
            <PriceChart
              transactions={symTxns}
              yf_symbol={yf}
              currency={dispCur}
              usdInr={data.usd_inr}
            />
          )}

          {/* Historical series charts */}
          {chartMetric !== 'Price' && (
            <>
              {histLoading && (
                <div className="text-center py-10 text-slate-400 text-xs">
                  Loading price history…
                </div>
              )}

              {!histLoading && portSeries && !metricSeries && (
                <div className="text-center py-10 text-slate-400 text-xs">
                  No data for this period.
                </div>
              )}

              {!histLoading && !portSeries && (
                <div className="text-center py-10 text-slate-400 text-xs">
                  No price history available.
                </div>
              )}

              {!histLoading && metricSeries && rechartsData.length > 0 && (
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
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
