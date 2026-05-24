import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePortfolio, useForceRefresh } from '../hooks/usePortfolio'
import { LoadingSkeleton, ErrorState } from '../components/LoadingSkeleton'
import { fmt, fmtGainLine, fmtPct } from '../utils/fmt'
import { SKIP_PORTS, getSegmentType, filterBySegment, USD_PORTS } from '../utils/segments'
import { aggRealized, realizedForPorts } from '../utils/realized'
import { computeXIRR } from '../utils/xirr'
import type { RealizedMap } from '../utils/realized'
import type { Currency } from '../App'
import type { Holding } from '../api/types'

interface Props {
  currency: Currency
  onCurrencyChange: (c: Currency) => void
}

type BreakdownMode = 'broker' | 'type'

interface CardStats {
  key:       string
  label:     string
  current:   number
  invested:  number
  realGain:  number
  realCost:  number
  todayGain: number | null
  navPath:   string
}

const TYPE_SEGMENTS = [
  { key: 'indian_stock', label: 'Indian Stocks' },
  { key: 'us_stock',     label: 'US Stocks'     },
  { key: 'indian_mf',   label: 'Indian MF'      },
  { key: 'us_mf',       label: 'US MF'          },
] as const

function portfolioCards(holdings: Holding[], rmap: RealizedMap): CardStats[] {
  const agg = new Map<string, { current: number; invested: number; todayGain: number | null }>()
  for (const h of holdings) {
    const p = agg.get(h.portfolio) ?? { current: 0, invested: 0, todayGain: null }
    agg.set(h.portfolio, {
      current:   p.current  + h.disp_current,
      invested:  p.invested + h.disp_invested,
      todayGain: h.disp_today_gain !== null ? (p.todayGain ?? 0) + h.disp_today_gain : p.todayGain,
    })
  }
  return [...agg.entries()].map(([name, v]) => {
    const [rg, rc] = realizedForPorts(rmap, new Set([name]))
    return {
      key: name, label: name,
      current: v.current, invested: v.invested,
      realGain: rg, realCost: rc,
      todayGain: v.todayGain,
      navPath: `/holdings/portfolio/${encodeURIComponent(name)}`,
    }
  }).sort((a, b) => b.current - a.current)
}

function typeCards(holdings: Holding[], rmap: RealizedMap): CardStats[] {
  return TYPE_SEGMENTS.map(({ key, label }) => {
    const hs = holdings.filter(h => getSegmentType(h.portfolio, h.yf_symbol) === key)
    if (!hs.length) return null
    let current = 0, invested = 0, todayGain: number | null = null
    for (const h of hs) {
      current  += h.disp_current
      invested += h.disp_invested
      if (h.disp_today_gain !== null) todayGain = (todayGain ?? 0) + h.disp_today_gain
    }
    const [rg, rc] = realizedForPorts(rmap, new Set(hs.map(h => h.portfolio)))
    return { key, label, current, invested, realGain: rg, realCost: rc, todayGain, navPath: `/holdings/segment/${key}` }
  }).filter(Boolean) as CardStats[]
}

function isPos(v: number) { return v >= 0 }

function BreakCard({ card, currency, xirr, onClick }: { card: CardStats; currency: Currency; xirr: number | null; onClick: () => void }) {
  const totalGain = (card.current - card.invested) + card.realGain
  const totalCost = card.invested + card.realCost
  const pct = totalCost !== 0 ? (totalGain / totalCost) * 100 : 0
  const pos = isPos(totalGain)
  const todayPrior = card.current - (card.todayGain ?? 0)
  const todayPct = card.todayGain !== null && todayPrior !== 0 ? (card.todayGain / todayPrior) * 100 : null

  return (
    <div
      className="rounded-[10px] p-3 border cursor-pointer active:opacity-80 transition-opacity"
      style={{
        background:      pos ? '#f0fdf8' : '#fff5f5',
        borderColor:     '#e2e8f0',
        borderLeftWidth: 4,
        borderLeftColor: pos ? '#10b981' : '#f43f5e',
      }}
      onClick={onClick}
    >
      <p className="text-[9px] text-slate-400 uppercase tracking-widest mb-1">{card.label}</p>
      <div className="flex items-baseline justify-between">
        <span className="text-[15px] font-bold text-slate-900">{fmt(card.current, currency)}</span>
        <span className="text-[10px]" style={{ color: card.todayGain !== null ? (card.todayGain >= 0 ? '#0a7a42' : '#be1c1c') : '#94a3b8' }}>
          {card.todayGain !== null ? `${card.todayGain >= 0 ? '+' : ''}${fmt(card.todayGain, currency)}${todayPct !== null ? ` (${fmtPct(todayPct)})` : ''}` : 'N/A'}
        </span>
      </div>
      <div className="flex items-center justify-between mt-0.5">
        {xirr !== null
          ? <span className="text-[9px] font-semibold" style={{ color: xirr >= 0 ? '#0a7a42' : '#be1c1c' }}>XIRR {fmtPct(xirr)}</span>
          : <span className="text-[9px] text-slate-400">{fmt(card.invested, currency)} inv</span>
        }
        <span className="text-[11px]" style={{ color: pos ? '#0a7a42' : '#be1c1c' }}>
          {fmtGainLine(totalGain, pct, currency)}
        </span>
      </div>
    </div>
  )
}

export default function PortfoliosPage({ currency, onCurrencyChange }: Props) {
  const navigate     = useNavigate()
  const { data, isLoading, error } = usePortfolio(currency)
  const forceRefresh = useForceRefresh(currency)
  const [mode, setMode] = useState<BreakdownMode>('type')

  const rmap = useMemo(() => data ? aggRealized(data.realized, data.usd_inr) : new Map(), [data])

  // All holdings excluding aggregate-duplicate portfolios
  const active = useMemo(
    () => (data ? data.holdings.filter(h => !SKIP_PORTS.has(h.portfolio)) : []),
    [data],
  )

  // Hero stats: unrealized + ALL non-SKIP realized (including fully-exited positions)
  const hero = useMemo(() => {
    const cur = active.reduce((s, h) => s + h.disp_current,  0)
    const inv = active.reduce((s, h) => s + h.disp_invested, 0)
    let todayGain = 0
    for (const h of active) { if (h.disp_today_gain !== null) todayGain += h.disp_today_gain }
    let rg = 0, rc = 0
    for (const [key, [g, c]] of rmap) {
      if (!SKIP_PORTS.has(key.split(':')[0])) { rg += g; rc += c }
    }
    const totalGain = (cur - inv) + rg
    const totalCost = inv + rc
    const prior = cur - todayGain
    return {
      cur, inv, totalGain,
      returnPct:  totalCost !== 0 ? totalGain / totalCost * 100 : 0,
      todayGain,
      todayPct:   todayGain !== 0 && prior !== 0 ? (todayGain / prior) * 100 : null,
    }
  }, [active, rmap])

  // Stocks tile
  const stk = useMemo(() => {
    const hs  = filterBySegment(active, 'stk')
    const cur = hs.reduce((s, h) => s + h.disp_current,  0)
    const inv = hs.reduce((s, h) => s + h.disp_invested, 0)
    const tg  = hs.reduce((s, h) => h.disp_today_gain !== null ? s + h.disp_today_gain : s, 0)
    const [rg, rc] = realizedForPorts(rmap, new Set(hs.map(h => h.portfolio)))
    const gain = (cur - inv) + rg
    const cost = inv + rc
    const prior = cur - tg
    return { cur, inv, gain, pct: cost !== 0 ? gain / cost * 100 : 0, todayGain: tg, todayPct: tg !== 0 && prior !== 0 ? (tg / prior) * 100 : null }
  }, [active, rmap])

  // MF tile
  const mf = useMemo(() => {
    const hs  = filterBySegment(active, 'mf')
    const cur = hs.reduce((s, h) => s + h.disp_current,  0)
    const inv = hs.reduce((s, h) => s + h.disp_invested, 0)
    const tg  = hs.reduce((s, h) => h.disp_today_gain !== null ? s + h.disp_today_gain : s, 0)
    const [rg, rc] = realizedForPorts(rmap, new Set(hs.map(h => h.portfolio)))
    const gain = (cur - inv) + rg
    const cost = inv + rc
    const prior = cur - tg
    return { cur, inv, gain, pct: cost !== 0 ? gain / cost * 100 : 0, todayGain: tg, todayPct: tg !== 0 && prior !== 0 ? (tg / prior) * 100 : null }
  }, [active, rmap])

  const cards = useMemo(
    () => mode === 'broker' ? portfolioCards(active, rmap) : typeCards(active, rmap),
    [active, rmap, mode],
  )

  // XIRR per card — broker uses bundle values, type is computed client-side
  const cardXirrMap = useMemo(() => {
    if (!data) return new Map<string, number | null>()
    const map = new Map<string, number | null>()
    const today = new Date()

    if (mode === 'broker') {
      for (const card of cards) {
        const v = data.xirr_by_portfolio[card.key]
        map.set(card.key, v !== undefined ? v : null)
      }
    } else {
      for (const card of cards) {
        const hs = active.filter(h => getSegmentType(h.portfolio, h.yf_symbol) === card.key)
        const holdingKeys = new Set(hs.map(h => `${h.portfolio}:${h.symbol}`))
        const txns = data.transactions.filter(t => holdingKeys.has(`${t.portfolio}:${t.symbol}`))
        const cfs: { date: Date; amount: number }[] = []
        for (const tx of txns) {
          if (tx.type === 'DIVIDEND') continue
          const isUsd = USD_PORTS.has(tx.portfolio)
          const fx = isUsd
            ? (currency === 'INR' ? data.usd_inr : 1)
            : (currency === 'USD' ? 1 / data.usd_inr : 1)
          const amt = tx.quantity * tx.price * fx
          const chg = (tx.charges ?? 0) * fx
          if (tx.type === 'BUY')  cfs.push({ date: new Date(tx.date), amount: -(amt + chg) })
          if (tx.type === 'SELL') cfs.push({ date: new Date(tx.date), amount:   amt - chg })
        }
        const totalCurrent = hs.reduce((s, h) => s + h.disp_current, 0)
        if (totalCurrent > 0) cfs.push({ date: today, amount: totalCurrent })
        const r = computeXIRR(cfs)
        map.set(card.key, r !== null ? r * 100 : null)
      }
    }
    return map
  }, [cards, data, mode, active, currency])

  if (isLoading) return <LoadingSkeleton />
  if (error || !data) return <ErrorState message={(error as Error)?.message ?? 'Unknown error'} />

  const heroPos = isPos(hero.totalGain)

  return (
    <div className="max-w-xl mx-auto px-4 py-4 space-y-3">

      {/* Header row */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-slate-400 uppercase tracking-widest">
          as of {new Date(data.as_of).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })} IST
        </span>
        <button
          onClick={() => forceRefresh()}
          className="text-[11px] text-slate-400 hover:text-slate-600 px-1"
          title="Force refresh prices"
        >
          ↻
        </button>
      </div>

      {/* Hero card — Total Portfolio */}
      <div
        className="rounded-[10px] p-3 border cursor-pointer active:opacity-80 transition-opacity"
        style={{
          background:      heroPos ? '#f0fdf8' : '#fff5f5',
          borderColor:     '#e2e8f0',
          borderLeftWidth: 4,
          borderLeftColor: heroPos ? '#10b981' : '#f43f5e',
        }}
        onClick={() => navigate('/holdings/segment/total')}
      >
        <p className="text-[12px] font-semibold text-slate-600 mb-1">Total Portfolio</p>
        <div className="flex items-baseline justify-between">
          <span className="text-[22px] font-bold text-slate-900">{fmt(hero.cur, currency)}</span>
          <span className="text-[11px]" style={{ color: hero.todayGain >= 0 ? '#0a7a42' : '#be1c1c' }}>
            {hero.todayGain !== 0
              ? `${hero.todayGain >= 0 ? '+' : ''}${fmt(hero.todayGain, currency)}${hero.todayPct !== null ? ` (${fmtPct(hero.todayPct)})` : ''}`
              : 'N/A'
            }
          </span>
        </div>
        <div className="flex items-center justify-between mt-0.5">
          {data.xirr_total !== null
            ? <span className="text-[9px] font-semibold" style={{ color: (data.xirr_total ?? 0) >= 0 ? '#0a7a42' : '#be1c1c' }}>
                XIRR {fmtPct(data.xirr_total!)}
              </span>
            : <span className="text-[9px] text-slate-400">XIRR —</span>
          }
          <span className="text-[11px] font-medium" style={{ color: heroPos ? '#0a7a42' : '#be1c1c' }}>
            {fmtGainLine(hero.totalGain, hero.returnPct, currency)}
          </span>
        </div>
      </div>

      {/* Stocks + MF summary tiles */}
      <div className="flex gap-2">
        {[
          { label: 'Stocks',       stats: stk, seg: 'stk', xirr: data.xirr_stk },
          { label: 'Mutual Funds', stats: mf,  seg: 'mf',  xirr: data.xirr_mf  },
        ].map(({ label, stats, seg, xirr }) => {
          const pos = isPos(stats.gain)
          const tc  = pos ? '#0a7a42' : '#be1c1c'
          const tgC = stats.todayGain !== null ? (stats.todayGain >= 0 ? '#0a7a42' : '#be1c1c') : '#94a3b8'
          return (
            <div
              key={seg}
              className="flex-1 rounded-[10px] p-2.5 border cursor-pointer active:opacity-80 transition-opacity"
              style={{
                background:      pos ? '#f0fdf8' : '#fff5f5',
                borderColor:     '#e2e8f0',
                borderLeftWidth: 3,
                borderLeftColor: pos ? '#10b981' : '#f43f5e',
              }}
              onClick={() => navigate(`/holdings/segment/${seg}`)}
            >
              <p className="text-[11px] font-semibold text-slate-600 mb-1">{label}</p>
              <div className="flex items-baseline justify-between">
                <span className="text-[15px] font-bold text-slate-900">{fmt(stats.cur, currency)}</span>
                <span className="text-[10px]" style={{ color: tgC }}>
                  {stats.todayGain !== 0
                    ? `${stats.todayGain >= 0 ? '+' : ''}${fmt(stats.todayGain, currency)}${stats.todayPct !== null ? ` (${fmtPct(stats.todayPct)})` : ''}`
                    : ''
                  }
                </span>
              </div>
              <div className="flex items-center justify-between mt-0.5">
                {xirr !== null && xirr !== undefined
                  ? <span className="text-[9px] font-semibold" style={{ color: xirr >= 0 ? '#0a7a42' : '#be1c1c' }}>XIRR {fmtPct(xirr)}</span>
                  : <span className="text-[9px] text-slate-400">XIRR —</span>
                }
                <span className="text-[10px]" style={{ color: tc }}>
                  {fmtGainLine(stats.gain, stats.pct, currency)}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Breakdown toggle */}
      <div className="flex items-center justify-between px-0.5">
        <p className="text-[9px] text-slate-400 uppercase tracking-widest">Breakdown</p>
        <div className="flex gap-1">
          {(['type', 'broker'] as BreakdownMode[]).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`text-[10px] px-2.5 py-0.5 rounded-full border transition-colors ${
                mode === m
                  ? 'bg-[#2563eb] text-white border-[#2563eb]'
                  : 'bg-white text-slate-500 border-slate-200'
              }`}
            >
              {m === 'broker' ? 'By Broker' : 'By Type'}
            </button>
          ))}
        </div>
      </div>

      {/* Breakdown cards */}
      {cards.map(card => (
        <BreakCard key={card.key} card={card} currency={currency} xirr={cardXirrMap.get(card.key) ?? null} onClick={() => navigate(card.navPath)} />
      ))}

      {/* Data freshness */}
      <p className="text-[9px] text-slate-300 text-center pb-2">
        {data.cache_status.split('\n').find(l => l.includes('prices'))?.trim()}
      </p>
    </div>
  )
}
