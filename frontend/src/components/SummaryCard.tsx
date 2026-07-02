// Top-of-page summary card — shown on HoldingsPage.
// Dark hero style — mirrors design-mockups/holdings-page.html .metric-card.hero.

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
  footer?:     React.ReactNode  // optional custom footer
  highlight?:  { bg: string; accent: string }
}

export function SummaryCard({
  label, current, invested, realGain, realCost,
  todayGain, todayPct, xirr, dividends, fxGain, currency, footer,
}: SummaryCardProps) {
  const divAmt    = dividends ?? 0
  const fxAmt     = fxGain ?? 0
  const totalGain = (current - invested) + realGain + divAmt + fxAmt
  const totalCost = invested + realCost
  const totalPct  = totalCost !== 0 ? (totalGain / totalCost) * 100 : 0
  const gain      = totalGain >= 0

  const realColor = realGain >= 0 ? '#5eead4' : '#fca5a5'
  const tgColor   = (todayGain ?? 0) >= 0 ? '#5eead4' : '#fca5a5'
  const totColor  = gain ? '#5eead4' : '#fca5a5'

  return (
    <div
      className="rounded-b-[18px] p-4 mb-3 relative overflow-hidden"
      style={{ background: 'linear-gradient(150deg, #10243f 0%, #0b3b3a 100%)', boxShadow: '0 14px 30px -10px rgba(11,59,58,0.45)' }}
    >
      <div className="absolute top-[-40px] right-[-40px] w-[160px] h-[160px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(45,212,191,0.25), transparent 70%)' }} />
      <div className="relative">
        <p className="text-[11px] font-bold uppercase tracking-[1.2px] mb-2" style={{ color: '#99e6dc' }}>{label}</p>

        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-[22px] font-extrabold text-white tracking-tight">{fmt(current, currency)}</span>
          {xirr != null
            ? <span className="text-[11px] font-bold rounded-full px-3 py-1 whitespace-nowrap shrink-0" style={{ background: 'rgba(45,212,191,0.18)', color: '#5eead4', border: '1px solid rgba(94,234,212,0.3)' }}>XIRR {fmtPct(xirr)}</span>
            : <span className="text-[11px] font-bold rounded-full px-3 py-1 whitespace-nowrap shrink-0" style={{ background: 'rgba(45,212,191,0.18)', color: '#5eead4', border: '1px solid rgba(94,234,212,0.3)' }}>XIRR —</span>
          }
        </div>

        <div className="flex justify-between text-[11px] mt-1" style={{ color: 'rgba(255,255,255,0.55)' }}>
          <span>Invested <span className="font-semibold text-white">{fmt(invested, currency)}</span></span>
          <span>Realized <span className="font-semibold" style={{ color: realColor }}>{fmtCompactGainLine(realGain, null, currency)}</span></span>
        </div>

        {(fxAmt > 0 || divAmt > 0) && (
          <div className="flex justify-between items-center text-[10.5px] mt-1" style={{ color: 'rgba(255,255,255,0.55)' }}>
            <span>{fxAmt > 0 && <>FX gains <span className="font-semibold" style={{ color: '#5eead4' }}>+{fmtCompactGainLine(fxAmt, null, currency)}</span></>}</span>
            <span>{divAmt > 0 && <>Dividend <span className="font-semibold" style={{ color: '#5eead4' }}>+{fmtCompactGainLine(divAmt, null, currency)}</span></>}</span>
          </div>
        )}

        {footer ?? (
          <div className="flex justify-between pt-2.5 mt-2.5" style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}>
            <div className="flex flex-col gap-0.5">
              <span className="text-[8px] font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.45)' }}>Today</span>
              <span className="text-[13px] font-bold whitespace-nowrap" style={{ color: tgColor }}>
                {fmtCompactGainLine(todayGain ?? 0, todayGain !== null ? todayPct : 0, currency)}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 items-end">
              <span className="text-[8px] font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.45)' }}>Total</span>
              <span className="text-[13px] font-bold whitespace-nowrap" style={{ color: totColor }}>
                {fmtCompactGainLine(totalGain, totalPct, currency)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
