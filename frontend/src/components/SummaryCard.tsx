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
  xirr?:       number | null
  dividends?:  number          // pass when "include dividends" toggle is ON
  fxGain?:     number          // pass when "include FX gains" toggle is ON
  currency:    Currency
  footer?:     React.ReactNode  // optional custom footer (used on TransactionsPage)
  highlight?:  { bg: string; accent: string }
}

export function SummaryCard({
  label, current, invested, realGain, realCost,
  todayGain, todayPct, xirr, dividends, fxGain, currency, footer, highlight,
}: SummaryCardProps) {
  const divAmt    = dividends ?? 0
  const fxAmt     = fxGain ?? 0
  const totalGain = (current - invested) + realGain + divAmt + fxAmt
  const totalCost = invested + realCost
  const totalPct  = totalCost !== 0 ? (totalGain / totalCost) * 100 : 0
  const gain      = totalGain >= 0

  const borderColor = highlight?.accent ?? (gain ? '#10b981' : '#f43f5e')
  const textColor   = gain ? '#0a7a42' : '#be1c1c'
  const realColor   = realGain >= 0 ? '#0a7a42' : '#be1c1c'

  const tgColor = (todayGain ?? 0) >= 0 ? '#0a7a42' : '#be1c1c'

  return (
    <div
      className="rounded-[10px] border mb-3 overflow-hidden shadow-sm"
      style={{ background: highlight?.bg ?? '#ffffff', borderColor: '#e5e7eb', borderLeftWidth: 4, borderLeftColor: borderColor }}
    >
      {/* Gradient top strip */}
      <div style={{ background: gain ? 'linear-gradient(90deg,#10b981,#0d9488)' : 'linear-gradient(90deg,#f43f5e,#e11d48)', height: 3 }} />
      <div className="px-3 py-2.5">
      {/* Label */}
      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">{label}</p>

      {/* Value + today gain */}
        <div className="grid grid-cols-[auto_1fr] items-center gap-y-0 mb-2">
          <span className="text-[20px] font-bold text-slate-900 tracking-tight">
            {fmt(current, currency)}
          </span>
          <span className="flex items-center gap-1 whitespace-nowrap justify-self-end">
            <span className="inline-block w-[22px] text-right text-[10px] font-semibold" style={{color:'#065f46'}}>1D</span>
            <span className="text-[10px]" style={{ color: tgColor }}>
              {fmtCompactGainLine(todayGain ?? 0, todayGain !== null ? todayPct : 0, currency)}
            </span>
          </span>
          <div className="-ml-1.5">
            {xirr != null
              ? <span className="text-[10px] font-semibold rounded-full px-1.5 py-0.5 leading-none" style={{ background: xirr >= 0 ? '#d1fae5' : '#fee2e2', color: xirr >= 0 ? '#065f46' : '#991b1b' }}>XIRR {fmtPct(xirr)}</span>
              : <span className="text-[10px] text-slate-400">XIRR —</span>
            }
          </div>
          <span className="flex items-center gap-1 whitespace-nowrap justify-self-end">
            <span className="inline-block w-[22px] text-right text-[10px] font-semibold" style={{color:'#065f46'}}>ALL</span>
            <span className="text-[10px]" style={{ color: textColor }}>
              {fmtCompactGainLine(totalGain, totalPct, currency)}
            </span>
          </span>
        </div>

      {/* Footer: Invested · Realized · Dividends */}
      {footer ?? (
        <div style={{ borderTop: '1px solid #e2e8f0' }} className="pt-1.5">
          <div className="flex justify-between">
            <span className="text-[10px] text-slate-400">
              Invested <span className="text-slate-600 font-semibold">{fmt(invested, currency)}</span>
            </span>
            <span className="text-[10px] text-slate-400">
              Realized{' '}
              <span className="font-semibold" style={{ color: realColor }}>
                {fmtCompactGainLine(realGain, null, currency)}
              </span>
            </span>
          </div>
          {fxAmt > 0 && (
            <div className="flex justify-start mt-0.5">
              <span className="text-[10px] text-teal-600">
                FX gains <span className="font-semibold">+{fmtCompactGainLine(fxAmt, null, currency)}</span>
              </span>
            </div>
          )}
          {divAmt > 0 && (
            <div className="flex justify-end items-center gap-1.5 mt-0.5">
              <span className="flex items-center gap-1">
                <span className="text-[10px] text-slate-400">· DIV</span>
                <span className="text-[10px] text-teal-600 font-semibold">{fmtCompactGainLine(divAmt, null, currency)}</span>
              </span>
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  )
}
