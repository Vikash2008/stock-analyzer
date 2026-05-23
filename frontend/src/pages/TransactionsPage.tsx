import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { usePortfolio } from '../hooks/usePortfolio'
import { TxRow } from '../components/TxRow'
import { PriceChart } from '../components/PriceChart'
import { LoadingSkeleton, ErrorState } from '../components/LoadingSkeleton'
import { aggRealized } from '../utils/realized'
import { SKIP_PORTS, USD_PORTS } from '../utils/segments'
import { fmt, fmtGainLine, fmtPct } from '../utils/fmt'
import type { Currency } from '../App'

interface Props { currency: Currency }

export default function TransactionsPage({ currency }: Props) {
  const navigate = useNavigate()
  const { portfolio = '', symbol = '' } = useParams<{ portfolio: string; symbol: string }>()
  const { data, isLoading, error } = usePortfolio(currency)
  const [activeTab, setActiveTab] = useState<'transactions' | 'charts'>('transactions')

  const decoded = {
    portfolio: decodeURIComponent(portfolio),
    symbol:    decodeURIComponent(symbol),
  }

  const realizedMap = useMemo(
    () => (data ? aggRealized(data.realized, data.usd_inr) : new Map()),
    [data],
  )

  const holding = useMemo(() => {
    if (!data) return null
    const rows = data.holdings.filter(
      h => h.portfolio === decoded.portfolio && h.symbol === decoded.symbol,
    )
    return rows[0] ?? null
  }, [data, decoded.portfolio, decoded.symbol])

  const symTxns = useMemo(() => {
    if (!data) return []
    return data.transactions
      .filter(t =>
        t.symbol    === decoded.symbol &&
        t.portfolio === decoded.portfolio &&
        (t.type === 'BUY' || t.type === 'SELL') &&
        !SKIP_PORTS.has(t.portfolio),
      )
      .sort((a, b) => b.date.localeCompare(a.date))  // newest first
  }, [data, decoded.portfolio, decoded.symbol])

  if (isLoading) return <LoadingSkeleton />
  if (error || !data) return <ErrorState message={(error as Error)?.message ?? 'Unknown error'} />

  const isUsd   = USD_PORTS.has(decoded.portfolio)
  const dispCur = currency
  const [realGain] = realizedMap.get(`${decoded.portfolio}:${decoded.symbol}`) ?? [0]
  const realColor  = realGain >= 0 ? '#0a7a42' : '#be1c1c'
  const backLabel  = `← ${decoded.portfolio} Holdings`

  // Symbol overview card values
  const cur     = holding ? holding.disp_current  : 0
  const inv     = holding ? holding.disp_invested : 0
  const gain    = cur - inv
  const pct     = inv !== 0 ? (gain / inv) * 100 : 0
  const gainPos = gain >= 0
  const border  = gainPos ? '#10b981' : '#f43f5e'
  const bg      = gainPos ? '#f0fdf8' : '#fff5f5'
  const tc      = gainPos ? '#0a7a42' : '#be1c1c'

  const tg    = holding?.disp_today_gain ?? null
  const tp    = holding?.today_pct ?? null
  const tgC   = tg !== null ? (tg >= 0 ? '#0a7a42' : '#be1c1c') : '#94a3b8'

  const ltp   = holding?.current_price?.toFixed(2) ?? '—'
  const qty   = holding ? holding.quantity.toFixed(3) : '—'
  const avg   = holding ? holding.avg_cost.toFixed(2) : '—'
  const co    = holding?.company ?? ''
  const yf    = holding?.yf_symbol ?? decoded.symbol

  return (
    <div className="max-w-xl mx-auto px-4 py-4">
      {/* Back */}
      <button onClick={() => navigate(-1)} className="text-[11px] text-[#2563eb] mb-3">
        {backLabel}
      </button>

      {/* Symbol overview card */}
      <div
        className="rounded-[10px] border px-3 py-2.5 mb-3"
        style={{ background: bg, borderColor: '#e2e8f0', borderLeftWidth: 4, borderLeftColor: border }}
      >
        {/* Label row */}
        <div className="flex justify-between items-center mb-1">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider truncate max-w-[75%]">
            {decoded.portfolio} · {decoded.symbol}{co ? ` · ${co}` : ''}
          </span>
          <span className="text-[9px] text-slate-400 shrink-0">
            LTP <span className="text-slate-600 font-semibold">{ltp}</span>
          </span>
        </div>

        {/* Current value + today gain */}
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-[20px] font-bold text-slate-900 tracking-tight">
            {holding ? fmt(cur, dispCur) : '—'}
          </span>
          <span className="text-[10px]" style={{ color: tgC }}>
            {tg !== null
              ? `${tg >= 0 ? '+' : '−'}${fmt(Math.abs(tg), dispCur)}${tp !== null ? ` (${fmtPct(tp)})` : ''}`
              : 'N/A'}
          </span>
        </div>

        {/* G/L */}
        <div className="mb-2">
          <span className="text-[10px] font-bold" style={{ color: tc }}>
            {fmtGainLine(gain, pct, dispCur)}
          </span>
        </div>

        {/* Footer: Invested · qty · avg | Realized */}
        <div
          className="flex justify-between pt-1.5"
          style={{ borderTop: '1px solid #e2e8f0' }}
        >
          <span className="text-[9px] text-slate-400">
            Invested{' '}
            <span className="text-slate-600 font-semibold">{holding ? fmt(inv, dispCur) : '—'}</span>
            {holding && <span className="text-slate-400"> · {qty} sh · {avg}/sh</span>}
          </span>
          <span className="text-[9px] text-slate-400">
            Realized{' '}
            <span className="font-semibold" style={{ color: realColor }}>
              {fmtGainLine(realGain, null, dispCur)}
            </span>
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-3 mb-3 border-b border-slate-200">
        {(['transactions', 'charts'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`text-[11px] pb-1.5 capitalize font-medium transition-colors ${
              activeTab === tab
                ? 'text-[#2563eb] border-b-2 border-[#2563eb]'
                : 'text-slate-400'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'transactions' && (
        <>
          {symTxns.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-6">No transactions found</p>
          ) : (
            <>
              <p className="text-[9px] text-slate-400 mb-2">{symTxns.length} transactions</p>
              {symTxns.map((t, i) => (
                <TxRow
                  key={`${t.date}-${i}`}
                  tx={t}
                  currency={dispCur}
                  usdInr={data.usd_inr}
                />
              ))}
            </>
          )}
        </>
      )}

      {activeTab === 'charts' && (
        <PriceChart
          transactions={symTxns}
          yf_symbol={yf}
          currency={dispCur}
          usdInr={data.usd_inr}
        />
      )}
    </div>
  )
}
