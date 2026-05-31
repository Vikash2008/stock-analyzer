import { fmtCompact, fmtPct } from '../utils/fmt'
import type { Transaction } from '../api/types'
import type { Currency } from '../App'

const BADGE: Record<string, { bg: string; fg: string }> = {
  BUY:      { bg: '#d1fae5', fg: '#065f46' },
  SELL:     { bg: '#fee2e2', fg: '#991b1b' },
  DIVIDEND: { bg: '#dbeafe', fg: '#1e40af' },
}

export type TxGain =
  | { status: 'held';     gain: number; pct: number; currentValue: number }
  | { status: 'sold';     gain: number; pct: number }
  | { status: 'realized'; gain: number; pct: number }
  | { status: 'partial';  realGain: number; realPct: number; realQty: number
                          unrealGain: number; unrealPct: number; unrealQty: number; currentValue: number }

interface TxRowProps {
  tx:       Transaction
  currency: Currency
  usdInr:   number
  gain?:    TxGain | null
}

const gc   = (v: number) => v >= 0 ? '#0a7a42' : '#be1c1c'
const fq   = (q: number) => q % 1 < 1e-9 ? q.toFixed(0) : q.toFixed(2)
const fmtG = (g: number, p: number, cur: Currency) =>
  `${g >= 0 ? '+' : '−'}${fmtCompact(Math.abs(g), cur)} (${fmtPct(p)})`
const shortDate = (iso: string) => {
  const d = new Date(iso)
  const day = d.getDate()
  const mon = d.toLocaleDateString('en-IN', { month: 'short' })
  const yr  = String(d.getFullYear()).slice(-2)
  return `${day} ${mon}'${yr}`
}

export function TxRow({ tx, currency, usdInr, gain }: TxRowProps) {
  const badge  = BADGE[tx.type] ?? BADGE.DIVIDEND
  const fx     = tx.currency === 'USD' && currency === 'INR' ? usdInr : 1
  const amount = tx.quantity * tx.price * fx

  // ── 6 cells, exactly 1 line each ─────────────────────────────
  // R1: Date | Unrealised gains (Y sh left) | Current value (inv value)
  // R2: Total invested (qty × price) | Realised gains (X sh sold) | Total gains

  // R1 Middle — unrealised
  let r1midGain = ''
  let r1midSub  = '—'
  let r1midColor = '#94a3b8'

  // R1 Right — current value (invested in parens)
  let r1right = '—'

  // R2 Middle — realised
  let r2midGain  = ''
  let r2midSub   = '—'
  let r2midColor = '#94a3b8'

  // R2 Right — total gain
  let r2right      = '—'
  let r2rightColor = '#94a3b8'

  if (gain?.status === 'held') {
    r1midGain  = fmtG(gain.gain, gain.pct, currency)
    r1midSub   = `${fq(tx.quantity)}sh left`
    r1midColor = gc(gain.gain)
    r1right    = `${fmtCompact(gain.currentValue, currency)} (${fmtCompact(amount, currency)})`
    r2right      = fmtG(gain.gain, gain.pct, currency)
    r2rightColor = gc(gain.gain)

  } else if (gain?.status === 'partial') {
    const invHeld = gain.unrealQty * tx.price * fx
    const tg = gain.unrealGain + gain.realGain
    const tp = amount !== 0 ? tg / amount * 100 : 0
    r1midGain  = fmtG(gain.unrealGain, gain.unrealPct, currency)
    r1midSub   = `${fq(gain.unrealQty)}sh left`
    r1midColor = gc(gain.unrealGain)
    r1right    = `${fmtCompact(gain.currentValue, currency)} (${fmtCompact(invHeld, currency)})`
    r2midGain  = fmtG(gain.realGain, gain.realPct, currency)
    r2midSub   = `${fq(gain.realQty)}sh sold`
    r2midColor = gc(gain.realGain)
    r2right      = fmtG(tg, tp, currency)
    r2rightColor = gc(tg)

  } else if (gain?.status === 'sold') {
    r1right    = `${fmtCompact(0, currency)} (${fmtCompact(0, currency)})`
    r2midGain  = fmtG(gain.gain, gain.pct, currency)
    r2midSub   = `${fq(tx.quantity)}sh sold`
    r2midColor = gc(gain.gain)
    r2right      = fmtG(gain.gain, gain.pct, currency)
    r2rightColor = gc(gain.gain)

  } else if (gain?.status === 'realized') {
    r1right    = `${fmtCompact(0, currency)} (${fmtCompact(0, currency)})`
    r2midGain  = fmtG(gain.gain, gain.pct, currency)
    r2midSub   = `${fq(tx.quantity)}sh sold`
    r2midColor = gc(gain.gain)
    r2right      = fmtG(gain.gain, gain.pct, currency)
    r2rightColor = gc(gain.gain)

  } else if (tx.type === 'DIVIDEND') {
    r1right = fmtCompact(amount, currency)
  }

  // R2 Left — total invested
  const r2left = `${fmtCompact(amount, currency)} = ${fq(tx.quantity)}sh × ${tx.price.toFixed(2)}`

  return (
    <div
      className="flex items-stretch border rounded-lg mb-1 overflow-hidden shadow-sm"
      style={{
        background: r2rightColor === '#0a7a42' ? '#f7fef9' : r2rightColor === '#be1c1c' ? '#fffbfb' : '#ffffff',
        borderColor: r2rightColor === '#0a7a42' ? '#d1fae5' : r2rightColor === '#be1c1c' ? '#fee2e2' : '#e2e8f0',
      }}
    >

      {/* Badge — vertically centered, whitespace on all 4 sides */}
      <div className="flex items-center justify-center px-2 shrink-0">
        <span
          className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-1 rounded"
          style={{ background: badge.bg, color: badge.fg }}
        >
          {tx.type === 'DIVIDEND' ? 'DIV' : tx.type}
        </span>
      </div>

      {/* 3-col × 2-row grid */}
      <div
        className="flex-1 min-w-0 px-2.5 py-2"
        style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr 1fr', rowGap: 3, columnGap: 6 }}
      >
        {/* R1L — Date */}
        <p className="text-[10px] font-semibold text-slate-800 whitespace-nowrap overflow-hidden truncate">
          {shortDate(tx.date)}
        </p>

        {/* R1M — Unrealised gains (Y sh left) */}
        <div className="overflow-hidden min-w-0">
          {r1midGain
            ? <p className="text-[10px] font-semibold whitespace-nowrap truncate" style={{ color: r1midColor }}>
                {r1midGain} · {r1midSub}
              </p>
            : <p className="text-[10px] text-slate-300 whitespace-nowrap">—</p>
          }
        </div>

        {/* R1R — Current value (invested) */}
        <p className="text-[10px] font-bold text-slate-900 whitespace-nowrap overflow-hidden truncate text-right">
          {r1right}
        </p>

        {/* R2L — Total invested (qty × price) */}
        <p className="text-[10px] text-slate-400 whitespace-nowrap overflow-hidden truncate">
          {r2left}
        </p>

        {/* R2M — Realised gains (X sh sold) */}
        <div className="overflow-hidden min-w-0">
          {r2midGain
            ? <p className="text-[9px] font-semibold whitespace-nowrap truncate" style={{ color: r2midColor }}>
                {r2midGain} · {r2midSub}
              </p>
            : <p className="text-[10px] text-slate-300 whitespace-nowrap">—</p>
          }
        </div>

        {/* R2R — Total gains */}
        <p className="text-[10px] font-semibold whitespace-nowrap overflow-hidden truncate text-right"
           style={{ color: r2rightColor }}>
          {r2right}
        </p>

      </div>
    </div>
  )
}
