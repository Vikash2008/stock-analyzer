// Individual holding tile — mirrors design-mockups/holdings-page.html .metric-card.compact.
// Entire card is tappable (onClick). No separate button needed.

import { fmt, fmtCompactGainLine, fmtPct, truncateName } from '../utils/fmt'
import type { Currency } from '../App'

interface HoldingCardProps {
  ticker:     string
  subLabel:   string          // company name or portfolio name
  current:    number
  invested:   number
  realGain:   number
  realCost:   number
  todayGain:  number | null
  todayPct:   number | null
  ltp:        number | null
  ltpCurrency?: Currency      // native quote currency for ltp; defaults to `currency` if omitted
  xirr:       number | null
  dividends?: number          // pass when "include dividends" toggle is ON
  fxGain?:    number          // pass when "include FX gains" toggle is ON
  currency:   Currency
  onClick:    () => void
}

export function HoldingCard({
  ticker, subLabel, current, invested, realGain, realCost,
  todayGain, todayPct, ltp, ltpCurrency, xirr, dividends, fxGain, currency, onClick,
}: HoldingCardProps) {
  const divAmt    = dividends ?? 0
  const fxAmt     = fxGain ?? 0
  const totalGain = (current - invested) + realGain + divAmt + fxAmt
  const totalCost = invested + realCost
  const totalPct  = totalCost !== 0 ? (totalGain / totalCost) * 100 : 0

  const tgColor  = (todayGain ?? 0) >= 0 ? '#059669' : '#e11d48'
  const totColor = totalGain >= 0 ? '#059669' : '#e11d48'

  return (
    <div
      className="rounded-[13px] px-2 py-1.5 border cursor-pointer active:opacity-80 transition-opacity select-none"
      style={{ background: '#fff', borderColor: '#e2e8f0', borderLeftWidth: 4, borderLeftColor: xirr !== null && xirr < 0 ? '#e11d48' : '#0d9488' }}
      onClick={onClick}
    >
      <div className="flex items-center justify-between gap-2 mb-0.5">
        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-[1.2px] truncate">
          {truncateName((subLabel || ticker).replace(/\.(NS|BO)$/i, ''))}
        </p>
        {ltp != null && (
          <span className="text-[10px] font-semibold whitespace-nowrap shrink-0 text-slate-500">LTP {fmt(ltp, ltpCurrency ?? currency)}</span>
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[16px] font-bold text-slate-900">{fmt(current, currency)}</span>
        {xirr !== null
          ? (xirr < 0
              ? <span className="text-[11px] font-bold px-2 py-[3px] rounded-full whitespace-nowrap" style={{ background: '#fee2e2', color: '#991b1b' }}>XIRR {fmtPct(xirr)}</span>
              : <span className="text-[11px] font-bold px-2 py-[3px] rounded-full whitespace-nowrap" style={{ background: '#d1fae5', color: '#065f46' }}>XIRR {fmtPct(xirr)}</span>)
          : <span className="text-[11px] font-bold px-2 py-[3px] rounded-full whitespace-nowrap" style={{ background: '#e2e8f0', color: '#64748b' }}>XIRR —</span>
        }
      </div>
      <div className="flex justify-between mt-1 pt-1 border-t border-slate-100">
        <div className="flex flex-col gap-0.5">
          <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Today</span>
          <span className="text-[11.5px] font-bold whitespace-nowrap" style={{ color: tgColor }}>
            {fmtCompactGainLine(todayGain ?? 0, todayGain !== null ? todayPct : 0, currency)}
          </span>
        </div>
        <div className="flex flex-col gap-0.5 items-end">
          <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Total</span>
          <span className="text-[11.5px] font-bold whitespace-nowrap" style={{ color: totColor }}>
            {fmtCompactGainLine(totalGain, totalPct, currency)}
          </span>
        </div>
      </div>
    </div>
  )
}
