// Single transaction row — mirrors tx-row HTML in transactions_page.py.

import { fmt, fmtPct, fmtDate } from '../utils/fmt'
import type { Transaction } from '../api/types'
import type { Currency } from '../App'

const BADGE: Record<string, { bg: string; fg: string }> = {
  BUY:      { bg: '#d1fae5', fg: '#065f46' },
  SELL:     { bg: '#fee2e2', fg: '#991b1b' },
  DIVIDEND: { bg: '#dbeafe', fg: '#1e40af' },
}

export type TxGain =
  | { status: 'held';     gain: number; pct: number }
  | { status: 'sold';     gain: number; pct: number }
  | { status: 'realized'; gain: number; pct: number }
  | { status: 'partial';  realGain: number; realPct: number; realQty: number
                          unrealGain: number; unrealPct: number; unrealQty: number }

interface TxRowProps {
  tx:      Transaction
  currency: Currency
  usdInr:  number
  gain?:   TxGain | null
}

const gc = (v: number) => v >= 0 ? '#0a7a42' : '#be1c1c'
const gs = (v: number) => v >= 0 ? '+' : '−'
const fq = (q: number) => q % 1 < 1e-9 ? q.toFixed(0) : q.toFixed(3)

export function TxRow({ tx, currency, usdInr, gain }: TxRowProps) {
  const badge  = BADGE[tx.type] ?? BADGE.DIVIDEND
  const amount = tx.quantity * tx.price * (tx.currency === 'USD' && currency === 'INR' ? usdInr : 1)

  return (
    <div className="flex justify-between items-start px-2.5 py-2 bg-white border border-[#e2e8f0] rounded-lg mb-1">
      <div className="flex items-center gap-2">
        <span
          className="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 uppercase tracking-wide"
          style={{ background: badge.bg, color: badge.fg }}
        >
          {tx.type === 'DIVIDEND' ? 'DIV' : tx.type}
        </span>
        <div>
          <p className="text-[11px] font-semibold text-slate-900">{fmtDate(tx.date)}</p>
          <p className="text-[10px] text-slate-500">
            {tx.quantity.toFixed(3)} sh · {tx.price.toFixed(2)}/sh
          </p>
        </div>
      </div>

      <div className="text-right shrink-0 ml-2">
        <p className="text-[12px] font-bold text-slate-900">{fmt(amount, currency)}</p>

        {gain?.status === 'held' && (
          <p className="text-[10px] font-semibold" style={{ color: gc(gain.gain) }}>
            {gs(gain.gain)}{fmt(Math.abs(gain.gain), currency)} ({fmtPct(gain.pct)})
          </p>
        )}

        {(gain?.status === 'sold' || gain?.status === 'realized') && (
          <p className="text-[10px] font-semibold" style={{ color: gc(gain.gain) }}>
            Realized {gs(gain.gain)}{fmt(Math.abs(gain.gain), currency)} ({fmtPct(gain.pct)})
          </p>
        )}

        {gain?.status === 'partial' && (
          <>
            <p className="text-[10px] font-semibold" style={{ color: gc(gain.realGain) }}>
              {fq(gain.realQty)} sold {gs(gain.realGain)}{fmt(Math.abs(gain.realGain), currency)} ({fmtPct(gain.realPct)})
            </p>
            <p className="text-[10px] font-semibold" style={{ color: gc(gain.unrealGain) }}>
              {fq(gain.unrealQty)} held {gs(gain.unrealGain)}{fmt(Math.abs(gain.unrealGain), currency)} ({fmtPct(gain.unrealPct)})
            </p>
          </>
        )}
      </div>
    </div>
  )
}
