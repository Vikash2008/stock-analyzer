// Top-of-page summary card — shown on HoldingsPage and TransactionsPage.
// Mirrors _summary_card() in holdings_page.py.

import { fmt, fmtCompactGainLine, fmtPct } from '../utils/fmt'
import type { Currency } from '../App'

interface SummaryCardProps {
  label:       string
  current:     number
  invested:    number
  realGain:    number
  realCost:    number
  todayGain:   number | null
  todayPct:    number | null
  currency:    Currency
  footer?:     React.ReactNode  // optional custom footer (used on TransactionsPage)
}

export function SummaryCard({
  label, current, invested, realGain, realCost,
  todayGain, todayPct, currency, footer,
}: SummaryCardProps) {
  const totalGain = (current - invested) + realGain
  const totalCost = invested + realCost
  const totalPct  = totalCost !== 0 ? (totalGain / totalCost) * 100 : 0
  const gain      = totalGain >= 0

  const borderColor = gain ? '#10b981' : '#f43f5e'
  const bgColor     = gain ? '#f0fdf8' : '#fff5f5'
  const textColor   = gain ? '#0a7a42' : '#be1c1c'
  const realColor   = realGain >= 0 ? '#0a7a42' : '#be1c1c'

  const tgColor = todayGain !== null
    ? (todayGain >= 0 ? '#0a7a42' : '#be1c1c')
    : '#94a3b8'

  return (
    <div
      className="rounded-[10px] border px-3 py-2.5 mb-3"
      style={{ background: bgColor, borderColor: '#e2e8f0', borderLeftWidth: 4, borderLeftColor: borderColor }}
    >
      {/* Label */}
      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">{label}</p>

      {/* Value + today gain */}
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[20px] font-bold text-slate-900 tracking-tight min-w-0">
          {fmt(current, currency)}
        </span>
        <span className="flex items-center gap-1 shrink-0 whitespace-nowrap">
          <span className="text-[9px] text-slate-400">Today</span>
          <span className="text-[10px]" style={{ color: tgColor }}>
            {todayGain !== null ? fmtCompactGainLine(todayGain, todayPct, currency) : '—'}
          </span>
        </span>
      </div>

      {/* Total G/L */}
      <div className="flex items-baseline justify-between mb-2">
        <span className="flex items-center gap-1">
          <span className="text-[9px] text-slate-400">Total</span>
          <span className="text-[10px]" style={{ color: textColor }}>
            {fmtCompactGainLine(totalGain, totalPct, currency)}
          </span>
        </span>
        <span className="text-[9px] text-slate-400">
          Invested <span className="text-slate-600 font-semibold">{fmt(invested, currency)}</span>
        </span>
      </div>

      {/* Footer: Invested · Realized */}
      {footer ?? (
        <div
          className="flex justify-between pt-1.5"
          style={{ borderTop: '1px solid #e2e8f0' }}
        >
          <span className="text-[9px] text-slate-400">
            Invested <span className="text-slate-600 font-semibold">{fmt(invested, currency)}</span>
          </span>
          <span className="text-[9px] text-slate-400">
            Realized{' '}
            <span className="font-semibold" style={{ color: realColor }}>
              {fmtCompactGainLine(realGain, null, currency)}
            </span>
          </span>
        </div>
      )}
    </div>
  )
}
