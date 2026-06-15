// Individual holding tile — mirrors _h_card() in holdings_page.py.
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

  const borderColor = gain ? '#10b981' : '#f43f5e'
  const bgColor     = gain ? '#f7fef9' : '#fffbfb'
  const textColor   = gain ? '#0a7a42' : '#be1c1c'

  const tgColor = todayGain !== null
    ? (todayGain >= 0 ? '#0a7a42' : '#be1c1c')
    : '#94a3b8'

  return (
    <div
      className="rounded-[10px] border px-3 py-2.5 cursor-pointer active:opacity-75 transition-opacity select-none shadow-sm"
      style={{ background: bgColor, borderColor: '#e5e7eb', borderLeftWidth: 4, borderLeftColor: borderColor }}
      onClick={onClick}
    >
      {/* Label row: ticker · company | LTP */}
      <div className="flex justify-between items-center mb-1">
        <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider truncate max-w-[70%]">
          {(subLabel || ticker).replace(/\.(NS|BO)$/i, '')}
        </span>
        {ltp !== null && (
          <span className="text-[10px] text-slate-400 shrink-0">
            LTP <span className="text-slate-600 font-semibold">{ltp.toFixed(2)}</span>
          </span>
        )}
      </div>

      {/* Value | Today gain */}
      <div className="flex items-baseline justify-between mb-0.5">
        <span className="text-[16px] font-bold text-slate-900 tracking-tight min-w-0">
          {fmt(current, currency)}
        </span>
        <span className="flex items-center gap-1 shrink-0 whitespace-nowrap">
          <span className="text-[10px] text-slate-400">Today</span>
          <span className="text-[10px]" style={{ color: tgColor }}>
            {todayGain !== null ? fmtCompactGainLine(todayGain, todayPct, currency) : '—'}
          </span>
        </span>
      </div>

      {/* XIRR | Total G/L */}
      <div className="flex items-center justify-between">
        {xirr !== null
          ? <span className="text-[10px] font-semibold rounded-full px-1.5 py-0.5 leading-none shrink-0" style={{ background: xirr >= 0 ? '#d1fae5' : '#fee2e2', color: xirr >= 0 ? '#065f46' : '#991b1b' }}>XIRR {fmtPct(xirr)}</span>
          : <span className="text-[11px] text-slate-400">→</span>
        }
        <span className="flex items-center gap-1 shrink-0 whitespace-nowrap">
          <span className="text-[10px] text-slate-400">Total</span>
          <span className="text-[10px]" style={{ color: textColor }}>
            {fmtCompactGainLine(totalGain, totalPct, currency)}
          </span>
        </span>
      </div>
      {(fxAmt > 0 || divAmt > 0) && (
        <div className="flex justify-end items-center gap-1.5 mt-0.5">
          {fxAmt > 0 && (
            <span className="flex items-center gap-1">
              <span className="text-[10px] text-slate-400">· FX</span>
              <span className="text-[10px] text-teal-600 font-semibold">{fmtCompactGainLine(fxAmt, null, currency)}</span>
            </span>
          )}
          {divAmt > 0 && (
            <span className="flex items-center gap-1">
              <span className="text-[10px] text-slate-400">· DIV</span>
              <span className="text-[10px] text-teal-600 font-semibold">{fmtCompactGainLine(divAmt, null, currency)}</span>
            </span>
          )}
        </div>
      )}
    </div>
  )
}
