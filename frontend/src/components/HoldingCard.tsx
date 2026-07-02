// Individual holding tile — mirrors design-mockups/holdings-page.html .metric-card.compact.
// Entire card is tappable (onClick). No separate button needed.

import { fmt, fmtCompactGainLine, fmtPct } from '../utils/fmt'
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
  xirr:       number | null
  dividends?: number          // pass when "include dividends" toggle is ON
  fxGain?:    number          // pass when "include FX gains" toggle is ON
  currency:   Currency
  onClick:    () => void
}

export function HoldingCard({
  ticker, subLabel, current, invested, realGain, realCost,
  todayGain, todayPct, ltp, xirr, dividends, fxGain, currency, onClick,
}: HoldingCardProps) {
  const divAmt    = dividends ?? 0
  const fxAmt     = fxGain ?? 0
  const totalGain = (current - invested) + realGain + divAmt + fxAmt
  const totalCost = invested + realCost
  const totalPct  = totalCost !== 0 ? (totalGain / totalCost) * 100 : 0
  const gain      = totalGain >= 0

  const accent   = gain ? '#0d9488' : '#f43f5e'
  const cardBg   = gain ? '#f0fdf6' : '#fef4f4'
  const tgColor  = (todayGain ?? 0) >= 0 ? '#059669' : '#e11d48'
  const totColor = gain ? '#059669' : '#e11d48'

  return (
    <div
      className="rounded-[13px] border pl-3 pr-2 py-1.5 cursor-pointer active:opacity-75 transition-opacity select-none"
      style={{ background: cardBg, borderColor: '#cbd5e1', borderLeftWidth: 4, borderLeftColor: accent }}
      onClick={onClick}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[9px] font-bold uppercase tracking-[1.2px] truncate" style={{ color: '#0b3b3a' }}>
          {(subLabel || ticker).replace(/\.(NS|BO)$/i, '')}
        </p>
        {ltp != null && (
          <span className="text-[9px] font-semibold whitespace-nowrap shrink-0 text-slate-500">LTP {fmt(ltp, currency)}</span>
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[19px] font-extrabold text-slate-900 tracking-tight">{fmt(current, currency)}</span>
        {xirr !== null
          ? <span className="text-[11px] font-bold px-2.5 py-[3px] rounded-full whitespace-nowrap shrink-0" style={{ background: xirr >= 0 ? '#d1fae5' : '#fee2e2', color: xirr >= 0 ? '#047857' : '#b91c1c' }}>XIRR {fmtPct(xirr)}</span>
          : <span className="text-[11px] text-slate-400 shrink-0">XIRR —</span>
        }
      </div>
      <div className="flex justify-between mt-1 pt-1 border-t border-black/5">
        <div className="flex flex-col gap-0">
          <span className="text-[8px] font-semibold uppercase tracking-wide text-slate-400">Today</span>
          <span className="text-[11px] font-bold whitespace-nowrap" style={{ color: tgColor }}>
            {fmtCompactGainLine(todayGain ?? 0, todayGain !== null ? todayPct : 0, currency)}
          </span>
        </div>
        <div className="flex flex-col gap-0 items-end">
          <span className="text-[8px] font-semibold uppercase tracking-wide text-slate-400">Total</span>
          <span className="text-[11px] font-bold whitespace-nowrap" style={{ color: totColor }}>
            {fmtCompactGainLine(totalGain, totalPct, currency)}
          </span>
        </div>
      </div>
      {(fxAmt > 0 || divAmt > 0) && (
        <div className="flex justify-between items-center mt-0.5">
          <span>{fxAmt > 0 && <span className="flex items-center gap-1"><span className="text-[10px] text-slate-400">FX</span><span className="text-[10px] text-teal-600 font-semibold">{fmtCompactGainLine(fxAmt, null, currency)}</span></span>}</span>
          <span>{divAmt > 0 && <span className="flex items-center gap-1"><span className="text-[10px] text-slate-400">Dividend</span><span className="text-[10px] text-teal-600 font-semibold">{fmtCompactGainLine(divAmt, null, currency)}</span></span>}</span>
        </div>
      )}
    </div>
  )
}
