import { useMemo, useRef, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePortfolio, useForceRefresh } from '../hooks/usePortfolio'
import { LoadingSkeleton, ErrorState } from '../components/LoadingSkeleton'
import { fmt, fmtCompact, fmtCompactGainLine, fmtPct } from '../utils/fmt'
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

const TYPE_GROUPS = [
  { key: 'stocks', label: 'Stocks',       keys: ['indian_stock', 'us_stock'], color: '#10b981' },
  { key: 'mf',     label: 'Mutual Funds', keys: ['indian_mf',    'us_mf'],    color: '#6366f1' },
]

const BROKER_GROUPS = [
  { key: 'indian', label: 'Indian Stocks', test: (p: string) => !USD_PORTS.has(p) && !p.startsWith('MF_'), color: '#10b981' },
  { key: 'us',     label: 'US Stocks',     test: (p: string) => USD_PORTS.has(p),                          color: '#0ea5e9' },
  { key: 'mf',     label: 'Mutual Funds',  test: (p: string) => p.startsWith('MF_'),                       color: '#8b5cf6' },
]

const STOCK_CARD_STYLE = { accent: '#34d399', bg: 'linear-gradient(to right, #d1fae5, #ecfdf5 40%, #f0fdf4)' }
const MF_CARD_STYLE    = { accent: '#93c5fd', bg: 'linear-gradient(to right, #dbeafe, #eff6ff 45%, #f8faff)' }

const TYPE_CARD_STYLE: Record<string, { accent: string; bg: string }> = {
  indian_stock: STOCK_CARD_STYLE,
  us_stock:     STOCK_CARD_STYLE,
  indian_mf:    MF_CARD_STYLE,
  us_mf:        MF_CARD_STYLE,
}

const PORTFOLIO_CARD_STYLE: Record<string, { accent: string; bg: string }> = {
  Zerodha:           STOCK_CARD_STYLE,
  AngelOne:          STOCK_CARD_STYLE,
  Groww:             STOCK_CARD_STYLE,
  'IndMoney Ind':    STOCK_CARD_STYLE,
  Upstox:            STOCK_CARD_STYLE,
  Vested:            STOCK_CARD_STYLE,
  'IndMoney US':     STOCK_CARD_STYLE,
  'IndMoney Mummy':  STOCK_CARD_STYLE,
  MF_Vikash:         MF_CARD_STYLE,
  MF_Mahak:          MF_CARD_STYLE,
}

const TYPE_ACCENT: Record<string, string> = {
  indian_stock: '#10b981',
  us_stock:     '#0ea5e9',
  indian_mf:    '#f59e0b',
  us_mf:        '#8b5cf6',
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
  // Include fully-closed portfolios (realized gains exist but no open holdings)
  for (const key of rmap.keys()) {
    const port = key.slice(0, key.indexOf(':'))
    if (!agg.has(port) && !SKIP_PORTS.has(port)) {
      agg.set(port, { current: 0, invested: 0, todayGain: null })
    }
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

// Clean-symbol sets for realized-entry classification (rmap keys use clean symbol, not yf_symbol)
const US_ETF_CLEAN = new Set(['MON100', 'MAFANG'])
const US_MF_CLEAN  = new Set(['0P0001NCLP', '0P0001JMZB'])

function classifyClean(portfolio: string, sym: string): string {
  if (SKIP_PORTS.has(portfolio)) return 'skip'
  if (USD_PORTS.has(portfolio))  return 'us_stock'
  if (portfolio.startsWith('MF_')) return US_MF_CLEAN.has(sym) ? 'us_mf' : 'indian_mf'
  if (US_ETF_CLEAN.has(sym))     return 'us_stock'
  return 'indian_stock'
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
    // Classify each realized entry by (portfolio, cleanSymbol) to avoid double-counting
    // portfolios that span multiple segment types (e.g. Zerodha holds Indian stocks + MON100/MAFANG)
    let rg = 0, rc = 0
    for (const [mapKey, [g, c]] of rmap) {
      const ci   = mapKey.indexOf(':')
      const port = mapKey.slice(0, ci)
      const sym  = mapKey.slice(ci + 1)
      if (classifyClean(port, sym) === key) { rg += g; rc += c }
    }
    return { key, label, current, invested, realGain: rg, realCost: rc, todayGain, navPath: `/holdings/segment/${key}` }
  }).filter(Boolean) as CardStats[]
}

function isPos(v: number) { return v >= 0 }

function BreakCard({ card, currency, xirr, onClick, compact = false, accentColor, cardBg }: { card: CardStats; currency: Currency; xirr: number | null; onClick: () => void; compact?: boolean; accentColor?: string; cardBg?: string }) {
  const totalGain = (card.current - card.invested) + card.realGain
  const totalCost = card.invested + card.realCost
  const pct = totalCost !== 0 ? (totalGain / totalCost) * 100 : 0
  const pos = isPos(totalGain)
  const todayPrior = card.current - (card.todayGain ?? 0)
  const todayPct = card.todayGain !== null && todayPrior !== 0 ? (card.todayGain / todayPrior) * 100 : null

  const valSize  = compact ? 'text-[13px]' : 'text-[15px]'
  const lblSize  = compact ? 'text-[8px]'  : 'text-[9px]'
  const gainSize = compact ? 'text-[9px]'  : 'text-[10px]'
  const gap      = compact ? 'gap-0.5'     : 'gap-1'

  return (
    <div
      className="rounded-[10px] p-3 border cursor-pointer active:opacity-80 transition-opacity"
      style={{
        background:      cardBg ?? (pos ? '#f0fdf8' : '#fff5f5'),
        borderColor:     '#e2e8f0',
        borderLeftWidth: 4,
        borderLeftColor: accentColor ?? (pos ? '#10b981' : '#f43f5e'),
      }}
      onClick={onClick}
    >
      <p className={`${lblSize} font-bold text-slate-700 uppercase tracking-widest mb-1`}>{card.label}</p>
      <div className="flex items-baseline justify-between">
        <span className={`${valSize} font-bold text-slate-900 min-w-0`}>{fmt(card.current, currency)}</span>
        <span className={`flex items-center ${gap} shrink-0 whitespace-nowrap`}>
          <span className={`${lblSize} text-slate-400`}>Today</span>
          <span className={gainSize} style={{ color: card.todayGain !== null ? (card.todayGain >= 0 ? '#0a7a42' : '#be1c1c') : '#94a3b8' }}>
            {card.todayGain !== null ? fmtCompactGainLine(card.todayGain, todayPct, currency) : '—'}
          </span>
        </span>
      </div>
      <div className="flex items-center justify-between mt-0.5">
        {xirr !== null
          ? <span className={`${lblSize} font-semibold rounded-full px-1.5 py-0.5`} style={{ background: xirr >= 0 ? '#d1fae5' : '#fee2e2', color: xirr >= 0 ? '#065f46' : '#991b1b' }}>XIRR {fmtPct(xirr)}</span>
          : <span className={`${lblSize} text-slate-400`}>{fmtCompact(card.invested, currency)} inv</span>
        }
        <span className={`flex items-center ${gap} shrink-0 whitespace-nowrap`}>
          <span className={`${lblSize} text-slate-400`}>Total</span>
          <span className={gainSize} style={{ color: pos ? '#0a7a42' : '#be1c1c' }}>
            {fmtCompactGainLine(totalGain, pct, currency)}
          </span>
        </span>
      </div>
    </div>
  )
}

export default function PortfoliosPage({ currency, onCurrencyChange }: Props) {
  const navigate     = useNavigate()
  const { data, isLoading, error } = usePortfolio(currency)
  const forceRefresh  = useForceRefresh(currency)
  const [mode, setMode]       = useState<BreakdownMode>('type')
  const [pullY, setPullY]     = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [bannerVisible, setBannerVisible] = useState(false)
  const [refreshError, setRefreshError] = useState(false)
  const touchStartY           = useRef(0)
  const bannerTimer           = useRef<ReturnType<typeof setTimeout>>()
  const errorTimer            = useRef<ReturnType<typeof setTimeout>>()
  const PULL_THRESHOLD        = 64

  const handleRefresh = () => {
    setRefreshing(true)
    setRefreshError(false)
    setBannerVisible(true)
    clearTimeout(bannerTimer.current)
    bannerTimer.current = setTimeout(() => setBannerVisible(false), 1500)
    forceRefresh()
      .catch(() => {
        setRefreshError(true)
        clearTimeout(errorTimer.current)
        errorTimer.current = setTimeout(() => setRefreshError(false), 5000)
      })
      .finally(() => setRefreshing(false))
  }

  useEffect(() => () => { clearTimeout(bannerTimer.current); clearTimeout(errorTimer.current) }, [])

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
    let rg = 0, rc = 0
    for (const [mapKey, [g, c]] of rmap) {
      const ci  = mapKey.indexOf(':')
      const seg = classifyClean(mapKey.slice(0, ci), mapKey.slice(ci + 1))
      if (seg === 'indian_stock' || seg === 'us_stock') { rg += g; rc += c }
    }
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
    let rg = 0, rc = 0
    for (const [mapKey, [g, c]] of rmap) {
      const ci  = mapKey.indexOf(':')
      const seg = classifyClean(mapKey.slice(0, ci), mapKey.slice(ci + 1))
      if (seg === 'indian_mf' || seg === 'us_mf') { rg += g; rc += c }
    }
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
      // Build port:symbol → yf_symbol from all holdings (open positions)
      const yfMap = new Map<string, string>()
      for (const h of data.holdings) yfMap.set(`${h.portfolio}:${h.symbol}`, h.yf_symbol)

      for (const card of cards) {
        const cfs: { date: Date; amount: number }[] = []
        for (const tx of data.transactions) {
          if (tx.type === 'DIVIDEND') continue
          const yf  = yfMap.get(`${tx.portfolio}:${tx.symbol}`) ?? tx.symbol
          if (getSegmentType(tx.portfolio, yf) !== card.key) continue
          const isUsd = USD_PORTS.has(tx.portfolio)
          const fx = isUsd
            ? (currency === 'INR' ? data.usd_inr : 1)
            : (currency === 'USD' ? 1 / data.usd_inr : 1)
          const amt = tx.quantity * tx.price * fx
          const chg = (tx.charges ?? 0) * fx
          if (tx.type === 'BUY')  cfs.push({ date: new Date(tx.date), amount: -(amt + chg) })
          if (tx.type === 'SELL') cfs.push({ date: new Date(tx.date), amount:   amt - chg })
        }
        // Terminal value: open positions only
        const hs = active.filter(h => getSegmentType(h.portfolio, h.yf_symbol) === card.key)
        const totalCurrent = hs.reduce((s, h) => s + h.disp_current, 0)
        if (totalCurrent > 0) cfs.push({ date: today, amount: totalCurrent })
        const r = computeXIRR(cfs)
        map.set(card.key, r !== null ? r * 100 : null)
      }
    }
    return map
  }, [cards, data, mode, active, currency])

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY
  }
  const handleTouchMove = (e: React.TouchEvent) => {
    if (window.scrollY !== 0 || refreshing) return
    const dy = e.touches[0].clientY - touchStartY.current
    if (dy > 0) setPullY(Math.min(dy, PULL_THRESHOLD + 20))
  }
  const handleTouchEnd = () => {
    if (pullY >= PULL_THRESHOLD) handleRefresh()
    setPullY(0)
  }

  if (isLoading) return <LoadingSkeleton />
  if (error || !data) return <ErrorState message={(error as Error)?.message ?? 'Unknown error'} />

  const heroPos = isPos(hero.totalGain)

  return (
    <div
      className="max-w-xl mx-auto px-4 py-4 space-y-3"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {(pullY > 0 || bannerVisible) && (
        <div className="flex items-center justify-center text-[12px]" style={{ height: pullY > 0 ? Math.min(pullY * 0.6, 40) : 24 }}>
          <span className={bannerVisible || pullY >= PULL_THRESHOLD ? 'text-sky-400' : 'text-slate-400'}>
            {bannerVisible ? '↻ Refreshing…' : pullY >= PULL_THRESHOLD ? '↑ Release to refresh' : '↓ Pull to refresh'}
          </span>
        </div>
      )}

      {/* Page header */}
      <div className="flex items-center justify-between bg-gradient-to-r from-emerald-600 to-teal-500 rounded-xl px-4 py-1.5">
        <p className="text-[18px] font-bold text-white tracking-tight">Portfolio Manager</p>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className={`flex items-center gap-1.5 transition-colors ${refreshing ? 'text-white' : 'text-emerald-100 active:text-white'}`}
        >
          <span className={`text-[14px] leading-none ${refreshing ? 'animate-spin' : ''}`}>↻</span>
          <span className={`text-[9px] uppercase tracking-widest ${refreshError ? 'text-red-300' : ''}`}>
            {refreshError
              ? 'Sync failed · retry'
              : (() => { const d = new Date(data.as_of); const hh = String(d.getHours()).padStart(2,'0'); const mm = String(d.getMinutes()).padStart(2,'0'); const dd = String(d.getDate()).padStart(2,'0'); const mon = d.toLocaleString('en-US',{month:'short'}); return `${hh}:${mm} ${dd} ${mon}` })()}
          </span>
        </button>
      </div>

      {/* Hero card — Total Portfolio */}
      <div
        className="rounded-[12px] p-4 border cursor-pointer active:opacity-90 transition-opacity"
        style={{ background: 'linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%)', borderColor: '#99f6e4', borderLeftWidth: 4, borderLeftColor: '#0d9488' }}
        onClick={() => navigate('/holdings/segment/total')}
      >
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Total Portfolio</p>
        <div className="flex items-baseline justify-between">
          <span className="text-[24px] font-bold text-slate-800 min-w-0">{fmt(hero.cur, currency)}</span>
          <span className="flex items-center gap-1 shrink-0 whitespace-nowrap">
            <span className="text-[9px] text-slate-400">Today</span>
            <span className="text-[10px]" style={{ color: hero.todayGain >= 0 ? '#0d9488' : '#dc2626' }}>
              {hero.todayGain !== 0 ? fmtCompactGainLine(hero.todayGain, hero.todayPct, currency) : '—'}
            </span>
          </span>
        </div>
        <div className="flex items-center justify-between mt-1">
          {data.xirr_total !== null
            ? <span className="text-[9px] font-semibold rounded-full px-2 py-0.5" style={{ background: (data.xirr_total ?? 0) >= 0 ? 'rgba(13,148,136,0.15)' : 'rgba(220,38,38,0.12)', color: (data.xirr_total ?? 0) >= 0 ? '#0f766e' : '#b91c1c' }}>
                XIRR {fmtPct(data.xirr_total!)}
              </span>
            : <span className="text-[9px] text-slate-400">XIRR —</span>
          }
          <span className="flex items-center gap-1 shrink-0 whitespace-nowrap">
            <span className="text-[9px] text-slate-400">Total</span>
            <span className="text-[10px]" style={{ color: heroPos ? '#0d9488' : '#dc2626' }}>
              {fmtCompactGainLine(hero.totalGain, hero.returnPct, currency)}
            </span>
          </span>
        </div>
      </div>

      {/* Stocks + MF summary tiles — side by side */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'Stocks',       stats: stk, seg: 'stk', xirr: data.xirr_stk, tileBg: STOCK_CARD_STYLE.bg, tileAccent: STOCK_CARD_STYLE.accent },
          { label: 'Mutual Funds', stats: mf,  seg: 'mf',  xirr: data.xirr_mf,  tileBg: MF_CARD_STYLE.bg,  tileAccent: MF_CARD_STYLE.accent },
        ].map(({ label, stats, seg, xirr, tileBg, tileAccent }) => {
          const pos = isPos(stats.gain)
          const tc  = pos ? '#0a7a42' : '#be1c1c'
          const tgC = stats.todayGain !== null ? (stats.todayGain >= 0 ? '#0a7a42' : '#be1c1c') : '#94a3b8'
          return (
            <div
              key={seg}
              className="rounded-[10px] p-3 border cursor-pointer active:opacity-80 transition-opacity"
              style={{
                background:      tileBg,
                borderColor:     '#e2e8f0',
                borderLeftWidth: 4,
                borderLeftColor: tileAccent,
              }}
              onClick={() => navigate(`/holdings/segment/${seg}`)}
            >
              <p className="text-[9px] font-bold text-slate-700 uppercase tracking-widest mb-1">{label}</p>
              <div className="flex items-baseline justify-between">
                <span className="text-[13px] font-bold text-slate-900 min-w-0">{fmt(stats.cur, currency)}</span>
                <span className="flex items-center gap-0.5 shrink-0 whitespace-nowrap">
                  <span className="text-[8px] text-slate-400">Today</span>
                  <span className="text-[9px]" style={{ color: tgC }}>
                    {stats.todayGain !== 0 ? fmtCompactGainLine(stats.todayGain, stats.todayPct, currency) : '—'}
                  </span>
                </span>
              </div>
              <div className="flex items-center justify-between mt-0.5">
                {xirr !== null && xirr !== undefined
                  ? <span className="text-[8px] font-semibold" style={{ color: xirr >= 0 ? '#0a7a42' : '#be1c1c' }}>XIRR {fmtPct(xirr)}</span>
                  : <span className="text-[8px] text-slate-400">XIRR —</span>
                }
                <span className="flex items-center gap-0.5 shrink-0 whitespace-nowrap">
                  <span className="text-[8px] text-slate-400">Total</span>
                  <span className="text-[9px]" style={{ color: tc }}>
                    {fmtCompactGainLine(stats.gain, stats.pct, currency)}
                  </span>
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Breakdown toggle */}
      <div className="flex items-center justify-between px-0.5">
        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Breakdown</p>
        <div className="relative flex bg-slate-100 rounded-full p-[2px]">
          <div
            className="absolute top-[2px] bottom-[2px] w-1/2 rounded-full bg-white shadow-sm transition-transform duration-150"
            style={{ transform: `translateX(${mode === 'broker' ? '100%' : '0%'})` }}
          />
          {(['type', 'broker'] as BreakdownMode[]).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`relative z-10 flex-1 text-[10px] px-3 py-[4px] whitespace-nowrap transition-colors ${mode === m ? 'text-slate-700 font-semibold' : 'text-slate-400'}`}
            >
              {m === 'broker' ? 'By Broker' : 'By Type'}
            </button>
          ))}
        </div>
      </div>

      {/* Breakdown cards */}
      {mode === 'type' ? (
        <div className="space-y-3">
          {TYPE_GROUPS.map(group => {
            const gc = cards.filter(c => group.keys.includes(c.key))
            if (!gc.length) return null
            return (
              <div key={group.key}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: group.color }} />
                  <span className="text-[8px] font-semibold uppercase tracking-widest" style={{ color: group.color }}>{group.label}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {gc.map(card => (
                    <BreakCard key={card.key} card={card} currency={currency} xirr={cardXirrMap.get(card.key) ?? null} onClick={() => navigate(card.navPath)} compact accentColor={TYPE_CARD_STYLE[card.key]?.accent} cardBg={TYPE_CARD_STYLE[card.key]?.bg} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="space-y-3">
          {BROKER_GROUPS.map(group => {
            const gc = cards.filter(c => group.test(c.key))
            if (!gc.length) return null
            return (
              <div key={group.key}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: group.color }} />
                  <span className="text-[8px] font-semibold uppercase tracking-widest" style={{ color: group.color }}>{group.label}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {gc.map(card => (
                    <BreakCard key={card.key} card={card} currency={currency} xirr={cardXirrMap.get(card.key) ?? null} onClick={() => navigate(card.navPath)} compact accentColor={PORTFOLIO_CARD_STYLE[card.key]?.accent} cardBg={PORTFOLIO_CARD_STYLE[card.key]?.bg} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

    </div>
  )
}
