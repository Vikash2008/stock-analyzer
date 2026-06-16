import { useMemo, useRef, useState, useEffect, useCallback } from 'react'
import { useDividends, getIncludeDividends, setIncludeDividends, clearDividendLocalCache, getIncludeFxGains, setIncludeFxGains } from '../hooks/useDividends'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { usePortfolio, useForceRefresh } from '../hooks/usePortfolio'
import { usePrefetchHoldingCharts } from '../hooks/useHistory'
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

function BreakCard({ card, currency, xirr, onClick, compact = false, accentColor, cardBg, pillBlue = false, scale = 1, divGain = 0, fxGain = 0 }: { card: CardStats; currency: Currency; xirr: number | null; onClick: () => void; compact?: boolean; accentColor?: string; cardBg?: string; pillBlue?: boolean; scale?: number; divGain?: number; fxGain?: number }) {
  const totalGain = (card.current - card.invested) + card.realGain + divGain + fxGain
  const totalCost = card.invested + card.realCost
  const pct = totalCost !== 0 ? (totalGain / totalCost) * 100 : 0
  const pos = isPos(totalGain)
  const todayPrior = card.current - (card.todayGain ?? 0)
  const todayPct = card.todayGain !== null && todayPrior !== 0 ? (card.todayGain / todayPrior) * 100 : null

  const valSize  = compact ? 'text-[13px]' : 'text-[15px]'
  const lblSize  = compact ? 'text-[10px]'  : 'text-[10px]'
  const gainSize = compact ? 'text-[10px]'  : 'text-[10px]'
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
        <span className={`${valSize} font-bold text-slate-900 min-w-0`}>{fmt(card.current * scale, currency)}</span>
        <span className={`flex items-center ${gap} shrink-0 whitespace-nowrap`}>
          <span className={`flex items-center gap-[3px] ${lblSize} text-slate-400`}><svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{flexShrink:0}}><circle cx="6" cy="6" r="5"/><path d="M6 3.5v2.5l1.5 1"/></svg></span>
          <span className={gainSize} style={{ color: card.todayGain !== null ? (card.todayGain >= 0 ? '#0a7a42' : '#be1c1c') : '#94a3b8' }}>
            {card.todayGain !== null ? fmtCompactGainLine(card.todayGain * scale, todayPct, currency) : '—'}
          </span>
        </span>
      </div>
      <div className="flex items-center justify-between mt-0.5">
        {xirr !== null
          ? <span className={`${lblSize} font-semibold rounded-full px-1.5 py-0.5 shrink-0 -ml-1.5`} style={{ background: xirr >= 0 ? (pillBlue ? '#bfdbfe' : '#d1fae5') : '#fee2e2', color: xirr >= 0 ? (pillBlue ? '#1e40af' : '#065f46') : '#991b1b' }}>XIRR {fmtPct(xirr)}</span>
          : <span className={`${lblSize} text-slate-400`}>{fmtCompact(card.invested * scale, currency)} inv</span>
        }
        <span className={`flex items-center ${gap} shrink-0 whitespace-nowrap`}>
          <span className={`flex items-center gap-[3px] ${lblSize} text-slate-400`}><svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><path d="M9 2H3l3.5 4-3.5 4h6"/></svg></span>
          <span className={gainSize} style={{ color: pos ? '#0a7a42' : '#be1c1c' }}>
            {fmtCompactGainLine(totalGain * scale, pct, currency)}
          </span>
        </span>
      </div>
    </div>
  )
}

interface CsvMeta { name: string; size: number; importedAt: number }

function getCsvMeta(): CsvMeta | null {
  if (!localStorage.getItem('portfolio:csv')) return null
  try { return JSON.parse(localStorage.getItem('portfolio:csv:meta') || 'null') } catch { return null }
}
function fmtBytes(b: number) { return b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB` }
function fmtImportDate(ts: number) {
  const d = new Date(ts)
  const dd = String(d.getDate()).padStart(2,'0')
  const mon = d.toLocaleString('en-US',{month:'short'})
  const hh = String(d.getHours()).padStart(2,'0')
  const mm = String(d.getMinutes()).padStart(2,'0')
  return `${dd} ${mon} ${d.getFullYear()}, ${hh}:${mm}`
}

export default function PortfoliosPage({ currency, onCurrencyChange }: Props) {
  const navigate     = useNavigate()
  const qc           = useQueryClient()
  const { data, isLoading, error, isFetching } = usePortfolio(currency)
  const { data: divData } = useDividends()
  const forceRefresh  = useForceRefresh(currency)

  // Prefetch history for all holdings so chart tabs open instantly.
  // Runs in background — no-op for symbols already cached.
  const holdingSymbols = useMemo(
    () => data ? [...new Set(data.holdings.map((h: Holding) => h.yf_symbol))] : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data?.holdings.length],
  )
  usePrefetchHoldingCharts(holdingSymbols)
  const [mode, setMode]       = useState<BreakdownMode>(
    () => (localStorage.getItem('pp:mode') as BreakdownMode) ?? 'type'
  )
  useEffect(() => { localStorage.setItem('pp:mode', mode) }, [mode])
  const [pullY, setPullY]     = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [bannerVisible, setBannerVisible] = useState(false)
  const [refreshError, setRefreshError] = useState(false)

  // Settings panel
  const [settingsOpen, setSettingsOpen]     = useState(false)
  const [includeDivs, setIncludeDivs]           = useState(getIncludeDividends)
  const [includeFxGainsState, setIncludeFxGainsStateLocal] = useState(getIncludeFxGains)
  const [importProgress, setImportProgress] = useState<number | null>(null)
  const [importDone, setImportDone]         = useState(false)
  const [importStatus, setImportStatus]     = useState('')
  const [csvMeta, setCsvMeta]               = useState<CsvMeta | null>(getCsvMeta)
  const [sheetOpen, setSheetOpen]           = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const API_URL_SETTINGS = (import.meta.env.VITE_API_URL ?? '') as string

  const handleImport = useCallback((file: File) => {
    setImportProgress(0)
    setImportDone(false)
    setImportStatus('Reading rows…')
    const reader = new FileReader()
    reader.onload = async (e) => {
      const text = e.target?.result as string
      const meta: CsvMeta = { name: file.name, size: file.size, importedAt: Date.now() }

      // Persist CSV — remove old entry first (frees the largest item), then retry with full eviction if needed
      setImportProgress(15)
      localStorage.removeItem('portfolio:csv')
      localStorage.removeItem('portfolio:csv:hash')
      try {
        localStorage.setItem('portfolio:csv', text)
      } catch {
        for (const k of Object.keys(localStorage)) {
          if (k.startsWith('gemini:') || k.startsWith('dividends:cache:') || k.startsWith('history:')) {
            localStorage.removeItem(k)
          }
        }
        try { localStorage.setItem('portfolio:csv', text) } catch { /* quota still exceeded */ }
      }
      try { localStorage.setItem('portfolio:csv:meta', JSON.stringify(meta)); setCsvMeta(meta) } catch {}

      clearDividendLocalCache()
      qc.removeQueries({ queryKey: ['dividends'] })

      setImportProgress(30)
      setImportStatus('Running FIFO calculations…')

      // Step through status messages while backend processes
      const t1 = setTimeout(() => { setImportProgress(50); setImportStatus('Fetching latest prices…') }, 6_000)
      const t2 = setTimeout(() => { setImportProgress(70) },                                              25_000)
      const t3 = setTimeout(() => { setImportProgress(85); setImportStatus('Almost done…') },             55_000)
      const t4 = setTimeout(() => { setImportProgress(93) },                                              90_000)
      const clearTimers = () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4) }

      const controller = new AbortController()
      const abortTimer = setTimeout(() => controller.abort(), 120_000)
      try {
        const params = new URLSearchParams({ currency: 'INR', force_refresh: 'true' })
        const res = await fetch(`${API_URL_SETTINGS}/api/portfolio?${params}`, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: text,
          signal: controller.signal,
        })
        clearTimeout(abortTimer)
        if (res.ok) {
          const newData = await res.json()
          if (newData.csv_hash) {
            try { localStorage.setItem('portfolio:csv:hash', newData.csv_hash) } catch {}
          }
          qc.setQueryData(['portfolio'], newData)
        }
      } catch { /* timed out or network error — CSV in localStorage, next load will retry */ }
      finally {
        clearTimeout(abortTimer)
        clearTimers()
        setImportProgress(100)
        setImportStatus('')
        setImportDone(true)
        setTimeout(() => { setImportProgress(null); setImportDone(false); setSettingsOpen(false) }, 1200)
      }
    }
    reader.readAsText(file)
  }, [currency, qc, API_URL_SETTINGS])

  const handleDownload = useCallback(() => {
    const csv = localStorage.getItem('portfolio:csv')
    if (csv) {
      const blob = new Blob([csv], { type: 'text/csv' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = csvMeta?.name ?? 'portfolio.csv'
      a.click()
      URL.revokeObjectURL(url)
    } else {
      // Download demo CSV from backend
      window.open(`${API_URL_SETTINGS}/api/demo-csv`, '_blank')
    }
  }, [csvMeta, API_URL_SETTINGS])

  // Explore New Holdings
  const API_URL = (import.meta.env.VITE_API_URL ?? '') as string
  const [exploreInput,    setExploreInput]    = useState('')
  const [recentSearches,  setRecentSearches]  = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('research:recent') || '[]') } catch { return [] }
  })
  const [suggestions,     setSuggestions]     = useState<{ symbol: string; name: string; exchange: string }[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isSearching,     setIsSearching]     = useState(false)
  const [inputFocused,    setInputFocused]    = useState(false)

  // Wake Render on mount — backend sleeps after inactivity; fire cheap ping so
  // search is responsive by the time user types instead of waiting 60-90s cold start
  useEffect(() => {
    fetch(`${API_URL}/api/search?q=a`).catch(() => {})
  }, [])

  useEffect(() => {
    const q = exploreInput.trim()
    if (q.length < 1) { setSuggestions([]); setIsSearching(false); return }
    const controller = new AbortController()
    setIsSearching(true)
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`${API_URL}/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        if (res.ok) { setSuggestions(await res.json()); setShowSuggestions(true) }
      } catch { /* aborted by next keystroke — ignore */ }
      finally { if (!controller.signal.aborted) setIsSearching(false) }
    }, 300)
    return () => { clearTimeout(id); controller.abort() }
  }, [exploreInput])

  function navigateToResearch(sym: string, name?: string) {
    const trimmed = sym.trim().toUpperCase()
    if (!trimmed) return
    const updated = [trimmed, ...recentSearches.filter(s => s !== trimmed)].slice(0, 5)
    setRecentSearches(updated)
    localStorage.setItem('research:recent', JSON.stringify(updated))
    setSuggestions([])
    setShowSuggestions(false)
    setExploreInput('')
    setSheetOpen(false)
    navigate(`/research/${encodeURIComponent(trimmed)}`, { state: name ? { name } : undefined })
  }

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
    const totalDivs   = (includeDivs && divData) ? divData.by_symbol.reduce((sum, s) => sum + s.total_dividends, 0) : 0
    const totalFxGain = includeFxGainsState
      ? active.filter(h => USD_PORTS.has(h.portfolio)).reduce((s, h) => s + (h.disp_fx_gain ?? 0), 0)
      : 0
    const totalGain = (cur - inv) + rg + totalDivs + totalFxGain
    const totalCost = inv + rc
    const prior = cur - todayGain
    return {
      cur, inv, totalGain,
      returnPct:  totalCost !== 0 ? totalGain / totalCost * 100 : 0,
      todayGain,
      todayPct:   todayGain !== 0 && prior !== 0 ? (todayGain / prior) * 100 : null,
    }
  }, [active, rmap, includeDivs, divData, includeFxGainsState])

  // Stocks + MF tile XIRR: recompute client-side with dividends when toggle is ON
  const stkXirr = useMemo(() => {
    if (!data) return null
    if (!includeDivs && !includeFxGainsState) return data.xirr_stk ?? null
    const today = new Date()
    const cfs: { date: Date; amount: number }[] = []
    const yfMap = new Map<string, string>()
    for (const h of data.holdings) yfMap.set(`${h.portfolio}:${h.symbol}`, h.yf_symbol)
    for (const tx of data.transactions) {
      if (tx.type === 'DIVIDEND' || SKIP_PORTS.has(tx.portfolio)) continue
      const yf  = yfMap.get(`${tx.portfolio}:${tx.symbol}`) ?? tx.symbol
      const seg = getSegmentType(tx.portfolio, yf)
      if (seg !== 'indian_stock' && seg !== 'us_stock') continue
      const isUsd = USD_PORTS.has(tx.portfolio)
      const fx = isUsd
        ? (includeFxGainsState && tx.type === 'BUY' && tx.buy_fx_rate && tx.buy_fx_rate > 10 ? tx.buy_fx_rate : data.usd_inr)
        : 1
      const amt = tx.quantity * tx.price * fx
      const chg = (tx.charges ?? 0) * fx
      if (tx.type === 'BUY')  cfs.push({ date: new Date(tx.date), amount: -(amt + chg) })
      if (tx.type === 'SELL') cfs.push({ date: new Date(tx.date), amount:   amt - chg })
    }
    if (includeDivs && divData) {
      for (const s of divData.by_symbol) {
        const tx = data.transactions.find(t => t.symbol === s.symbol)
        const seg = tx ? getSegmentType(tx.portfolio, s.yf_symbol) : getSegmentType('', s.yf_symbol)
        if (seg !== 'indian_stock' && seg !== 'us_stock') continue
        for (const ev of s.events) cfs.push({ date: new Date(ev.ex_date), amount: ev.amount })
      }
    }
    const totalCurrent = filterBySegment(active, 'stk').reduce((s, h) => s + h.disp_current, 0)
    if (totalCurrent > 0) cfs.push({ date: today, amount: totalCurrent })
    const r = computeXIRR(cfs)
    return r !== null ? r * 100 : null
  }, [data, divData, includeDivs, includeFxGainsState, active])

  const mfXirr = useMemo(() => {
    if (!data) return null
    if (!includeDivs || !divData) return data.xirr_mf ?? null
    const today = new Date()
    const cfs: { date: Date; amount: number }[] = []
    const yfMap = new Map<string, string>()
    for (const h of data.holdings) yfMap.set(`${h.portfolio}:${h.symbol}`, h.yf_symbol)
    for (const tx of data.transactions) {
      if (tx.type === 'DIVIDEND' || SKIP_PORTS.has(tx.portfolio)) continue
      const yf  = yfMap.get(`${tx.portfolio}:${tx.symbol}`) ?? tx.symbol
      const seg = getSegmentType(tx.portfolio, yf)
      if (seg !== 'indian_mf' && seg !== 'us_mf') continue
      const isUsd = USD_PORTS.has(tx.portfolio)
      const fx = isUsd ? data.usd_inr : 1
      const amt = tx.quantity * tx.price * fx
      const chg = (tx.charges ?? 0) * fx
      if (tx.type === 'BUY')  cfs.push({ date: new Date(tx.date), amount: -(amt + chg) })
      if (tx.type === 'SELL') cfs.push({ date: new Date(tx.date), amount:   amt - chg })
    }
    for (const s of divData.by_symbol) {
      const tx = data.transactions.find(t => t.symbol === s.symbol)
      const seg = tx ? getSegmentType(tx.portfolio, s.yf_symbol) : getSegmentType('', s.yf_symbol)
      if (seg !== 'indian_mf' && seg !== 'us_mf') continue
      for (const ev of s.events) cfs.push({ date: new Date(ev.ex_date), amount: ev.amount })
    }
    const totalCurrent = filterBySegment(active, 'mf').reduce((s, h) => s + h.disp_current, 0)
    if (totalCurrent > 0) cfs.push({ date: today, amount: totalCurrent })
    const r = computeXIRR(cfs)
    return r !== null ? r * 100 : null
  }, [data, divData, includeDivs, active])

  // Hero XIRR: recompute client-side with dividends / FX buy-rate when toggles are ON
  const heroXirr = useMemo(() => {
    if (!data) return null
    if (!includeDivs && !includeFxGainsState) return data.xirr_total ?? null
    const today = new Date()
    const cfs: { date: Date; amount: number }[] = []
    for (const tx of data.transactions) {
      if (tx.type === 'DIVIDEND' || SKIP_PORTS.has(tx.portfolio)) continue
      const isUsd = USD_PORTS.has(tx.portfolio)
      const fx = isUsd
        ? (includeFxGainsState && tx.type === 'BUY' && tx.buy_fx_rate && tx.buy_fx_rate > 10 ? tx.buy_fx_rate : data.usd_inr)
        : 1
      const amt = tx.quantity * tx.price * fx
      const chg = (tx.charges ?? 0) * fx
      if (tx.type === 'BUY')  cfs.push({ date: new Date(tx.date), amount: -(amt + chg) })
      if (tx.type === 'SELL') cfs.push({ date: new Date(tx.date), amount:   amt - chg })
    }
    if (includeDivs && divData) {
      for (const ev of divData.timeline) cfs.push({ date: new Date(ev.date), amount: ev.amount })
    }
    const totalCurrent = active.reduce((s, h) => s + h.disp_current, 0)
    if (totalCurrent > 0) cfs.push({ date: today, amount: totalCurrent })
    const r = computeXIRR(cfs)
    return r !== null ? r * 100 : null
  }, [data, divData, includeDivs, includeFxGainsState, active])

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
    const stkDivs = (includeDivs && divData && data)
      ? divData.by_symbol
          .filter(s => { const tx = data.transactions.find(t => t.symbol === s.symbol); const seg = tx ? getSegmentType(tx.portfolio, s.yf_symbol) : getSegmentType('', s.yf_symbol); return seg === 'indian_stock' || seg === 'us_stock' })
          .reduce((sum, s) => sum + s.total_dividends, 0)
      : 0
    const stkFxGain = includeFxGainsState
      ? hs.filter(h => USD_PORTS.has(h.portfolio)).reduce((s, h) => s + (h.disp_fx_gain ?? 0), 0)
      : 0
    const gain = (cur - inv) + rg + stkDivs + stkFxGain
    const cost = inv + rc
    const prior = cur - tg
    return { cur, inv, gain, pct: cost !== 0 ? gain / cost * 100 : 0, todayGain: tg, todayPct: tg !== 0 && prior !== 0 ? (tg / prior) * 100 : null }
  }, [active, rmap, includeDivs, divData, data, includeFxGainsState])

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
    const mfDivs = (includeDivs && divData && data)
      ? divData.by_symbol
          .filter(s => { const tx = data.transactions.find(t => t.symbol === s.symbol); const seg = tx ? getSegmentType(tx.portfolio, s.yf_symbol) : getSegmentType('', s.yf_symbol); return seg === 'indian_mf' || seg === 'us_mf' })
          .reduce((sum, s) => sum + s.total_dividends, 0)
      : 0
    const gain = (cur - inv) + rg + mfDivs
    const cost = inv + rc
    const prior = cur - tg
    return { cur, inv, gain, pct: cost !== 0 ? gain / cost * 100 : 0, todayGain: tg, todayPct: tg !== 0 && prior !== 0 ? (tg / prior) * 100 : null }
  }, [active, rmap, includeDivs, divData, data])

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
      // Per-portfolio dividend cash flows: proportioned by shares held at each ex-date
      const divCfsByPort = new Map<string, { date: Date; amount: number }[]>()
      if (includeDivs && divData) {
        for (const s of divData.by_symbol) {
          for (const ev of s.events) {
            const exDate = new Date(ev.ex_date)
            const portShares = new Map<string, number>()
            for (const tx of data.transactions) {
              if (tx.symbol !== s.symbol || SKIP_PORTS.has(tx.portfolio)) continue
              if (new Date(tx.date) > exDate) continue
              const curr = portShares.get(tx.portfolio) ?? 0
              if (tx.type === 'BUY')  portShares.set(tx.portfolio, curr + tx.quantity)
              if (tx.type === 'SELL') portShares.set(tx.portfolio, curr - tx.quantity)
            }
            let totalShares = 0
            for (const [, qty] of portShares) if (qty > 0) totalShares += qty
            if (totalShares > 0) {
              for (const [port, qty] of portShares) {
                if (qty <= 0) continue
                const bucket = divCfsByPort.get(port) ?? []
                bucket.push({ date: exDate, amount: ev.amount * (qty / totalShares) })
                divCfsByPort.set(port, bucket)
              }
            }
          }
        }
      }
      for (const card of cards) {
        if (!includeDivs && !includeFxGainsState) {
          const v = data.xirr_by_portfolio[card.key]
          map.set(card.key, v !== undefined ? v : null)
        } else {
          const cfs: { date: Date; amount: number }[] = []
          for (const tx of data.transactions) {
            if (tx.type === 'DIVIDEND' || tx.portfolio !== card.key) continue
            const isUsd = USD_PORTS.has(tx.portfolio)
            const fx = isUsd
              ? (includeFxGainsState && tx.type === 'BUY' && tx.buy_fx_rate && tx.buy_fx_rate > 10 ? tx.buy_fx_rate : data.usd_inr)
              : 1
            const amt = tx.quantity * tx.price * fx
            const chg = (tx.charges ?? 0) * fx
            if (tx.type === 'BUY')  cfs.push({ date: new Date(tx.date), amount: -(amt + chg) })
            if (tx.type === 'SELL') cfs.push({ date: new Date(tx.date), amount:   amt - chg })
          }
          if (includeDivs) {
            for (const ev of divCfsByPort.get(card.key) ?? []) cfs.push(ev)
          }
          const totalCurrent = active.filter(h => h.portfolio === card.key)
            .reduce((s, h) => s + h.disp_current, 0)
          if (totalCurrent > 0) cfs.push({ date: today, amount: totalCurrent })
          const r = computeXIRR(cfs)
          map.set(card.key, r !== null ? r * 100 : null)
        }
      }
    } else {
      // Build port:symbol → yf_symbol from all holdings (open positions)
      const yfMap = new Map<string, string>()
      for (const h of data.holdings) yfMap.set(`${h.portfolio}:${h.symbol}`, h.yf_symbol)
      // Dividend events grouped by segment type
      const divEventsBySegment = new Map<string, { date: Date; amount: number }[]>()
      if (includeDivs && divData) {
        for (const s of divData.by_symbol) {
          // Use any transaction to infer portfolio for this symbol (to get segment type)
          const firstTx = data.transactions.find(t => t.symbol === s.symbol)
          const segKey = firstTx ? getSegmentType(firstTx.portfolio, s.yf_symbol) : getSegmentType('', s.yf_symbol)
          const bucket = divEventsBySegment.get(segKey) ?? []
          for (const ev of s.events) bucket.push({ date: new Date(ev.ex_date), amount: ev.amount })
          divEventsBySegment.set(segKey, bucket)
        }
      }

      for (const card of cards) {
        const cfs: { date: Date; amount: number }[] = []
        for (const tx of data.transactions) {
          if (tx.type === 'DIVIDEND') continue
          const yf  = yfMap.get(`${tx.portfolio}:${tx.symbol}`) ?? tx.symbol
          if (getSegmentType(tx.portfolio, yf) !== card.key) continue
          const isUsd = USD_PORTS.has(tx.portfolio)
          const fx = isUsd
            ? (currency === 'INR'
                ? (includeFxGainsState && tx.type === 'BUY' && tx.buy_fx_rate && tx.buy_fx_rate > 10 ? tx.buy_fx_rate : data.usd_inr)
                : 1)
            : (currency === 'USD' ? 1 / data.usd_inr : 1)
          const amt = tx.quantity * tx.price * fx
          const chg = (tx.charges ?? 0) * fx
          if (tx.type === 'BUY')  cfs.push({ date: new Date(tx.date), amount: -(amt + chg) })
          if (tx.type === 'SELL') cfs.push({ date: new Date(tx.date), amount:   amt - chg })
        }
        if (includeDivs) {
          for (const ev of divEventsBySegment.get(card.key) ?? []) cfs.push(ev)
        }
        // Terminal value: open positions only
        const hs = active.filter(h => getSegmentType(h.portfolio, h.yf_symbol) === card.key)
        const totalCurrent = hs.reduce((s, h) => s + (currency === 'USD' ? h.disp_current / data.usd_inr : h.disp_current), 0)
        if (totalCurrent > 0) cfs.push({ date: today, amount: totalCurrent })
        const r = computeXIRR(cfs)
        map.set(card.key, r !== null ? r * 100 : null)
      }
    }
    return map
  }, [cards, data, mode, active, currency, includeDivs, divData, includeFxGainsState])

  // Dividend gain per card for BreakCard total returns display
  const cardDivGainMap = useMemo(() => {
    const map = new Map<string, number>()
    if (!includeDivs || !divData || !data) return map
    if (mode !== 'broker') {
      // Type mode: group by segment key using total_dividends (INR, correct amount)
      for (const s of divData.by_symbol) {
        const tx = data.transactions.find(t => t.symbol === s.symbol)
        const segKey = tx ? getSegmentType(tx.portfolio, s.yf_symbol) : getSegmentType('', s.yf_symbol)
        map.set(segKey, (map.get(segKey) ?? 0) + s.total_dividends)
      }
    } else {
      // Broker mode: proportion by shares held at each ex-date (same logic as divCfsByPort)
      for (const s of divData.by_symbol) {
        for (const ev of s.events) {
          const exDate = new Date(ev.ex_date)
          const portShares = new Map<string, number>()
          for (const tx of data.transactions) {
            if (tx.symbol !== s.symbol || SKIP_PORTS.has(tx.portfolio)) continue
            if (new Date(tx.date) > exDate) continue
            const curr = portShares.get(tx.portfolio) ?? 0
            if (tx.type === 'BUY')  portShares.set(tx.portfolio, curr + tx.quantity)
            if (tx.type === 'SELL') portShares.set(tx.portfolio, curr - tx.quantity)
          }
          let totalShares = 0
          for (const [, qty] of portShares) if (qty > 0) totalShares += qty
          if (totalShares <= 0) continue
          for (const [port, qty] of portShares) {
            if (qty <= 0) continue
            map.set(port, (map.get(port) ?? 0) + ev.amount * (qty / totalShares))
          }
        }
      }
    }
    return map
  }, [includeDivs, divData, data, mode])

  // FX gain per card (simpler — fx_gain is pre-computed per holding by backend)
  const cardFxGainMap = useMemo(() => {
    const map = new Map<string, number>()
    if (!includeFxGainsState || !data) return map
    for (const h of active) {
      if (h.currency !== 'USD' || !h.disp_fx_gain) continue
      const key = mode === 'broker' ? h.portfolio : getSegmentType(h.portfolio, h.yf_symbol)
      map.set(key, (map.get(key) ?? 0) + h.disp_fx_gain)
    }
    return map
  }, [includeFxGainsState, data, active, mode])

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
  const usdScale = (isUsd: boolean) => isUsd && currency === 'USD' ? 1 / data.usd_inr : 1
  const usdCur   = (isUsd: boolean): Currency => isUsd && currency === 'USD' ? 'USD' : 'INR'

  return (
    <div
      className="max-w-xl mx-auto px-4 py-4 pb-24 space-y-3"
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
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing || isFetching}
            className={`flex items-center gap-1.5 transition-colors ${(refreshing || isFetching) ? 'text-white' : 'text-emerald-100 active:text-white'}`}
          >
            <span className={`text-[14px] leading-none ${(refreshing || isFetching) ? 'animate-spin' : ''}`}>↻</span>
            <span className={`text-[10px] uppercase tracking-widest ${refreshError ? 'text-red-300' : ''}`}>
              {refreshError
                ? 'Sync failed · retry'
                : (() => { const d = new Date(data.as_of); const hh = String(d.getHours()).padStart(2,'0'); const mm = String(d.getMinutes()).padStart(2,'0'); const dd = String(d.getDate()).padStart(2,'0'); const mon = d.toLocaleString('en-US',{month:'short'}); return `${hh}:${mm} ${dd} ${mon}` })()}
            </span>
          </button>
          <div className="relative">
            <button
              onClick={() => setSettingsOpen(v => !v)}
              className="text-emerald-100 active:text-white p-1 -mr-1 min-h-[44px] flex items-center"
              aria-label="Portfolio settings"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 0 0-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 0 0-2.282.819l-.922 1.597a1.875 1.875 0 0 0 .432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 0 0 0 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 0 0-.432 2.385l.922 1.597a1.875 1.875 0 0 0 2.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.985.57.182.088.277.228.297.35l.178 1.071c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.673-.356.985-.57.167-.114.335-.125.45-.082l1.02.382a1.875 1.875 0 0 0 2.28-.819l.923-1.597a1.875 1.875 0 0 0-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 0 0 0-1.139c-.016-.2.059-.352.153-.43l.84-.692c.708-.582.891-1.59.433-2.385l-.922-1.597a1.875 1.875 0 0 0-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 0 0-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 0 0-1.85-1.567h-1.843ZM12 15.75a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z" clipRule="evenodd" />
              </svg>
            </button>

            {/* Settings popover — anchored below gear icon */}
            {settingsOpen && (
              <>
                <div className="fixed inset-0 z-[998] bg-black/40" onClick={() => { if (importProgress === null) setSettingsOpen(false) }} />
                <div className="absolute top-full right-0 z-[999] mt-1 w-80 rounded-2xl shadow-xl overflow-hidden border border-emerald-100">

                  {/* Modal header */}
                  <div className="bg-gradient-to-r from-emerald-600 to-teal-500 px-4 py-2 flex items-center justify-between">
                    <p className="text-[13px] font-semibold text-white tracking-tight">Settings</p>
                    <button onClick={() => setSettingsOpen(false)} className="text-emerald-200 active:text-white text-lg leading-none">×</button>
                  </div>

                  {/* Rows */}
                  <div className="bg-white p-2 flex flex-col gap-2">

                    {/* ── Data ── */}
                    <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-widest px-1 pt-0.5">Data</p>
                    <div className="flex flex-col gap-1">

                      {/* Import CSV — first */}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleImport(f); e.target.value = '' }}
                      />
                      <div className="px-3 py-2 bg-emerald-50 border border-emerald-100 rounded-lg">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[12px] font-medium text-slate-700 leading-tight">Import CSV</p>
                            <p className="text-[11px] text-slate-400 leading-tight mt-0.5">
                              {importProgress !== null
                                ? (importDone ? '✓ Updated' : importStatus)
                                : 'Replace portfolio data'}
                            </p>
                          </div>
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={importProgress !== null}
                            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-emerald-200 text-emerald-700 active:bg-emerald-300 disabled:opacity-40"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                              <polyline points="17 8 12 3 7 8"/>
                              <line x1="12" y1="3" x2="12" y2="15"/>
                            </svg>
                          </button>
                        </div>
                        {importProgress !== null && (
                          <div className="mt-2 h-1 bg-emerald-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full transition-all duration-200"
                              style={{ width: `${importProgress}%` }}
                            />
                          </div>
                        )}
                      </div>

                      {/* Portfolio file */}
                      <div className="px-3 py-2 flex items-center justify-between gap-3 bg-emerald-50 border border-emerald-100 rounded-lg">
                        <div className="min-w-0">
                          <p className="text-[12px] font-medium text-slate-700 leading-tight">Portfolio file</p>
                          <p className="text-[11px] text-slate-400 leading-tight mt-0.5 truncate">
                            {csvMeta ? `${csvMeta.name} · ${fmtBytes(csvMeta.size)}` : 'Demo Data · Sample portfolio'}
                          </p>
                        </div>
                        <button
                          onClick={handleDownload}
                          title={`Download ${csvMeta ? 'CSV' : 'Demo CSV'}`}
                          className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-slate-200 text-slate-600 active:bg-slate-300"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                            <polyline points="7 10 12 15 17 10"/>
                            <line x1="12" y1="15" x2="12" y2="3"/>
                          </svg>
                        </button>
                      </div>

                      {/* Demo file */}
                      <div className="px-3 py-2 flex items-center justify-between gap-3 bg-emerald-50 border border-emerald-100 rounded-lg">
                        <div className="min-w-0">
                          <p className="text-[12px] font-medium text-slate-700 leading-tight">Demo file</p>
                          <p className="text-[11px] text-slate-400 leading-tight mt-0.5">Sample portfolio · ~1 Cr · 32 stocks</p>
                        </div>
                        <button
                          onClick={() => window.open(`${API_URL_SETTINGS}/api/demo-csv`, '_blank')}
                          title="Download demo CSV"
                          className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-slate-200 text-slate-600 active:bg-slate-300"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                            <polyline points="7 10 12 15 17 10"/>
                            <line x1="12" y1="15" x2="12" y2="3"/>
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* ── Configuration ── */}
                    <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-widest px-1 pt-0.5">Configuration</p>
                    <div className="flex flex-col gap-1">

                      {/* Dividends toggle */}
                      <div className="px-3 py-2 flex items-center justify-between gap-2 bg-emerald-50 border border-emerald-100 rounded-lg">
                        <div>
                          <p className="text-[12px] font-medium text-slate-700 leading-tight">Include dividends</p>
                          <p className="text-[11px] text-slate-400 leading-tight mt-0.5">Add to total gains &amp; XIRR</p>
                        </div>
                        <button
                          role="switch"
                          aria-checked={includeDivs}
                          onClick={() => {
                            const next = !includeDivs
                            setIncludeDivs(next)
                            setIncludeDividends(next)
                            window.dispatchEvent(new Event('dividends-toggle'))
                          }}
                          className={`relative shrink-0 w-9 h-5 rounded-full transition-colors duration-200 focus:outline-none ${includeDivs ? 'bg-teal-500' : 'bg-slate-300'}`}
                        >
                          <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${includeDivs ? 'translate-x-4' : 'translate-x-0'}`} />
                        </button>
                      </div>

                      {/* FX Gains toggle */}
                      <div className="px-3 py-2 flex items-center justify-between gap-2 bg-emerald-50 border border-emerald-100 rounded-lg">
                        <div>
                          <p className="text-[12px] font-medium text-slate-700 leading-tight">Include FX gains</p>
                          <p className="text-[11px] text-slate-400 leading-tight mt-0.5">USD rate effect on returns</p>
                        </div>
                        <button
                          role="switch"
                          aria-checked={includeFxGainsState}
                          onClick={() => {
                            const next = !includeFxGainsState
                            setIncludeFxGainsStateLocal(next)
                            setIncludeFxGains(next)
                            window.dispatchEvent(new Event('fxgains-toggle'))
                          }}
                          className={`relative shrink-0 w-9 h-5 rounded-full transition-colors duration-200 focus:outline-none ${includeFxGainsState ? 'bg-teal-500' : 'bg-slate-300'}`}
                        >
                          <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${includeFxGainsState ? 'translate-x-4' : 'translate-x-0'}`} />
                        </button>
                      </div>

                      {/* Currency toggle */}
                      <div className="px-3 py-2 flex items-center justify-between gap-2 bg-emerald-50 border border-emerald-100 rounded-lg">
                        <div>
                          <p className="text-[12px] font-medium text-slate-700 leading-tight">Display currency</p>
                          <p className="text-[11px] text-slate-400 leading-tight mt-0.5 whitespace-nowrap">Switch values to USD or INR</p>
                        </div>
                        <div className="shrink-0 flex items-center gap-0.5 bg-emerald-100 rounded-lg p-0.5">
                          <button
                            onClick={() => onCurrencyChange('INR')}
                            className={`whitespace-nowrap px-2 py-1 rounded-md text-[11px] font-semibold transition-colors ${currency === 'INR' ? 'bg-emerald-600 text-white shadow-sm' : 'text-emerald-500 active:text-emerald-700'}`}
                          >₹ INR</button>
                          <button
                            onClick={() => onCurrencyChange('USD')}
                            className={`whitespace-nowrap px-2 py-1 rounded-md text-[11px] font-semibold transition-colors ${currency === 'USD' ? 'bg-emerald-600 text-white shadow-sm' : 'text-emerald-500 active:text-emerald-700'}`}
                          >$ USD</button>
                        </div>
                      </div>
                    </div>

                    {/* ── Updated on ── */}
                    <div className="mt-0.5 pt-2.5 border-t border-slate-100 flex items-center justify-between px-1">
                      <span className="text-[10px] text-slate-400">Updated on</span>
                      <span className="text-[10px] text-slate-400 text-right">
                        v{__APP_VERSION__} · {new Date(__BUILD_TIME__).toLocaleString('en-GB', {
                          day: 'numeric', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit', hour12: false,
                          timeZone: 'Asia/Kolkata',
                        })} IST
                      </span>
                    </div>

                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Hero card — Total Portfolio */}
      <div
        className="rounded-[12px] p-4 border cursor-pointer active:opacity-90 transition-opacity"
        style={{ background: 'linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%)', borderColor: '#99f6e4', borderLeftWidth: 4, borderLeftColor: '#0d9488' }}
        onClick={() => navigate('/holdings/segment/total')}
      >
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Total Portfolio</p>
        <div className="flex items-baseline justify-between">
          <span className="text-[24px] font-bold text-slate-800 min-w-0">{fmt(hero.cur, 'INR')}</span>
          <span className="flex items-center gap-1 shrink-0 whitespace-nowrap">
            <span className="flex items-center gap-[3px] text-[10px] text-slate-400"><svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{flexShrink:0}}><circle cx="6" cy="6" r="5"/><path d="M6 3.5v2.5l1.5 1"/></svg></span>
            <span className="text-[10px]" style={{ color: hero.todayGain >= 0 ? '#0d9488' : '#dc2626' }}>
              {hero.todayGain !== 0 ? fmtCompactGainLine(hero.todayGain, hero.todayPct, 'INR') : '—'}
            </span>
          </span>
        </div>
        <div className="flex items-center justify-between mt-1">
          {heroXirr !== null
            ? <span className="text-[10px] font-semibold rounded-full px-2 py-0.5" style={{ background: (heroXirr ?? 0) >= 0 ? 'rgba(13,148,136,0.15)' : 'rgba(220,38,38,0.12)', color: (heroXirr ?? 0) >= 0 ? '#0f766e' : '#b91c1c' }}>
                XIRR {fmtPct(heroXirr!)}
              </span>
            : <span className="text-[10px] text-slate-400">XIRR —</span>
          }
          <span className="flex items-center gap-1 shrink-0 whitespace-nowrap">
            <span className="flex items-center gap-[3px] text-[10px] text-slate-400"><svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><path d="M9 2H3l3.5 4-3.5 4h6"/></svg></span>
            <span className="text-[10px]" style={{ color: heroPos ? '#0d9488' : '#dc2626' }}>
              {fmtCompactGainLine(hero.totalGain, hero.returnPct, 'INR')}
            </span>
          </span>
        </div>
      </div>

      {/* Stocks + MF summary tiles — side by side */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'Stocks',       stats: stk, seg: 'stk', xirr: stkXirr, tileBg: STOCK_CARD_STYLE.bg, tileAccent: STOCK_CARD_STYLE.accent },
          { label: 'Mutual Funds', stats: mf,  seg: 'mf',  xirr: mfXirr,  tileBg: MF_CARD_STYLE.bg,  tileAccent: MF_CARD_STYLE.accent },
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
              <p className="text-[10px] font-bold text-slate-700 uppercase tracking-widest mb-1">{label}</p>
              <div className="flex items-baseline justify-between">
                <span className="text-[13px] font-bold text-slate-900 min-w-0">{fmt(stats.cur, 'INR')}</span>
                <span className="flex items-center gap-0.5 shrink-0 whitespace-nowrap">
                  <span className="flex items-center gap-[3px] text-[10px] text-slate-400"><svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{flexShrink:0}}><circle cx="6" cy="6" r="5"/><path d="M6 3.5v2.5l1.5 1"/></svg></span>
                  <span className="text-[10px]" style={{ color: tgC }}>
                    {stats.todayGain !== 0 ? fmtCompactGainLine(stats.todayGain, stats.todayPct, 'INR') : '—'}
                  </span>
                </span>
              </div>
              <div className="flex items-center justify-between mt-0.5">
                {xirr !== null && xirr !== undefined
                  ? <span className="text-[10px] font-semibold rounded-full px-1.5 py-0.5 shrink-0 -ml-1.5" style={{ background: xirr >= 0 ? (seg === 'mf' ? '#bfdbfe' : '#d1fae5') : '#fee2e2', color: xirr >= 0 ? (seg === 'mf' ? '#1e40af' : '#065f46') : '#991b1b' }}>XIRR {fmtPct(xirr)}</span>
                  : <span className="text-[10px] text-slate-400">XIRR —</span>
                }
                <span className="flex items-center gap-0.5 shrink-0 whitespace-nowrap">
                  <span className="flex items-center gap-[3px] text-[10px] text-slate-400"><svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><path d="M9 2H3l3.5 4-3.5 4h6"/></svg></span>
                  <span className="text-[10px]" style={{ color: tc }}>
                    {fmtCompactGainLine(stats.gain, stats.pct, 'INR')}
                  </span>
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Breakdown toggle */}
      <div className="flex items-center justify-between px-0.5">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Breakdown</p>
        <div className="relative flex bg-slate-100 rounded-full p-[2px]">
          <div
            className="absolute top-[2px] bottom-[2px] w-1/2 rounded-full bg-emerald-500 shadow-sm transition-transform duration-150"
            style={{ transform: `translateX(${mode === 'broker' ? '100%' : '0%'})` }}
          />
          {(['type', 'broker'] as BreakdownMode[]).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`relative z-10 flex-1 text-[10px] px-3 py-[4px] whitespace-nowrap transition-colors ${mode === m ? 'text-white font-semibold' : 'text-slate-400'}`}
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
                  <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: group.color }}>{group.label}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {gc.map(card => (
                    <BreakCard key={card.key} card={card} currency={usdCur(card.key === 'us_stock' || card.key === 'us_mf')} xirr={cardXirrMap.get(card.key) ?? null} onClick={() => navigate(card.navPath)} compact accentColor={TYPE_CARD_STYLE[card.key]?.accent} cardBg={TYPE_CARD_STYLE[card.key]?.bg} pillBlue={card.key === 'indian_mf' || card.key === 'us_mf'} scale={usdScale(card.key === 'us_stock' || card.key === 'us_mf')} divGain={cardDivGainMap.get(card.key) ?? 0} fxGain={cardFxGainMap.get(card.key) ?? 0} />
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
                  <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: group.color }}>{group.label}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {gc.map(card => (
                    <BreakCard key={card.key} card={card} currency={usdCur(USD_PORTS.has(card.key))} xirr={cardXirrMap.get(card.key) ?? null} onClick={() => navigate(card.navPath)} compact accentColor={PORTFOLIO_CARD_STYLE[card.key]?.accent} cardBg={PORTFOLIO_CARD_STYLE[card.key]?.bg} pillBlue={card.key.startsWith('MF_')} scale={usdScale(USD_PORTS.has(card.key))} divGain={cardDivGainMap.get(card.key) ?? 0} fxGain={cardFxGainMap.get(card.key) ?? 0} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* FAB — Explore */}
      <button
        onClick={() => setSheetOpen(true)}
        className="fixed bottom-6 right-4 z-40 w-14 h-14 rounded-full bg-emerald-500 text-white shadow-xl flex items-center justify-center active:opacity-80 transition-opacity"
        aria-label="Explore stocks"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
          <path fillRule="evenodd" d="M10.5 3.75a6.75 6.75 0 1 0 0 13.5 6.75 6.75 0 0 0 0-13.5ZM2.25 10.5a8.25 8.25 0 1 1 14.59 5.28l4.69 4.69a.75.75 0 1 1-1.06 1.06l-4.69-4.69A8.25 8.25 0 0 1 2.25 10.5Z" clipRule="evenodd" />
        </svg>
      </button>

      {/* Backdrop */}
      {sheetOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onClick={() => setSheetOpen(false)}
        />
      )}

      {/* Centered Modal — Explore New Opportunities */}
      <div
        className={`fixed inset-0 z-50 flex justify-center px-4 transition-all duration-200 ${sheetOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'} ${inputFocused ? 'items-start pt-4' : 'items-center'}`}
      >
        <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxHeight: inputFocused ? '92dvh' : '70dvh', maxWidth: 480, display: 'flex', flexDirection: 'column' }}>
          {/* Header */}
          <div className="flex items-center justify-between bg-gradient-to-r from-emerald-600 to-teal-500 rounded-t-2xl px-4 py-1.5 mb-4 shrink-0">
            <p className="text-[14px] font-bold text-white tracking-tight">Explore New Opportunities</p>
            <button onClick={() => setSheetOpen(false)} className="text-emerald-100 active:text-white text-lg min-h-[44px] min-w-[44px] flex items-center justify-center -mr-2">✕</button>
          </div>

          {/* Search + results — scrollable */}
          <div className="flex-1 overflow-y-auto px-4 pb-8">
            <input
              value={exploreInput}
              onChange={e => { setExploreInput(e.target.value); setShowSuggestions(true) }}
              onFocus={() => { setInputFocused(true); suggestions.length > 0 && setShowSuggestions(true) }}
              onKeyDown={e => e.key === 'Enter' && navigateToResearch(exploreInput)}
              onBlur={() => { setTimeout(() => setShowSuggestions(false), 150); setInputFocused(false) }}
              placeholder="e.g. AMZN, RELIANCE, HDFC Bank…"
              className="w-full bg-green-50 text-slate-800 text-[12px] rounded-xl px-3 py-2.5 border border-green-200 placeholder-emerald-400 outline-none focus:border-emerald-400"
            />

            {/* Searching indicator — shown while waiting for cold Render start */}
            {isSearching && exploreInput.trim().length > 0 && suggestions.length === 0 && (
              <div className="mt-1 bg-white border border-green-200 rounded-xl px-3 py-3">
                <p className="text-[12px] text-slate-400 animate-pulse">Searching…</p>
              </div>
            )}

            {/* Autocomplete results — inline so they scroll within the modal */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="mt-1 bg-white border border-green-200 rounded-xl overflow-hidden">
                {suggestions.map((s, i) => (
                  <button
                    key={s.symbol}
                    onMouseDown={() => navigateToResearch(s.symbol, s.name)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 text-left active:bg-green-50 ${i > 0 ? 'border-t border-green-100' : ''}`}
                  >
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-slate-800 truncate">{s.symbol}</p>
                      <p className="text-[10px] text-slate-500 truncate">{s.name}</p>
                    </div>
                    <span className="text-[10px] text-emerald-600 shrink-0 ml-2">{s.exchange}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Recent searches */}
            {recentSearches.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest w-full mb-0.5">Recent</span>
                {recentSearches.map(sym => (
                  <button
                    key={sym}
                    onClick={() => navigateToResearch(sym)}
                    className="text-[11px] bg-green-50 text-emerald-700 border border-green-200 rounded-full px-2.5 py-1 active:opacity-70"
                  >
                    {sym}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  )
}
