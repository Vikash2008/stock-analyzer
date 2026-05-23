// Single transaction row — mirrors tx-row HTML in transactions_page.py.

import { fmt, fmtDate } from '../utils/fmt'
import type { Transaction } from '../api/types'
import type { Currency } from '../App'

const BADGE: Record<string, { bg: string; fg: string }> = {
  BUY:      { bg: '#d1fae5', fg: '#065f46' },
  SELL:     { bg: '#fee2e2', fg: '#991b1b' },
  DIVIDEND: { bg: '#dbeafe', fg: '#1e40af' },
}

interface TxRowProps {
  tx:       Transaction
  currency: Currency
  usdInr:   number
}

export function TxRow({ tx, currency, usdInr }: TxRowProps) {
  const badge  = BADGE[tx.type] ?? BADGE.DIVIDEND
  const amount = tx.quantity * tx.price * (tx.currency === 'USD' && currency === 'INR' ? usdInr : 1)

  return (
    <div className="flex justify-between items-center px-2.5 py-2 bg-white border border-[#e2e8f0] rounded-lg mb-1">
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
      <span className="text-[12px] font-bold text-slate-900 shrink-0">
        {fmt(amount, currency)}
      </span>
    </div>
  )
}
