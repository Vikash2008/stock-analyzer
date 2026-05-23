import React, { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { usePortfolio } from '../hooks/usePortfolio'
import { usePortfolioHistory, sliceSeries } from '../hooks/usePortfolioHistory'
import type { DatedSeries, PortfolioSeries } from '../hooks/usePortfolioHistory'
import { HoldingCard } from '../components/HoldingCard'
import { SummaryCard } from '../components/SummaryCard'
import { LoadingSkeleton, ErrorState } from '../components/LoadingSkeleton'
import { aggRealized, realizedForPorts } from '../utils/realized'
import { filterBySegment, SKIP_PORTS, SEGMENT_LABELS, USD_PORTS } from '../utils/segments'
import { fmt, fmtGainLine } from '../utils/fmt'
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
  key:       string
  ticker:    string
  subLabel:  string
  current:   number
  invested:  number
  realGain:  number
  realCost:  number
  todayGain: number | null
  todayPct:  number | null
  ltp:       number | null
  navPort:   string
  navSym:    string
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
          key:      `${h.portfolio}:${h.symbol}`,
          ticker:   h.symbol,
          subLabel: mode === 'standalone' ? h.portfolio : (h.company ?? ''),
          current:  h.disp_current,
          invested: h.disp_invested,
          realGain: rg, realCost: rc,
          todayGain: h.disp_today_gain,
          todayPct:  h.today_pct,
          ltp:      h.current_price,
          navPort:  h.portfolio,
          navSym:   h.symbol,
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
        key:      h.symbol,
        ticker:   h.symbol,
        subLabel: h.company ?? '',
        current:  h.disp_current,
        invested: h.disp_invested,
        realGain: rg, realCost: rc,
        todayGain: h.disp_today_gain,
        todayPct:  null,
        ltp:      h.current_price,
        navPort:  h.portfolio,
        navSym:   h.symbol,
      })
    } else {
      existing.current   += h.disp_current
      existing.invested  += h.disp_invested
      existing.realGain  += rg
      existing.realCost  += rc
      if (h.disp_today_gain !== null) {
        existing.todayGain = (existing.todayGain ?? 0) + h.disp_today_gain
      }
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
  const { portfolio, segment } = useParams<{ portfolio?: string; segment?: string }>()
  const { data, isLoading, error } = usePortfolio(currency)
  const [viewMode,    setViewMode]    = useState<'cumulative' | 'standalone'>('cumulative')
  const [activeTab,   setActiveTab]   = useState<'holdings' | 'charts'>('holdings')
  const [chartMetric, setChartMetric] = useState<ChartMetric>('Portfolio Value')
  const [chartRange,  setChartRange]  = useState<ChartRange>('1y')
  const [sortField,   setSortField]   = useState<SortField>('current')
  const [sortDir,     setSortDir]     = useState<'desc' | 'asc'>('desc')
  const [sortOpen,    setSortOpen]    = useState(false)

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

  const summaryStats = useMemo(() => {
    const cur  = filteredHoldings.reduce((s, h) => s + h.disp_current,  0)
    const inv  = filteredHoldings.reduce((s, h) => s + h.disp_invested, 0)
    const tg   = filteredHoldings
      .filter(h => h.disp_today_gain !== null)
      .reduce((s, h) => s + (h.disp_today_gain ?? 0), 0)
    const prior = cur - tg
    const ports = new Set(filteredHoldings.map(h => h.portfolio))
    const [rg, rc] = realizedForPorts(realizedMap, ports)
    return {
      cur, inv, tg,
      todayPct: prior !== 0 ? (tg / prior) * 100 : null,
      realGain: rg, realCost: rc,
    }
  }, [filteredHoldings, realizedMap])

  const rows = useMemo(
    () => buildRows(filteredHoldings, realizedMap, viewMode, !!segment),
    [filteredHoldings, realizedMap, viewMode, segment],
  )

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

  const xirrMap = useMemo(() => {
    if (!data) return new Map<string, number | null>()
    const today = new Date()
    const map   = new Map<string, number | null>()
    const isCumulative = !!segment && viewMode === 'cumulative'

    for (const row of rows) {
      const txns = data.transactions.filter(t =>
        isCumulative
          ? t.symbol === row.navSym && filtPorts.has(t.portfolio)
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
  }, [rows, data, currency, filtPorts, segment, viewMode])

  const sortedRows = useMemo(() => [...rows].sort((a, b) => {
    const va = getSortValue(a, sortField, xirrMap)
    const vb = getSortValue(b, sortField, xirrMap)
    if (va === -Infinity && vb === -Infinity) return 0
    if (va === -Infinity) return 1
    if (vb === -Infinity) return -1
    return sortDir === 'desc' ? vb - va : va - vb
  }), [rows, sortField, sortDir, xirrMap])

  const { series: portSeries, isLoading: histLoading } = usePortfolioHistory(
    filteredHoldings,
    filtTxns,
    filtRealized,
    data?.usd_inr ?? 95.5,
    currency,
    activeTab === 'charts' && !!data,
  )

  const metricSeries = useMemo((): DatedSeries | null => {
    if (!portSeries) return null
    const key = METRIC_SERIES_KEY[chartMetric]
    const raw = portSeries[key] as DatedSeries
    return sliceSeries(raw, chartRange)
  }, [portSeries, chartMetric, chartRange])

  const rechartsData = useMemo(
    () => metricSeries?.dates.map((d, i) => ({
      t: d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
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

  const isUsd      = portfolio ? USD_PORTS.has(portfolio) : false
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
      {/* Back */}
      <button onClick={() => navigate('/')} className="text-[11px] text-[#2563eb] mb-3">
        {backLabel}
      </button>

      {/* Summary card */}
      <SummaryCard
        label={label}
        current={summaryStats.cur}
        invested={summaryStats.inv}
        realGain={summaryStats.realGain}
        realCost={summaryStats.realCost}
        todayGain={summaryStats.tg || null}
        todayPct={summaryStats.todayPct}
        currency={currency}
      />

      {/* Tabs */}
      <div className="flex gap-3 mb-3 border-b border-slate-200">
        {(['holdings', 'charts'] as const).map(tab => (
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

      {/* ── Holdings tab ── */}
      {activeTab === 'holdings' && (
        <>
          {segment && (
            <div className="flex gap-2 mb-3">
              {(['cumulative', 'standalone'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setViewMode(m)}
                  className={`text-[10px] px-3 py-0.5 rounded-full border transition-colors capitalize ${
                    viewMode === m
                      ? 'bg-[#2563eb] text-white border-[#2563eb]'
                      : 'bg-white text-slate-500 border-slate-200'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          )}

          {/* Count + sort */}
          <div className="flex items-center justify-between mb-2">
            <p className="text-[9px] text-slate-400">{rows.length} holdings</p>
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
                currency={isUsd ? 'USD' : currency}
                onClick={() => navigate(`/transactions/${encodeURIComponent(r.navPort)}/${encodeURIComponent(r.navSym)}`, { state: { from: label } })}
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
    </div>
  )
}
