// Phase 2 — proves the full data pipeline: API → hook → component.
// Hero card shows real numbers. Full breakdown implemented in Phase 3.

import { useNavigate } from 'react-router-dom'
import { usePortfolio, useForceRefresh } from '../hooks/usePortfolio'
import { LoadingSkeleton, ErrorState } from '../components/LoadingSkeleton'
import { fmt, fmtGainLine, fmtPct } from '../utils/fmt'
import type { Currency } from '../App'
import type { Holding } from '../api/types'

interface Props {
  currency: Currency
  onCurrencyChange: (c: Currency) => void
}

// Group holdings by portfolio → sum disp_current, disp_invested, disp_today_gain
function groupByPortfolio(holdings: Holding[]) {
  const map = new Map<string, { current: number; invested: number; todayGain: number | null }>()
  for (const h of holdings) {
    const prev = map.get(h.portfolio) ?? { current: 0, invested: 0, todayGain: null }
    map.set(h.portfolio, {
      current:   prev.current   + h.disp_current,
      invested:  prev.invested  + h.disp_invested,
      todayGain: h.disp_today_gain !== null
        ? (prev.todayGain ?? 0) + h.disp_today_gain
        : prev.todayGain,
    })
  }
  return [...map.entries()]
    .map(([name, v]) => ({ name, ...v, gain: v.current - v.invested }))
    .sort((a, b) => b.current - a.current)
}

function isGain(v: number) { return v >= 0 }

export default function PortfoliosPage({ currency, onCurrencyChange }: Props) {
  const navigate  = useNavigate()
  const { data, isLoading, error } = usePortfolio(currency)
  const forceRefresh = useForceRefresh(currency)

  if (isLoading) return <LoadingSkeleton />
  if (error || !data) return <ErrorState message={(error as Error)?.message ?? 'Unknown error'} />

  const { total_current, total_invested, total_gain, return_pct, as_of } = data
  const gain   = isGain(total_gain)
  const portfolios = groupByPortfolio(data.holdings)

  const todayGainTotal = data.holdings
    .filter(h => h.disp_today_gain !== null)
    .reduce((s, h) => s + (h.disp_today_gain ?? 0), 0)
  const todayPrior = total_current - todayGainTotal
  const todayPct   = todayPrior !== 0 ? (todayGainTotal / todayPrior) * 100 : 0

  const borderColor = gain ? '#10b981' : '#f43f5e'
  const bgColor     = gain ? '#f0fdf8' : '#fff5f5'
  const textColor   = gain ? '#0a7a42' : '#be1c1c'

  return (
    <div className="max-w-xl mx-auto px-4 py-4 space-y-3">

      {/* Header row */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-slate-400 uppercase tracking-widest">
          as of {new Date(as_of).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
        </span>
        <div className="flex items-center gap-2">
          {/* Currency toggle */}
          {(['INR', 'USD'] as Currency[]).map(c => (
            <button
              key={c}
              onClick={() => onCurrencyChange(c)}
              className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                currency === c
                  ? 'bg-[#2563eb] text-white border-[#2563eb]'
                  : 'bg-white text-slate-500 border-slate-200'
              }`}
            >
              {c}
            </button>
          ))}
          {/* Refresh */}
          <button
            onClick={() => forceRefresh()}
            className="text-[11px] text-slate-400 hover:text-slate-600 px-1"
            title="Force refresh prices"
          >
            ↻
          </button>
        </div>
      </div>

      {/* Hero card — Total Portfolio */}
      <div
        className="rounded-[10px] p-3 border cursor-pointer active:opacity-80 transition-opacity"
        style={{ background: bgColor, borderColor: '#e2e8f0', borderLeftWidth: 4, borderLeftColor: borderColor }}
        onClick={() => navigate('/holdings/segment/total')}
      >
        <p className="text-[9px] text-slate-400 uppercase tracking-widest mb-1">Total Portfolio</p>
        <div className="flex items-baseline justify-between">
          <span className="text-[22px] font-bold text-slate-900">
            {fmt(total_current, currency)}
          </span>
          <span className="text-[12px]" style={{ color: textColor }}>
            {todayGainTotal !== 0
              ? (todayGainTotal >= 0 ? '+' : '') + fmt(todayGainTotal, currency)
              : 'N/A'
            }
          </span>
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <span className="text-[11px] font-medium" style={{ color: textColor }}>
            {fmtGainLine(total_gain, return_pct, currency)}
          </span>
          <span className="text-[9px] text-slate-400">
            Invested {fmt(total_invested, currency)}
          </span>
        </div>
      </div>

      {/* Per-portfolio cards */}
      <p className="text-[9px] text-slate-400 uppercase tracking-widest px-0.5">Portfolios</p>

      {portfolios.map(p => {
        const g  = isGain(p.gain)
        const bc = g ? '#10b981' : '#f43f5e'
        const bg = g ? '#f0fdf8' : '#fff5f5'
        const tc = g ? '#0a7a42' : '#be1c1c'
        const pct = p.invested !== 0 ? (p.gain / p.invested) * 100 : 0

        return (
          <div
            key={p.name}
            className="rounded-[10px] p-3 border cursor-pointer active:opacity-80 transition-opacity"
            style={{ background: bg, borderColor: '#e2e8f0', borderLeftWidth: 4, borderLeftColor: bc }}
            onClick={() => navigate(`/holdings/portfolio/${encodeURIComponent(p.name)}`)}
          >
            <p className="text-[9px] text-slate-400 uppercase tracking-widest mb-1">{p.name}</p>
            <div className="flex items-baseline justify-between">
              <span className="text-[15px] font-bold text-slate-900">
                {fmt(p.current, currency)}
              </span>
              <span className="text-[11px]" style={{ color: tc }}>
                {p.todayGain !== null
                  ? (p.todayGain >= 0 ? '+' : '') + fmt(p.todayGain, currency)
                  : 'N/A'
                }
              </span>
            </div>
            <div className="flex items-center justify-between mt-0.5">
              <span className="text-[11px]" style={{ color: tc }}>
                {fmtGainLine(p.gain, pct, currency)}
              </span>
              <span className="text-[9px] text-slate-400">
                {fmt(p.invested, currency)} invested
              </span>
            </div>
          </div>
        )
      })}

      {/* Data freshness */}
      <p className="text-[9px] text-slate-300 text-center pb-2">
        {data.cache_status.split('\n').find(l => l.includes('prices'))?.trim()}
      </p>
    </div>
  )
}
