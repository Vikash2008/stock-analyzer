import { useMemo, useRef, useState, useEffect, useCallback } from 'react'
import { useDividends, getIncludeDividends, setIncludeDividends, clearDividendLocalCache, getIncludeFxGains, setIncludeFxGains } from '../hooks/useDividends'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { usePortfolio, useForceRefresh } from '../hooks/usePortfolio'
import { usePrefetchHoldingCharts } from '../hooks/useHistory'
import { LoadingSkeleton, ErrorState } from '../components/LoadingSkeleton'
import { fmt, fmtCompact } from '../utils/fmt'
import { SKIP_PORTS, USD_PORTS } from '../utils/segments'
import { getLabel, resolveLabel, filterByLabel, getAllLabelsInBucket, getBuckets, reconcileBucketsFromTags } from '../utils/buckets'
import { ManageBucketsModal } from '../components/ManageBucketsModal'
import { aggRealized, realizedForPorts } from '../utils/realized'
import { computeXIRR } from '../utils/xirr'
import type { RealizedMap } from '../utils/realized'
import type { Currency } from '../App'
import type { Holding, PortfolioData } from '../api/types'
import { logDebug } from '../utils/debugLog'
import { idbDelete, idbKeys } from '../utils/idbStore'

interface Props {
  currency: Currency
  onCurrencyChange: (c: Currency) => void
}

function fmtPct1(value: number): string {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}%`
}

function fmtCompactGainLine1(gain: number, pct: number | null, currency: Currency): string {
  const sign = gain >= 0 ? '' : '−'
  const valStr = `${sign}${fmtCompact(Math.abs(gain), currency)}`
  if (pct === null) return valStr
  return `${valStr} (${fmtPct1(pct)})`
}

type BreakdownMode = 'broker' | string   // 'broker' or a Bucket name (e.g. 'Asset Class')

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

const BROKER_GROUPS = [
  { key: 'indian', label: 'Indian Stocks', test: (p: string) => !USD_PORTS.has(p) && !p.startsWith('MF_'), color: '#10b981' },
  { key: 'us',     label: 'US Stocks',     test: (p: string) => USD_PORTS.has(p),                          color: '#0ea5e9' },
  { key: 'mf',     label: 'Mutual Funds',  test: (p: string) => p.startsWith('MF_'),                       color: '#8b5cf6' },
]

const STOCK_CARD_STYLE = { accent: '#0b3b3a', bg: 'linear-gradient(to right, #d1fae5, #ecfdf5 40%, #f0fdf4)' }
const MF_CARD_STYLE    = { accent: '#0b3b3a', bg: 'linear-gradient(to right, #d1fae5, #ecfdf5 40%, #f0fdf4)' }

// Asset Class tiles (below Hero card) — every tile (Stocks, Mutual Funds, Gold, ...) shares
// the same shade of green, no per-label distinction.
const ASSET_TILE_PALETTE: { accent: string; bg: string }[] = [
  { accent: '#0b3b3a', bg: 'linear-gradient(to right, #d1fae5, #ecfdf5 40%, #f0fdf4)' },
]

const CARD_COLOR_PALETTE: { accent: string; bg: string }[] = [
  { accent: '#0b3b3a', bg: 'linear-gradient(to right, #d1fae5, #ecfdf5 40%, #f0fdf4)' },
  { accent: '#0b3b3a', bg: 'linear-gradient(to right, #d1fae5, #ecfdf5 40%, #f0fdf4)' },
  { accent: '#0b3b3a', bg: 'linear-gradient(to right, #d1fae5, #ecfdf5 40%, #f0fdf4)' },
  { accent: '#0b3b3a', bg: 'linear-gradient(to right, #d1fae5, #ecfdf5 40%, #f0fdf4)' },
  { accent: '#0b3b3a', bg: 'linear-gradient(to right, #d1fae5, #ecfdf5 40%, #f0fdf4)' },
  { accent: '#0b3b3a', bg: 'linear-gradient(to right, #d1fae5, #ecfdf5 40%, #f0fdf4)' },
]

// Default styling for the auto-seeded "Asset Class" bucket's Labels — any other custom
// Bucket's Labels fall through to BreakCard's default (unstyled) look.
const LABEL_CARD_STYLE: Record<string, { accent: string; bg: string }> = {
  Stocks:        STOCK_CARD_STYLE,
  'Mutual Funds': MF_CARD_STYLE,
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
  MF_Vikash:         STOCK_CARD_STYLE,
  MF_Mahak:          STOCK_CARD_STYLE,
}

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

// Realized rows don't carry quote_type, and rmap keys use the clean symbol — build a
// (portfolio:symbol) -> {tags, quote_type} lookup from transactions/holdings so a realized
// entry can be classified the same way an open holding is (first-matching-row precedent,
// same pattern already used for dividend classification elsewhere in this file).
function buildTagLookup(data: PortfolioData): Map<string, { tags: string; quote_type?: string }> {
  const lookup = new Map<string, { tags: string; quote_type?: string }>()
  for (const tx of data.transactions) {
    const k = `${tx.portfolio}:${tx.symbol}`
    if (!lookup.has(k)) lookup.set(k, { tags: tx.tags })
  }
  for (const h of data.holdings) {
    lookup.set(`${h.portfolio}:${h.symbol}`, { tags: h.tags, quote_type: h.quote_type })
  }
  return lookup
}

function bucketCards(
  holdings: Holding[], rmap: RealizedMap, bucket: string, labels: string[], tagLookup: Map<string, { tags: string; quote_type?: string }>,
): CardStats[] {
  return labels.map(label => {
    const hs = holdings.filter(h => getLabel(h, bucket) === label)
    let current = 0, invested = 0, todayGain: number | null = null
    for (const h of hs) {
      current  += h.disp_current
      invested += h.disp_invested
      if (h.disp_today_gain !== null) todayGain = (todayGain ?? 0) + h.disp_today_gain
    }
    let rg = 0, rc = 0
    for (const [mapKey, [g, c]] of rmap) {
      const meta = tagLookup.get(mapKey)
      const lbl  = meta ? resolveLabel(meta.tags, bucket, meta.quote_type) : 'Unassigned'
      if (lbl === label) { rg += g; rc += c }
    }
    return {
      key: label, label, current, invested, realGain: rg, realCost: rc, todayGain,
      navPath: `/holdings/bucket/${encodeURIComponent(bucket)}/${encodeURIComponent(label)}`,
    }
  })
}

function isPos(v: number) { return v >= 0 }

function BreakCard({ card, currency, xirr, onClick, compact = false, accentColor, cardBg, pillBlue = false, scale = 1, divGain = 0, fxGain = 0 }: { card: CardStats; currency: Currency; xirr: number | null; onClick: () => void; compact?: boolean; accentColor?: string; cardBg?: string; pillBlue?: boolean; scale?: number; divGain?: number; fxGain?: number }) {
  const totalGain = (card.current - card.invested) + card.realGain + divGain + fxGain
  const totalCost = card.invested + card.realCost
  const pct = totalCost !== 0 ? (totalGain / totalCost) * 100 : 0
  const pos = isPos(totalGain)
  const todayPrior = card.current - (card.todayGain ?? 0)
  const todayPct = card.todayGain !== null && todayPrior !== 0 ? (card.todayGain / todayPrior) * 100 : null

  return (
    <div
      className="rounded-[13px] px-2 py-1.5 border cursor-pointer active:opacity-80 transition-opacity"
      style={{
        background:      cardBg ?? '#fff',
        borderColor:     '#e2e8f0',
        borderLeftWidth: 4,
        borderLeftColor: accentColor ?? '#0b3b3a',
      }}
      onClick={onClick}
    >
      <p className="text-[9.5px] font-bold text-slate-500 uppercase tracking-[1.2px] mb-0.5">{card.label}</p>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[14px] font-bold text-slate-900">{fmt(card.current * scale, currency)}</span>
        <span className="text-[9.5px] font-bold px-2 py-[3px] rounded-full whitespace-nowrap" style={{ background: xirr == null ? '#e2e8f0' : (xirr >= 0 ? (pillBlue ? '#bfdbfe' : '#d1fae5') : '#fee2e2'), color: xirr == null ? '#64748b' : (xirr >= 0 ? (pillBlue ? '#1e40af' : '#065f46') : '#991b1b') }}>XIRR {xirr == null ? '—' : `${xirr.toFixed(1)}%`}</span>
      </div>
      <div className="flex justify-between mt-1 pt-1 border-t border-slate-100">
        <div className="flex flex-col gap-0.5">
          <span className="text-[8px] font-semibold uppercase tracking-wide text-slate-400">Today</span>
          <span className="text-[10px] font-bold whitespace-nowrap" style={{ color: (card.todayGain ?? 0) >= 0 ? '#059669' : '#e11d48' }}>{fmtCompactGainLine1((card.todayGain ?? 0) * scale, card.todayGain !== null ? todayPct : 0, currency)}</span>
        </div>
        <div className="flex flex-col gap-0.5 items-end">
          <span className="text-[8px] font-semibold uppercase tracking-wide text-slate-400">Total</span>
          <span className="text-[10px] font-bold whitespace-nowrap" style={{ color: pos ? '#059669' : '#e11d48' }}>{fmtCompactGainLine1(totalGain * scale, pct, currency)}</span>
        </div>
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
  const [mode, setMode]       = useState<BreakdownMode>(() => {
    const saved = localStorage.getItem('pp:mode')
    return saved === 'type' || !saved || saved === 'Asset Class' ? 'broker' : saved   // 'type' = pre-Buckets value; Asset Class has its own tiles, not a breakdown mode
  })
  const [bucketsModalOpen, setBucketsModalOpen] = useState(false)
  const [bucketsVersion,   setBucketsVersion]   = useState(0)   // bumped to refresh after catalog edits
  const toggleModes = useMemo(
    () => ['broker', ...getBuckets().filter(b => b.showToggle && b.name !== 'Asset Class').map(b => b.name)],
    [bucketsVersion],
  )
  useEffect(() => { localStorage.setItem('pp:mode', mode) }, [mode])
  const [pullY, setPullY]     = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [bannerVisible, setBannerVisible] = useState(false)
  const [refreshError, setRefreshError] = useState(false)
  const [importFailBanner, setImportFailBanner] = useState(false)
  const [importFailReason, setImportFailReason] = useState('')
  const importFailBannerTimer = useRef<ReturnType<typeof setTimeout>>()

  // Settings panel
  const [settingsOpen, setSettingsOpen]     = useState(false)
  const [includeDivs, setIncludeDivs]           = useState(getIncludeDividends)
  const [includeFxGainsState, setIncludeFxGainsStateLocal] = useState(getIncludeFxGains)
  const [importProgress, setImportProgress] = useState<number | null>(null)
  const [importDone, setImportDone]         = useState(false)
  const [importStatus, setImportStatus]     = useState('')
  const [csvMeta, setCsvMeta]               = useState<CsvMeta | null>(getCsvMeta)
  const [lastImportError, setLastImportError] = useState<number | null>(
    () => { const v = localStorage.getItem('portfolio:import:lastError'); return v ? Number(v) : null }
  )
  const [sheetOpen, setSheetOpen]           = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const API_URL_SETTINGS = (import.meta.env.VITE_API_URL ?? '') as string

  const handleImport = useCallback((file: File) => {
    setImportProgress(0)
    setImportDone(false)
    setImportStatus('Reading rows…')
    const oldCsv = localStorage.getItem('portfolio:csv') ?? ''
    const reader = new FileReader()
    reader.onload = async (e) => {
      const rawText = e.target?.result as string
      const meta: CsvMeta = { name: file.name, size: file.size, importedAt: Date.now() }

      // A fresh broker export usually has no `tags` column — carry forward existing
      // Bucket/Label assignments (by portfolio+symbol) from the previous CSV so they survive
      // a re-import instead of being silently wiped. Best-effort: fall back to the raw upload
      // if the merge call fails, since a missing tag carry-forward shouldn't block the import.
      let text = rawText
      if (oldCsv.trim()) {
        try {
          const res = await fetch(`${API_URL_SETTINGS}/api/portfolio/import-merge-tags`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ old_csv: oldCsv, new_csv: rawText }),
          })
          if (res.ok) {
            const merged = await res.json() as { csv: string }
            text = merged.csv
          }
        } catch { /* fall back to rawText below */ }
      }

      // Persist CSV — remove old entry first (frees the largest item), then retry with full eviction if needed.
      // Meta (filename/size shown in settings) must only be written if the content write actually succeeded —
      // otherwise settings shows the new filename while portfolio:csv is empty (silent quota failure).
      setImportProgress(15)
      localStorage.removeItem('portfolio:csv')
      localStorage.removeItem('portfolio:csv:hash')
      let csvWriteOk = true
      try {
        localStorage.setItem('portfolio:csv', text)
      } catch {
        for (const k of Object.keys(localStorage)) {
          if (k.startsWith('gemini:') || k.startsWith('dividends:cache:') || k.startsWith('hist:') || k === 'stock-analyzer-chart-cache') {
            localStorage.removeItem(k)
          }
        }
        try {
          localStorage.setItem('portfolio:csv', text)
        } catch {
          csvWriteOk = false
        }
      }

      if (!csvWriteOk) {
        logDebug(`IMPORT FAILED: portfolio:csv write failed even after cache eviction (textLen=${text.length})`)
        const ts = Date.now()
        try { localStorage.setItem('portfolio:import:lastError', String(ts)) } catch {}
        setLastImportError(ts)
        setImportFailReason('Storage full — free up space')
        setImportFailBanner(true)
        clearTimeout(importFailBannerTimer.current)
        importFailBannerTimer.current = setTimeout(() => setImportFailBanner(false), 2000)
        setImportProgress(null)
        setImportStatus('')
        return
      }

      try { localStorage.setItem('portfolio:csv:meta', JSON.stringify(meta)); setCsvMeta(meta) } catch {}

      setImportProgress(30)
      setImportStatus('Running FIFO calculations…')

      // Step through status messages while backend processes
      const t1 = setTimeout(() => { setImportProgress(50); setImportStatus('Fetching latest prices…') }, 6_000)
      const t2 = setTimeout(() => { setImportProgress(70) },                                              25_000)
      const t3 = setTimeout(() => { setImportProgress(85); setImportStatus('Almost done…') },             55_000)
      const t4 = setTimeout(() => { setImportProgress(93) },                                              90_000)
      const clearTimers = () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4) }

      // A single fetch attempt — split out so a transient failure (tab backgrounded or
      // navigated away from mid-request, which can abort/drop a fetch that's still mid-flight
      // through the 90s+ FIFO-recompute-plus-live-price round trip) can be retried outright.
      const attemptPost = async () => {
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
          return { ok: true as const, res }
        } catch (e) {
          return { ok: false as const, aborted: controller.signal.aborted, error: e }
        } finally {
          clearTimeout(abortTimer)
        }
      }

      let attempt = await attemptPost()
      // The CSV is already safely in localStorage and `text` is still in memory either way —
      // retry once before giving up, instead of leaving the user at a dead-end error banner
      // for something that just needed the tab back in focus.
      if (!attempt.ok) {
        logDebug(`IMPORT: first attempt failed (${attempt.aborted ? 'timeout' : 'network'}) — retrying once`)
        attempt = await attemptPost()
      }

      try {
        if (!attempt.ok) throw attempt.error
        const res = attempt.res
        if (res.ok) {
          const newData = await res.json()
          if (newData.csv_hash) {
            try { localStorage.setItem('portfolio:csv:hash', newData.csv_hash) } catch {}
          }
          // Only now is the new csv_hash actually in localStorage — clearing the dividends
          // cache any earlier (e.g. right after the file read, before this POST resolves) risks
          // an active ['dividends'] observer refetching immediately on the OLD hash (still
          // reflecting pre-import holdings) and that stale result getting cached as if fresh,
          // with nothing to ever correct it given the 30-day staleTime + refetchOnMount:false.
          clearDividendLocalCache()
          qc.removeQueries({ queryKey: ['dividends'] })
          reconcileBucketsFromTags(newData)
          setBucketsVersion(v => v + 1)   // catalog may have just gained buckets — refresh toggleModes etc.
          qc.setQueryData(['portfolio'], newData)
          // Wipe the cached per-symbol price series outright rather than just invalidating —
          // useHistory/usePortfolioHistory's fetchSymHistory sends `since=<last cached date>`
          // and merges the delta on top of whatever's still in IndexedDB. If a symbol's
          // historical prices were ever adjusted retroactively (e.g. a stock split) between the
          // old cache write and now, the un-adjusted old dates + adjusted new delta merge into a
          // step right at the boundary — which is exactly what showed up as the chart suddenly
          // jumping ~50% after a reimport. Clearing the cache forces a full, non-merged fetch so
          // every reimport's chart is built from one internally consistent series.
          for (const k of idbKeys('hist:')) idbDelete(k)
          qc.invalidateQueries({ predicate: q => q.queryKey[0] === 'history' || q.queryKey[0] === 'history-closed' })
          localStorage.removeItem('portfolio:import:lastError')
          setLastImportError(null)
        } else {
          logDebug(`IMPORT FAILED: backend responded ${res.status}`)
          const ts = Date.now()
          try { localStorage.setItem('portfolio:import:lastError', String(ts)) } catch {}
          setLastImportError(ts)
          setImportFailReason(res.status === 400 ? 'Invalid CSV format' : `Server error (${res.status})`)
          setImportFailBanner(true)
          clearTimeout(importFailBannerTimer.current)
          importFailBannerTimer.current = setTimeout(() => setImportFailBanner(false), 2000)
        }
      } catch (e) {
        // timed out or network error on both attempts — CSV in localStorage, next load will retry
        logDebug(`IMPORT FAILED: backend fetch threw on retry too — ${String(e)}`)
        const ts = Date.now()
        try { localStorage.setItem('portfolio:import:lastError', String(ts)) } catch {}
        setLastImportError(ts)
        setImportFailReason(!attempt.ok && attempt.aborted ? 'Request timed out' : 'Network error')
        setImportFailBanner(true)
        clearTimeout(importFailBannerTimer.current)
        importFailBannerTimer.current = setTimeout(() => setImportFailBanner(false), 2000)
      }
      finally {
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

  useEffect(() => () => { clearTimeout(bannerTimer.current); clearTimeout(errorTimer.current); clearTimeout(importFailBannerTimer.current) }, [])


  const rmap = useMemo(() => data ? aggRealized(data.realized, data.usd_inr) : new Map(), [data])
  const tagLookup = useMemo(() => data ? buildTagLookup(data) : new Map(), [data])

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

  // Asset Class tiles (Stocks / Mutual Funds / any user-added label, e.g. Gold) — one tile per
  // label found in the "Asset Class" bucket, rendered below the Hero card (never in Breakdown).
  // Order follows the catalog's saved Label order (user-reorderable in Manage Buckets) —
  // no hardcoded Stocks/Mutual Funds-first pinning.
  const assetClassLabels = useMemo(
    () => (data ? getAllLabelsInBucket(data, 'Asset Class') : []),
    [data, bucketsVersion],
  )

  // Asset Class tile XIRR: recompute client-side with dividends/FX when those toggles are ON
  const assetClassXirrMap = useMemo(() => {
    const out = new Map<string, number | null>()
    if (!data) return out
    for (const label of assetClassLabels) {
      // No backend xirr_stk/xirr_mf shortcut — those are precomputed from the old
      // quote_type-based classification and would show stale numbers for a label that's
      // purely tag-driven now (e.g. a freshly emptied/recreated "Stocks" label).
      const today = new Date()
      const cfs: { date: Date; amount: number }[] = []
      for (const tx of data.transactions) {
        if (tx.type === 'DIVIDEND' || SKIP_PORTS.has(tx.portfolio)) continue
        if (getLabel(tx, 'Asset Class') !== label) continue
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
          const lbl = tx ? getLabel(tx, 'Asset Class') : 'Unassigned'
          if (lbl !== label) continue
          for (const ev of s.events) cfs.push({ date: new Date(ev.ex_date), amount: ev.amount })
        }
      }
      const totalCurrent = filterByLabel(active, 'Asset Class', label).reduce((s, h) => s + h.disp_current, 0)
      if (totalCurrent > 0) cfs.push({ date: today, amount: totalCurrent })
      const r = computeXIRR(cfs)
      out.set(label, r !== null ? r * 100 : null)
    }
    return out
  }, [data, divData, includeDivs, includeFxGainsState, active, assetClassLabels])

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

  // Asset Class tile stats — one entry per label (Stocks, Mutual Funds, Gold, ...)
  const assetClassStatsMap = useMemo(() => {
    const out = new Map<string, { cur: number; inv: number; gain: number; pct: number; todayGain: number; todayPct: number | null }>()
    for (const label of assetClassLabels) {
      const hs  = filterByLabel(active, 'Asset Class', label)
      const cur = hs.reduce((s, h) => s + h.disp_current,  0)
      const inv = hs.reduce((s, h) => s + h.disp_invested, 0)
      const tg  = hs.reduce((s, h) => h.disp_today_gain !== null ? s + h.disp_today_gain : s, 0)
      let rg = 0, rc = 0
      for (const [mapKey, [g, c]] of rmap) {
        const meta = tagLookup.get(mapKey)
        const lbl  = meta ? resolveLabel(meta.tags, 'Asset Class', meta.quote_type) : 'Unassigned'
        if (lbl === label) { rg += g; rc += c }
      }
      const labelDivs = (includeDivs && divData && data)
        ? divData.by_symbol
            .filter(s => { const tx = data.transactions.find(t => t.symbol === s.symbol); const lbl = tx ? getLabel(tx, 'Asset Class') : 'Unassigned'; return lbl === label })
            .reduce((sum, s) => sum + s.total_dividends, 0)
        : 0
      const labelFxGain = includeFxGainsState
        ? hs.filter(h => USD_PORTS.has(h.portfolio)).reduce((s, h) => s + (h.disp_fx_gain ?? 0), 0)
        : 0
      const gain = (cur - inv) + rg + labelDivs + labelFxGain
      const cost = inv + rc
      const prior = cur - tg
      out.set(label, { cur, inv, gain, pct: cost !== 0 ? gain / cost * 100 : 0, todayGain: tg, todayPct: tg !== 0 && prior !== 0 ? (tg / prior) * 100 : null })
    }
    return out
  }, [active, rmap, tagLookup, includeDivs, divData, data, includeFxGainsState, assetClassLabels])

  const bucketLabels = useMemo(
    () => (data && mode !== 'broker' ? getAllLabelsInBucket(data, mode) : []),
    [data, mode, bucketsVersion],
  )
  const cards = useMemo(
    () => mode === 'broker' ? portfolioCards(active, rmap) : bucketCards(active, rmap, mode, bucketLabels, tagLookup),
    [active, rmap, mode, bucketLabels, tagLookup],
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
      // Dividend events grouped by this Bucket's Label
      const divEventsByLabel = new Map<string, { date: Date; amount: number }[]>()
      if (includeDivs && divData) {
        for (const s of divData.by_symbol) {
          const firstTx = data.transactions.find(t => t.symbol === s.symbol)
          const lbl = firstTx ? getLabel(firstTx, mode) : 'Unassigned'
          const bucket = divEventsByLabel.get(lbl) ?? []
          for (const ev of s.events) bucket.push({ date: new Date(ev.ex_date), amount: ev.amount })
          divEventsByLabel.set(lbl, bucket)
        }
      }

      for (const card of cards) {
        const cfs: { date: Date; amount: number }[] = []
        for (const tx of data.transactions) {
          if (tx.type === 'DIVIDEND') continue
          if (getLabel(tx, mode) !== card.key) continue
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
          for (const ev of divEventsByLabel.get(card.key) ?? []) cfs.push(ev)
        }
        // Terminal value: open positions only
        const hs = active.filter(h => getLabel(h, mode) === card.key)
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
      // Bucket mode: group by this Bucket's Label using total_dividends (INR, correct amount)
      for (const s of divData.by_symbol) {
        const tx = data.transactions.find(t => t.symbol === s.symbol)
        const lbl = tx ? getLabel(tx, mode) : 'Unassigned'
        map.set(lbl, (map.get(lbl) ?? 0) + s.total_dividends)
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
      const key = mode === 'broker' ? h.portfolio : getLabel(h, mode)
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
      className="max-w-xl mx-auto px-2 py-4 pb-24 space-y-3"
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

      {importFailBanner && (
        <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[1000] bg-red-100 border border-red-300 text-red-700 text-[12px] font-medium px-4 py-2 rounded-full shadow-md">
          ⚠ Import failed — {importFailReason || 'try again'}
        </div>
      )}

      {/* Page header */}
      <div className="flex items-center justify-between px-1 pb-1.5 mb-2 border-b border-slate-200">
        <p className="text-[14px] font-extrabold text-slate-900 tracking-tight">Overview</p>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing || isFetching}
            className="flex items-center gap-1.5 active:opacity-70 transition-opacity"
          >
            <span className={`text-[12px] leading-none text-slate-400 ${(refreshing || isFetching) ? "animate-spin" : ""}`}>↻</span>
            <span className={`text-[10px] ${refreshError ? "text-red-500" : "text-slate-400"}`}>
              {refreshError
                ? 'Sync failed · retry'
                : (() => { const d = new Date(data.as_of); const hh = String(d.getHours()).padStart(2,'0'); const mm = String(d.getMinutes()).padStart(2,'0'); const dd = String(d.getDate()).padStart(2,'0'); const mon = d.toLocaleString('en-US',{month:'short'}); return `${hh}:${mm} · ${dd} ${mon}` })()}
            </span>
          </button>
          <div className="relative">
            <button
              onClick={() => { setCsvMeta(getCsvMeta()); setSettingsOpen(v => !v) }}
              className="w-[28px] h-[28px] rounded-full flex items-center justify-center active:opacity-70 text-slate-400"
              aria-label="Portfolio settings"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 0 0-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 0 0-2.282.819l-.922 1.597a1.875 1.875 0 0 0 .432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 0 0 0 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 0 0-.432 2.385l.922 1.597a1.875 1.875 0 0 0 2.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.985.57.182.088.277.228.297.35l.178 1.071c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.673-.356.985-.57.167-.114.335-.125.45-.082l1.02.382a1.875 1.875 0 0 0 2.28-.819l.923-1.597a1.875 1.875 0 0 0-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 0 0 0-1.139c-.016-.2.059-.352.153-.43l.84-.692c.708-.582.891-1.59.433-2.385l-.922-1.597a1.875 1.875 0 0 0-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 0 0-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 0 0-1.85-1.567h-1.843ZM12 15.75a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z" clipRule="evenodd" />
              </svg>
            </button>

            {/* Settings — bottom sheet */}
            {settingsOpen && (
              <>
                <div className="fixed inset-0 z-[998] bg-black/55" onClick={() => { if (importProgress === null) setSettingsOpen(false) }} />
                <div className="fixed bottom-0 left-0 right-0 z-[999] w-full rounded-t-[22px] overflow-hidden flex flex-col" style={{ maxHeight: '86vh', boxShadow: '0 -10px 40px rgba(0,0,0,0.25)' }}>

                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-[11px] shrink-0" style={{ background: 'linear-gradient(150deg, #10243f 0%, #0b3b3a 100%)' }}>
                    <p className="text-[13.5px] font-extrabold text-white tracking-[-0.2px]">Settings</p>
                    <button onClick={() => setSettingsOpen(false)} className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[13px] leading-none" style={{ background: 'rgba(255,255,255,0.12)' }}>✕</button>
                  </div>

                  {/* Body */}
                  <div className="overflow-y-auto flex flex-col gap-1.5 px-3.5 py-2.5" style={{ background: '#f8fafc' }}>

                    {/* ── Data ── */}
                    <p className="text-[9.5px] font-bold uppercase tracking-[1.1px] text-slate-500 px-0.5 pt-1">Data</p>

                    {/* Import CSV */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,text/csv,text/comma-separated-values,application/vnd.ms-excel,text/plain"
                      className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleImport(f); e.target.value = '' }}
                    />
                    <div className="bg-white border border-[#eef1f5] rounded-[12px] px-2.5 py-[7px] flex flex-col gap-0" style={{ boxShadow: '0 2px 8px rgba(15,23,42,0.03)' }}>
                      <div className="flex items-center justify-between gap-2.5">
                        <div className="min-w-0">
                          <p className="text-[12px] font-bold text-slate-900 leading-tight">Import CSV</p>
                          <p className="text-[10px] text-slate-400 leading-tight mt-0.5">
                            {importProgress !== null
                              ? (importDone ? '✓ Updated' : importStatus)
                              : 'Replace portfolio data'}
                          </p>
                        </div>
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={importProgress !== null}
                          className="shrink-0 w-7 h-7 flex items-center justify-center rounded-[9px] disabled:opacity-40"
                          style={{ background: '#ccfbf1', color: '#0f766e' }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                            <polyline points="17 8 12 3 7 8"/>
                            <line x1="12" y1="3" x2="12" y2="15"/>
                          </svg>
                        </button>
                      </div>
                      {importProgress !== null && (
                        <div className="mt-1.5 h-[3px] rounded-full overflow-hidden" style={{ background: '#ccfbf1' }}>
                          <div className="h-full rounded-full transition-all duration-200" style={{ width: `${importProgress}%`, background: '#0d9488' }} />
                        </div>
                      )}
                      {importProgress === null && lastImportError !== null && (
                        <p className="text-[10px] text-red-500 mt-1">⚠ Last import failed at {fmtImportDate(lastImportError)}</p>
                      )}
                    </div>

                    {/* Backup */}
                    <div className="bg-white border border-[#eef1f5] rounded-[12px] px-2.5 py-[7px] flex items-center justify-between gap-2.5" style={{ boxShadow: '0 2px 8px rgba(15,23,42,0.03)' }}>
                      <div className="min-w-0">
                        <p className="text-[12px] font-bold text-slate-900 leading-tight">Backup (with tags)</p>
                        <p className="text-[10px] text-slate-400 leading-tight mt-0.5 truncate">
                          {csvMeta ? `${csvMeta.name} · ${fmtBytes(csvMeta.size)}` : 'Demo Data · Sample portfolio'}
                        </p>
                      </div>
                      <button
                        onClick={handleDownload}
                        title="Download a backup CSV — includes your Bucket/Label tags; re-import this (not your raw broker export) to restore them"
                        className="shrink-0 w-7 h-7 flex items-center justify-center rounded-[9px]"
                        style={{ background: '#f1f5f9', color: '#475569' }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                          <polyline points="7 10 12 15 17 10"/>
                          <line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                      </button>
                    </div>

                    {/* Demo file */}
                    <div className="bg-white border border-[#eef1f5] rounded-[12px] px-2.5 py-[7px] flex items-center justify-between gap-2.5" style={{ boxShadow: '0 2px 8px rgba(15,23,42,0.03)' }}>
                      <div className="min-w-0">
                        <p className="text-[12px] font-bold text-slate-900 leading-tight">Demo file</p>
                        <p className="text-[10px] text-slate-400 leading-tight mt-0.5">Sample portfolio · ~1 Cr · 32 stocks</p>
                      </div>
                      <button
                        onClick={() => window.open(`${API_URL_SETTINGS}/api/demo-csv?t=${Date.now()}`, '_blank')}
                        title="Download demo CSV"
                        className="shrink-0 w-7 h-7 flex items-center justify-center rounded-[9px]"
                        style={{ background: '#f1f5f9', color: '#475569' }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                          <polyline points="7 10 12 15 17 10"/>
                          <line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                      </button>
                    </div>

                    {/* ── Configuration ── */}
                    <p className="text-[9.5px] font-bold uppercase tracking-[1.1px] text-slate-500 px-0.5 pt-1">Configuration</p>

                    {/* Dividends toggle */}
                    <div className="bg-white border border-[#eef1f5] rounded-[12px] px-2.5 py-[7px] flex items-center justify-between gap-2.5" style={{ boxShadow: '0 2px 8px rgba(15,23,42,0.03)' }}>
                      <div>
                        <p className="text-[12px] font-bold text-slate-900 leading-tight">Include dividends</p>
                        <p className="text-[10px] text-slate-400 leading-tight mt-0.5">Add to total gains &amp; XIRR</p>
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
                        className={`relative shrink-0 w-8 h-[18px] rounded-full transition-colors duration-200 focus:outline-none ${includeDivs ? 'bg-teal-500' : 'bg-slate-300'}`}
                      >
                        <span className={`absolute top-[2px] left-[2px] w-[14px] h-[14px] bg-white rounded-full shadow transition-transform duration-200 ${includeDivs ? 'translate-x-[14px]' : 'translate-x-0'}`} />
                      </button>
                    </div>

                    {/* FX Gains toggle */}
                    <div className="bg-white border border-[#eef1f5] rounded-[12px] px-2.5 py-[7px] flex items-center justify-between gap-2.5" style={{ boxShadow: '0 2px 8px rgba(15,23,42,0.03)' }}>
                      <div>
                        <p className="text-[12px] font-bold text-slate-900 leading-tight">Include FX gains</p>
                        <p className="text-[10px] text-slate-400 leading-tight mt-0.5">USD rate effect on returns</p>
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
                        className={`relative shrink-0 w-8 h-[18px] rounded-full transition-colors duration-200 focus:outline-none ${includeFxGainsState ? 'bg-teal-500' : 'bg-slate-300'}`}
                      >
                        <span className={`absolute top-[2px] left-[2px] w-[14px] h-[14px] bg-white rounded-full shadow transition-transform duration-200 ${includeFxGainsState ? 'translate-x-[14px]' : 'translate-x-0'}`} />
                      </button>
                    </div>

                    {/* Currency toggle */}
                    <div className="bg-white border border-[#eef1f5] rounded-[12px] px-2.5 py-[7px] flex items-center justify-between gap-2.5" style={{ boxShadow: '0 2px 8px rgba(15,23,42,0.03)' }}>
                      <div>
                        <p className="text-[12px] font-bold text-slate-900 leading-tight">Display currency</p>
                        <p className="text-[10px] text-slate-400 leading-tight mt-0.5 whitespace-nowrap">Switch values to USD or INR</p>
                      </div>
                      <div className="shrink-0 flex items-center gap-0.5 rounded-[9px] p-0.5" style={{ background: '#ecedf1' }}>
                        <button
                          onClick={() => onCurrencyChange('INR')}
                          className={`whitespace-nowrap px-[9px] py-[5px] rounded-[7px] text-[10.5px] font-bold transition-colors ${currency === 'INR' ? 'text-white' : 'text-slate-500'}`}
                          style={currency === 'INR' ? { background: '#0d9488', boxShadow: '0 2px 6px rgba(13,148,136,0.35)' } : {}}
                        >₹ INR</button>
                        <button
                          onClick={() => onCurrencyChange('USD')}
                          className={`whitespace-nowrap px-[9px] py-[5px] rounded-[7px] text-[10.5px] font-bold transition-colors ${currency === 'USD' ? 'text-white' : 'text-slate-500'}`}
                          style={currency === 'USD' ? { background: '#0d9488', boxShadow: '0 2px 6px rgba(13,148,136,0.35)' } : {}}
                        >$ USD</button>
                      </div>
                    </div>

                    {/* Manage Buckets */}
                    <div className="bg-white border border-[#eef1f5] rounded-[12px] px-2.5 py-[7px] flex items-center justify-between gap-2.5" style={{ boxShadow: '0 2px 8px rgba(15,23,42,0.03)' }}>
                      <div className="min-w-0">
                        <p className="text-[12px] font-bold text-slate-900 leading-tight">Manage Buckets</p>
                        <p className="text-[10px] text-slate-400 leading-tight mt-0.5">Buckets &amp; Labels for holdings</p>
                      </div>
                      <button
                        onClick={() => { setSettingsOpen(false); setBucketsModalOpen(true) }}
                        title="Manage Buckets"
                        className="shrink-0 w-7 h-7 flex items-center justify-center rounded-[9px]"
                        style={{ background: '#dbeafe', color: '#1d4ed8' }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                          <path d="M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6Z" />
                          <path d="M13.5 3.5v7.5h7.5a7.5 7.5 0 0 0-7.5-7.5Z" />
                        </svg>
                      </button>
                    </div>

                    {/* Footer */}
                    <div className="mt-0.5 pt-2 border-t border-[#eef1f5] flex items-center justify-between px-0.5 pb-1">
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
        className="rounded-[18px] p-4 cursor-pointer active:opacity-90 transition-opacity relative overflow-hidden"
        style={{ background: 'linear-gradient(150deg, #10243f 0%, #0b3b3a 100%)', boxShadow: '0 14px 30px -10px rgba(11,59,58,0.45)' }}
        onClick={() => navigate('/holdings/segment/total')}
      >
        <div className="absolute top-[-40px] right-[-40px] w-[160px] h-[160px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(45,212,191,0.25), transparent 70%)' }} />
        <p className="relative text-[11px] font-bold text-[#99e6dc] uppercase tracking-[1.2px] mb-2.5">Total Portfolio</p>
        <div className="relative flex items-center justify-between gap-2 mb-1">
          <span className="text-[24px] font-extrabold text-white">{fmt(hero.cur, 'INR')}</span>
          {heroXirr !== null
            ? <span className="text-[11px] font-bold rounded-full px-3 py-1 whitespace-nowrap shrink-0" style={{ background: 'rgba(45,212,191,0.18)', color: '#5eead4', border: '1px solid rgba(94,234,212,0.3)' }}>XIRR {fmtPct1(heroXirr!)}</span>
            : <span className="text-[11px] font-bold rounded-full px-3 py-1 whitespace-nowrap shrink-0" style={{ background: 'rgba(45,212,191,0.18)', color: '#5eead4', border: '1px solid rgba(94,234,212,0.3)' }}>XIRR —</span>
          }
        </div>
        <div className="relative flex justify-between pt-2.5 mt-2.5" style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}>
          <div className="flex flex-col gap-0.5">
            <span className="text-[8px] font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.45)' }}>Today</span>
            <span className="text-[13px] font-bold whitespace-nowrap" style={{ color: hero.todayGain >= 0 ? '#5eead4' : '#fca5a5' }}>
              {hero.todayGain !== 0 ? fmtCompactGainLine1(hero.todayGain, hero.todayPct, 'INR') : '—'}
            </span>
          </div>
          <div className="flex flex-col gap-0.5 items-end">
            <span className="text-[8px] font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.45)' }}>Total</span>
            <span className="text-[13px] font-bold whitespace-nowrap" style={{ color: heroPos ? '#5eead4' : '#fca5a5' }}>
              {fmtCompactGainLine1(hero.totalGain, hero.returnPct, 'INR')}
            </span>
          </div>
        </div>
      </div>

      {/* Asset Class summary tiles — Stocks, Mutual Funds, and any other label (e.g. Gold) */}
      <div className="flex flex-col gap-2">
        {assetClassLabels.map((label, idx) => {
          const style = ASSET_TILE_PALETTE[idx % ASSET_TILE_PALETTE.length]
          const stats = assetClassStatsMap.get(label) ?? { cur: 0, inv: 0, gain: 0, pct: 0, todayGain: 0, todayPct: null }
          const xirr  = assetClassXirrMap.get(label) ?? null
          const tileBg = style.bg
          const tileAccent = style.accent
          const pos = isPos(stats.gain)
          const tc  = pos ? '#0a7a42' : '#be1c1c'
          const tgC = stats.todayGain !== null ? (stats.todayGain >= 0 ? '#0a7a42' : '#be1c1c') : '#94a3b8'
          return (
            <div
              key={label}
              className="rounded-[13px] p-2 border cursor-pointer active:opacity-80 transition-opacity"
              style={{
                background:      tileBg,
                borderColor:     '#e2e8f0',
                borderLeftWidth: 4,
                borderLeftColor: tileAccent,
              }}
              onClick={() => navigate(`/holdings/bucket/${encodeURIComponent('Asset Class')}/${encodeURIComponent(label)}`)}
            >
              <p className="text-[9.5px] font-bold text-slate-500 uppercase tracking-[1.2px] mb-1">{label}</p>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[14px] font-bold text-slate-900">{fmt(stats.cur, 'INR')}</span>
                <span className="text-[9.5px] font-bold px-2 py-[3px] rounded-full whitespace-nowrap" style={{ background: xirr == null ? '#e2e8f0' : (xirr >= 0 ? '#d1fae5' : '#fee2e2'), color: xirr == null ? '#64748b' : (xirr >= 0 ? '#065f46' : '#991b1b') }}>XIRR {xirr == null ? '—' : `${xirr.toFixed(1)}%`}</span>
              </div>
              <div className="flex justify-between mt-1.5 pt-1.5 border-t border-slate-100">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[8px] font-semibold uppercase tracking-wide text-slate-400">Today</span>
                  <span className="text-[10px] font-bold whitespace-nowrap" style={{ color: tgC }}>{fmtCompactGainLine1(stats.todayGain, stats.todayPct ?? 0, 'INR')}</span>
                </div>
                <div className="flex flex-col gap-0.5 items-end">
                  <span className="text-[8px] font-semibold uppercase tracking-wide text-slate-400">Total</span>
                  <span className="text-[10px] font-bold whitespace-nowrap" style={{ color: tc }}>{fmtCompactGainLine1(stats.gain, stats.pct, 'INR')}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Breakdown toggle — one button per Bucket with its toggle enabled, plus Broker */}
      <div className="flex items-center justify-between px-0.5 gap-2">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Breakdown</p>
        <div className="flex items-center gap-1.5">
          <div className="flex bg-slate-100 rounded-full p-[2px] gap-[2px]">
            {toggleModes.map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`relative z-10 flex-1 text-[10px] px-3 py-[4px] rounded-full whitespace-nowrap transition-colors ${mode === m ? 'bg-emerald-500 text-white font-semibold shadow-sm' : 'text-slate-400'}`}
              >
                {m === 'broker' ? 'By Broker' : `By ${m}`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Breakdown cards */}
      {mode !== 'broker' ? (
        <div className="flex flex-col gap-2">
          {cards.map((card, idx) => {
            const s = LABEL_CARD_STYLE[card.key] ?? CARD_COLOR_PALETTE[idx % CARD_COLOR_PALETTE.length]
            return <BreakCard key={card.key} card={card} currency={currency} xirr={cardXirrMap.get(card.key) ?? null} onClick={() => navigate(card.navPath)} compact accentColor={s.accent} cardBg={s.bg} divGain={cardDivGainMap.get(card.key) ?? 0} fxGain={cardFxGainMap.get(card.key) ?? 0} />
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
                <div className="flex flex-col gap-2">
                  {gc.map(card => (
                    <BreakCard key={card.key} card={card} currency={usdCur(USD_PORTS.has(card.key))} xirr={cardXirrMap.get(card.key) ?? null} onClick={() => navigate(card.navPath)} compact accentColor={PORTFOLIO_CARD_STYLE[card.key]?.accent} cardBg={PORTFOLIO_CARD_STYLE[card.key]?.bg} scale={usdScale(USD_PORTS.has(card.key))} divGain={cardDivGainMap.get(card.key) ?? 0} fxGain={cardFxGainMap.get(card.key) ?? 0} />
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

      {data && (
        <ManageBucketsModal
          open={bucketsModalOpen}
          onClose={() => setBucketsModalOpen(false)}
          data={data}
          onChanged={() => setBucketsVersion(v => v + 1)}
        />
      )}

    </div>
  )
}
