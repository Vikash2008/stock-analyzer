// Summary page — key metrics + holdings performance bar chart.
// Historical portfolio-value series (requires extra backend endpoint) deferred to Phase 4.

import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { usePortfolio } from '../hooks/usePortfolio'
import { LoadingSkeleton, ErrorState } from '../components/LoadingSkeleton'
import { aggRealized, realizedForPorts } from '../utils/realized'
import { filterBySegment, SKIP_PORTS, SEGMENT_LABELS, USD_PORTS } from '../utils/segments'
import { fmt, fmtGainLine, fmtPct } from '../utils/fmt'
import type { Holding } from '../api/types'
import type { Currency } from '../App'

interface Props { currency: Currency }

type Metric = 'value' | 'gain' | 'return'

const METRIC_LABELS: Record<Metric, string> = {
  value:  'Value',
  gain:   'P&L',
  return: 'Return %',
}

function metricValue(h: Holding, metric: Metric, realGain: number, realCost: number): number {
  const totalGain = (h.disp_current - h.disp_invested) + realGain
  const totalCost = h.disp_invested + realCost
  if (metric === 'value')  return h.disp_current
  if (metric === 'gain')   return totalGain
  if (metric === 'return') return totalCost !== 0 ? (totalGain / totalCost) * 100 : 0
  return 0
}

export default function SummaryPage({ currency }: Props) {
  const navigate  = useNavigate()
  const { portfolio, segment } = useParams<{ portfolio?: string; segment?: string }>()
  const { data, isLoading, error } = usePortfolio(currency)
  const [metric, setMetric] = useState<Metric>('value')

  const realizedMap = useMemo(
    () => (data ? aggRealized(data.realized, data.usd_inr) : new Map()),
    [data],
  )

  const holdings = useMemo(() => {
    if (!data) return []
    let h = data.holdings.filter(r => !SKIP_PORTS.has(r.portfolio))
    if (portfolio) h = h.filter(r => r.portfolio === portfolio)
    else if (segment) h = filterBySegment(h, segment)
    return h
  }, [data, portfolio, segment])

  const totals = useMemo(() => {
    const cur = holdings.reduce((s, h) => s + h.disp_current,  0)
    const inv = holdings.reduce((s, h) => s + h.disp_invested, 0)
    const ports = new Set(holdings.map(h => h.portfolio))
    const [rg, rc] = realizedForPorts(realizedMap, ports)
    const totalGain = (cur - inv) + rg
    const totalCost = inv + rc
    return {
      cur, inv, rg, rc,
      totalGain,
      returnPct: totalCost !== 0 ? (totalGain / totalCost) * 100 : 0,
    }
  }, [holdings, realizedMap])

  // Top 12 holdings by current value for the bar chart
  const barData = useMemo(() => {
    return [...holdings]
      .map(h => {
        const [rg, rc] = realizedMap.get(`${h.portfolio}:${h.symbol}`) ?? [0, 0]
        const val = metricValue(h, metric, rg, rc)
        return { name: h.symbol, value: val, gain: val >= 0 }
      })
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
      .slice(0, 12)
  }, [holdings, realizedMap, metric])

  if (isLoading) return <LoadingSkeleton />
  if (error || !data) return <ErrorState message={(error as Error)?.message ?? 'Unknown error'} />

  const label     = portfolio ?? SEGMENT_LABELS[segment ?? ''] ?? 'Summary'
  const backLabel = portfolio ? `← ${portfolio} Holdings` : '← Holdings'
  const gainPos   = totals.totalGain >= 0
  const tc        = gainPos ? '#0a7a42' : '#be1c1c'

  const yFmt = (v: number) => {
    if (metric === 'return') return `${v.toFixed(0)}%`
    if (Math.abs(v) >= 1e7)  return `${(v / 1e7).toFixed(1)}Cr`
    if (Math.abs(v) >= 1e5)  return `${(v / 1e5).toFixed(1)}L`
    return v.toFixed(0)
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-4">
      {/* Back */}
      <button onClick={() => navigate(-1)} className="text-[11px] text-[#2563eb] mb-3">
        {backLabel}
      </button>

      <p className="text-[11px] font-semibold text-slate-700 mb-3">{label}</p>

      {/* Key metrics grid */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {[
          { lbl: 'Current Value', val: fmt(totals.cur, currency) },
          { lbl: 'Invested',      val: fmt(totals.inv, currency) },
          { lbl: 'Total P&L',     val: fmtGainLine(totals.totalGain, totals.returnPct, currency), color: tc },
          { lbl: 'Realized',      val: fmtGainLine(totals.rg, null, currency), color: totals.rg >= 0 ? '#0a7a42' : '#be1c1c' },
        ].map(({ lbl, val, color }) => (
          <div key={lbl} className="bg-white border border-[#e2e8f0] rounded-[10px] px-3 py-2.5">
            <p className="text-[9px] text-slate-400 uppercase tracking-wider mb-1">{lbl}</p>
            <p className="text-[14px] font-bold" style={{ color: color ?? '#0f172a' }}>{val}</p>
          </div>
        ))}
      </div>

      {/* Metric selector */}
      <div className="flex gap-2 mb-3">
        {(Object.keys(METRIC_LABELS) as Metric[]).map(m => (
          <button
            key={m}
            onClick={() => setMetric(m)}
            className={`text-[10px] px-3 py-0.5 rounded-full border transition-colors ${
              metric === m
                ? 'bg-[#2563eb] text-white border-[#2563eb]'
                : 'bg-white text-slate-500 border-slate-200'
            }`}
          >
            {METRIC_LABELS[m]}
          </button>
        ))}
      </div>

      {/* Bar chart — top holdings by selected metric */}
      <p className="text-[9px] text-slate-400 mb-1">
        Top holdings by {METRIC_LABELS[metric].toLowerCase()}
      </p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart
          data={barData}
          layout="vertical"
          margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 8, fill: '#94a3b8' }}
            tickFormatter={yFmt}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 8, fill: '#334155' }}
            width={52}
          />
          <Tooltip
            formatter={(v: number) =>
              metric === 'return'
                ? [`${v >= 0 ? '+' : ''}${v.toFixed(2)}%`, METRIC_LABELS[metric]]
                : [fmtGainLine(v, null, currency), METRIC_LABELS[metric]]
            }
            contentStyle={{ fontSize: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}
          />
          <Bar dataKey="value" radius={[0, 3, 3, 0]}>
            {barData.map((entry, i) => (
              <Cell
                key={`cell-${i}`}
                fill={entry.gain ? '#10b981' : '#f43f5e'}
                opacity={0.85}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Holdings count */}
      <p className="text-[9px] text-slate-300 text-center mt-2">{holdings.length} holdings total</p>
    </div>
  )
}
