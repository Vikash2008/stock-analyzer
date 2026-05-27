// Price history line + BUY/SELL bubble markers.
// Mirrors charts.py using Recharts ComposedChart.

import { useMemo, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { useHistory } from '../hooks/useHistory'
import type { Transaction } from '../api/types'
import type { Currency } from '../App'
import { fmt } from '../utils/fmt'

interface PriceChartProps {
  transactions: Transaction[]
  yf_symbol:    string
  currency:     Currency
  usdInr:       number
}

interface ChartPoint {
  date:   string
  price:  number
  buy?:   number
  sell?:  number
}

const RANGES = ['1d', '1m', '3m', '6m', '1y', '2y', '3y', '5y', 'All'] as const
type ChartRange = typeof RANGES[number]

const RANGE_DAYS: Record<string, number> = {
  '1m': 30, '3m': 90, '6m': 182, '1y': 365, '2y': 730, '3y': 1095, '5y': 1825,
}

// Find first transaction date, used as the history start
function firstTxDate(txns: Transaction[]): string | null {
  if (!txns.length) return null
  const sorted = [...txns].sort((a, b) => a.date.localeCompare(b.date))
  return sorted[0].date.slice(0, 10)
}

// Snap transaction date to nearest available trading date in the series
function snapToSeries(dates: string[], txDate: string): string | null {
  if (dates.includes(txDate)) return txDate
  const target = new Date(txDate).getTime()
  let best: string | null = null
  let bestDiff = Infinity
  for (const d of dates) {
    const diff = Math.abs(new Date(d).getTime() - target)
    if (diff < bestDiff) { bestDiff = diff; best = d }
  }
  return bestDiff < 4 * 86400_000 ? best : null  // within 4 calendar days
}

function buildChartData(
  dates: string[], prices: number[], txns: Transaction[]
): ChartPoint[] {
  const data: ChartPoint[] = dates.map((d, i) => ({ date: d, price: prices[i] }))
  const indexMap = new Map(dates.map((d, i) => [d, i]))

  for (const t of txns) {
    if (t.type !== 'BUY' && t.type !== 'SELL') continue
    const snapped = snapToSeries(dates, t.date.slice(0, 10))
    if (!snapped) continue
    const idx = indexMap.get(snapped)!
    const pt  = data[idx]
    if (t.type === 'BUY')  pt.buy  = pt.price
    if (t.type === 'SELL') pt.sell = pt.price
  }
  return data
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label, currency }: any) {
  if (!active || !payload?.length) return null
  const p = payload[0]?.value
  return (
    <div className="bg-[#1e293b] text-[#f8fafc] text-[10px] px-2 py-1.5 rounded shadow-lg">
      <p className="text-slate-400 mb-0.5">{label}</p>
      {p !== undefined && <p className="font-semibold">{fmt(p, currency)}</p>}
    </div>
  )
}

// Custom dot: renders a colored circle only for BUY/SELL points
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function BuyDot(props: any) {
  const { cx, cy } = props
  if (cx == null || cy == null) return <g />
  return <circle cx={cx} cy={cy} r={5} fill="#10b981" stroke="#fff" strokeWidth={1.5} />
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SellDot(props: any) {
  const { cx, cy } = props
  if (cx == null || cy == null) return <g />
  return <circle cx={cx} cy={cy} r={5} fill="#f43f5e" stroke="#fff" strokeWidth={1.5} />
}

export function PriceChart({ transactions, yf_symbol, currency, usdInr }: PriceChartProps) {
  const [range, setRange] = useState<ChartRange>('All')
  const start = useMemo(() => firstTxDate(transactions), [transactions])
  const { data: history, isLoading: dailyLoading }      = useHistory(yf_symbol, start)
  const { data: intradayHistory, isLoading: intLoading } = useHistory(yf_symbol, null, '1d')

  const allChartData = useMemo(() => {
    if (!history?.dates.length) return []
    return buildChartData(history.dates, history.prices, transactions)
  }, [history, transactions])

  const intradayChartData = useMemo(() => {
    if (!intradayHistory?.dates.length) return []
    return intradayHistory.dates.map((d, i) => ({ date: d, price: intradayHistory.prices[i] }))
  }, [intradayHistory])

  const chartData = useMemo(() => {
    if (range === '1d') return intradayChartData
    if (!allChartData.length || range === 'All') return allChartData
    const cutoff = new Date(Date.now() - RANGE_DAYS[range] * 86_400_000).toISOString().slice(0, 10)
    return allChartData.filter(p => p.date >= cutoff)
  }, [allChartData, intradayChartData, range])

  const isLoading = range === '1d' ? intLoading : dailyLoading

  const yFmt = (v: number) => {
    if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}K`
    return v.toFixed(0)
  }

  if (isLoading) {
    return (
      <div className="h-48 flex items-center justify-center">
        <div className="text-slate-400 text-xs animate-pulse">Loading chart…</div>
      </div>
    )
  }

  if (!chartData.length) {
    return (
      <div className="h-36 flex items-center justify-center">
        <p className="text-slate-400 text-xs">No price history available</p>
      </div>
    )
  }

  const firstPrice = chartData[0]?.price ?? null
  const lastPrice  = chartData[chartData.length - 1]?.price ?? null
  const pctChange  = firstPrice && lastPrice ? (lastPrice - firstPrice) / firstPrice * 100 : null
  const priceColor = pctChange !== null ? (pctChange >= 0 ? '#0a7a42' : '#be1c1c') : '#94a3b8'

  return (
    <div className="mt-2">
      {lastPrice !== null && (
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-[15px] font-bold" style={{ color: priceColor }}>
            {fmt(lastPrice, currency)}
          </span>
          {pctChange !== null && (
            <span className="text-[10px]" style={{ color: priceColor }}>
              {pctChange >= 0 ? '+' : ''}{pctChange.toFixed(2)}% in period
            </span>
          )}
        </div>
      )}
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={chartData} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 8, fill: '#94a3b8' }}
            tickFormatter={d => {
              if (range === '1d') return d  // already "HH:MM"
              const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
              const [yr, mo, day] = d.split('-')
              if (['1m', '3m', '6m', '1y'].includes(range))
                return `${parseInt(day, 10)} ${MONTHS[parseInt(mo, 10) - 1]}`
              return `${MONTHS[parseInt(mo, 10) - 1]} '${yr.slice(2)}`
            }}
            minTickGap={40}
          />
          <YAxis
            tick={{ fontSize: 8, fill: '#94a3b8' }}
            tickFormatter={yFmt}
            width={42}
            domain={['auto', 'auto']}
          />
          <Tooltip content={<CustomTooltip currency={currency} usdInr={usdInr} />} />

          {/* Price line — no dots */}
          <Line
            dataKey="price"
            stroke="#3b82f6"
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3 }}
            name="Price"
          />

          {/* BUY markers — invisible line, colored dots only where defined */}
          <Line
            dataKey="buy"
            stroke="none"
            strokeWidth={0}
            dot={<BuyDot />}
            activeDot={false}
            connectNulls={false}
            name="BUY"
            legendType="circle"
          />

          {/* SELL markers */}
          <Line
            dataKey="sell"
            stroke="none"
            strokeWidth={0}
            dot={<SellDot />}
            activeDot={false}
            connectNulls={false}
            name="SELL"
            legendType="circle"
          />

          <Legend
            wrapperStyle={{ fontSize: 9, paddingTop: 4 }}
            formatter={(v, entry) => (
              <span style={{ color: v === 'BUY' ? '#10b981' : v === 'SELL' ? '#f43f5e' : '#3b82f6', fontSize: 9 }}>
                {v}
              </span>
            )}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Range selector */}
      <div className="flex bg-slate-100 rounded-lg p-0.5 mt-3">
        {RANGES.map(r => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`flex-1 text-[10px] py-1 rounded-md font-medium transition-all ${
              range === r
                ? 'bg-white text-[#2563eb] shadow-sm'
                : 'text-slate-400'
            }`}
          >
            {r}
          </button>
        ))}
      </div>
    </div>
  )
}
