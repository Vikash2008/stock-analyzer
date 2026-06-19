import React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { QuickStats } from '../api/types'
import { SECTIONS, buildGeminiPrompt } from '../utils/reportLinks'
import { streamGeminiSection } from '../api/gemini'
import { DeepResearchChat } from './DeepResearchChat'
import { idbGet, idbSet, idbDelete } from '../utils/idbStore'

const API_URL = (import.meta.env.VITE_API_URL ?? '') as string

interface Props {
  yf_symbol:      string
  name:           string
  qs:             QuickStats | undefined
  loading:        boolean
  reportTab:      'deep' | 'quickstats'
  useLite:        boolean
  use31:          boolean
  useKey:         0 | 1 | 2
  chatOpenerRef?: React.MutableRefObject<{ open: (contextId?: string) => void } | null>
}

function safeLocalSet(key: string, value: string) {
  idbSet(key, value)
}

function fmtPe(v: number | null | undefined): string {
  if (v == null) return '—'
  return `${v.toFixed(1)}×`
}

function fmtPrice(v: number | null | undefined, currency: string): string {
  if (v == null) return '—'
  const sym = currency === 'INR' ? '₹' : '$'
  if (v >= 10000) return `${sym}${v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
  if (v >= 1000)  return `${sym}${v.toFixed(0)}`
  return `${sym}${v.toFixed(2)}`
}

function fmtPct(v: number | null | undefined): string {
  if (v == null) return '—'
  return `${(v * 100).toFixed(1)}%`
}

function fmtRatio(v: number | null | undefined, decimals = 2): string {
  if (v == null) return '—'
  return v.toFixed(decimals)
}

function colorNum(v: number | null | undefined): string {
  if (v == null) return '#94a3b8'
  return v >= 0 ? '#0a7a42' : '#be1c1c'
}

function fmtSavedAt(ts: number | undefined): string {
  if (!ts) return ''
  const d = new Date(ts)
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${d.getDate()} ${months[d.getMonth()]} ${hh}:${mm}`
}

function fmtModelName(model: string | undefined): string {
  if (model === 'gemini-2.5-flash') return '2.5 Flash'
  if (model === 'gemini-2.5-flash-lite') return '2.5 Lite'
  return '3.1 Lite'
}

function normalizeRec(rec: string | null | undefined): string | null {
  if (!rec) return null
  return rec.toLowerCase() === 'none' ? 'Neutral' : rec
}

function recColor(rec: string | null): string {
  if (!rec) return '#94a3b8'
  const r = rec.toLowerCase()
  if (r.includes('buy')) return '#0a7a42'
  if (r.includes('sell') || r.includes('underperform')) return '#be1c1c'
  if (r === 'neutral') return '#64748b'
  return '#b45309'
}

export function ReportTab({ yf_symbol, name, qs, loading, reportTab, useLite, use31, useKey, chatOpenerRef }: Props) {
  const isIndian = yf_symbol.endsWith('.NS') || yf_symbol.endsWith('.BO')
  const displayName = name || yf_symbol
  const qc = useQueryClient()
  const [syncing, setSyncing] = React.useState(false)

  type SectionResult = { text: string; sources: string[]; savedAt?: number; grounded?: boolean; model?: string; requestedLite?: boolean; streaming?: boolean }
  type SectionState = 'idle' | 'loading' | { error: string } | SectionResult
  const [sectionStates, setSectionStates] = React.useState<Record<string, SectionState>>({})
  const [altStates,     setAltStates]     = React.useState<Record<string, SectionResult>>({})
  const [expandedSections, setExpandedSections] = React.useState<Record<string, boolean>>({})
  const [showUnavailable, setShowUnavailable] = React.useState<Record<string, boolean>>({})
  const [elapsed, setElapsed] = React.useState<Record<string, number>>({})
  const timerRefs = React.useRef<Record<string, ReturnType<typeof setInterval>>>({})
  const [showChat, setShowChat] = React.useState(false)
  const [chatInitialContext, setChatInitialContext] = React.useState<string>('all')

  // Register chat opener with parent strip
  React.useEffect(() => {
    if (!chatOpenerRef) return
    chatOpenerRef.current = { open: (contextId = 'all') => { setChatInitialContext(contextId); setShowChat(true) } }
    return () => { if (chatOpenerRef) chatOpenerRef.current = null }
  }, [chatOpenerRef])

  React.useEffect(() => {
    const initial:    Record<string, SectionState>  = {}
    const initialAlt: Record<string, SectionResult> = {}
    const TTL = 7 * 24 * 3600 * 1000
    for (const s of SECTIONS) {
      for (const [suffix, target] of [['', initial], [':alt', initialAlt]] as const) {
        const key = `gemini:${yf_symbol}:${s.id}${suffix}`
        const raw = idbGet<string>(key)
        if (!raw) continue
        try {
          const p = JSON.parse(raw)
          if (p.savedAt && Date.now() - p.savedAt < TTL) {
            (target as Record<string, SectionResult>)[s.id] = { text: p.text, sources: p.sources, savedAt: p.savedAt, grounded: p.grounded, model: p.model, requestedLite: p.requestedLite }
          } else {
            idbDelete(key)
          }
        } catch {}
      }
    }
    setSectionStates(Object.keys(initial).length ? initial : {})
    setAltStates(Object.keys(initialAlt).length ? initialAlt : {})
    setExpandedSections({})
    setShowUnavailable({})
  }, [yf_symbol])

  function handleAltSwap(sectionId: string) {
    const current = sectionStates[sectionId]
    if (typeof current !== 'object' || !('text' in current)) return
    const cur = current as SectionResult
    const isFallback = cur.requestedLite === false && cur.model === 'gemini-3.1-flash-lite'
    if (isFallback) {
      const isUnavailableNow = showUnavailable[sectionId] ?? false
      setShowUnavailable(prev => ({ ...prev, [sectionId]: !isUnavailableNow }))
      if (!isUnavailableNow) {
        setExpandedSections(() => {
          const next: Record<string, boolean> = {}
          for (const s of SECTIONS) next[s.id] = false
          next[sectionId] = true
          return next
        })
      }
      return
    }
    const alt = altStates[sectionId]
    if (!alt) return
    setSectionStates(prev => ({ ...prev, [sectionId]: alt }))
    setAltStates(prev => ({ ...prev, [sectionId]: cur }))
    safeLocalSet(`gemini:${yf_symbol}:${sectionId}`,     JSON.stringify(alt))
    safeLocalSet(`gemini:${yf_symbol}:${sectionId}:alt`, JSON.stringify(cur))
  }

  async function handleGenerate(sectionId: string, force = false, forceLite?: boolean) {
    const cur = sectionStates[sectionId]
    if (typeof cur === 'object' && cur !== null && 'text' in cur) {
      const toSave = { ...(cur as SectionResult), streaming: undefined }
      setAltStates(prev => ({ ...prev, [sectionId]: toSave }))
      safeLocalSet(`gemini:${yf_symbol}:${sectionId}:alt`, JSON.stringify(toSave))
    }
    setSectionStates(prev => ({ ...prev, [sectionId]: 'loading' }))
    setElapsed(prev => ({ ...prev, [sectionId]: 0 }))
    clearInterval(timerRefs.current[sectionId])
    timerRefs.current[sectionId] = setInterval(() => {
      setElapsed(prev => ({ ...prev, [sectionId]: (prev[sectionId] ?? 0) + 1 }))
    }, 1000)

    await new Promise(r => setTimeout(r, 50))

    const effectiveLite = forceLite !== undefined ? forceLite : useLite
    const effectiveForce31 = forceLite !== undefined ? false : use31
    const symbol = yf_symbol.replace(/\.(NS|BO)$/i, '')
    const prompt = buildGeminiPrompt(displayName, sectionId, isIndian, yf_symbol, API_URL)
    let accText = ''
    let timerStopped = false
    try {
      for await (const chunk of streamGeminiSection(symbol, sectionId, prompt, force, effectiveLite, useKey, effectiveForce31)) {
        if (chunk.error) {
          clearInterval(timerRefs.current[sectionId])
          if (chunk.error.startsWith('gemini25_')) {
            setSectionStates(prev => ({ ...prev, [sectionId]: { error: chunk.error!, detail: (chunk as any).detail || '' } }))
          } else {
            setSectionStates(prev => ({ ...prev, [sectionId]: { error: chunk.error! } }))
          }
          return
        }
        if (chunk.text) {
          accText += chunk.text
          if (!timerStopped) {
            timerStopped = true
            clearInterval(timerRefs.current[sectionId])
            setExpandedSections(() => {
              const next: Record<string, boolean> = {}
              for (const s of SECTIONS) next[s.id] = false
              next[sectionId] = true
              return next
            })
          }
          setSectionStates(prev => ({
            ...prev,
            [sectionId]: { text: accText, sources: [], grounded: false, model: undefined, requestedLite: effectiveLite, streaming: true },
          }))
        }
        if (chunk.done) {
          const savedAt = Date.now()
          const state: SectionResult = { text: accText, sources: chunk.sources ?? [], savedAt, grounded: chunk.grounded ?? false, model: chunk.model, requestedLite: effectiveLite }
          setSectionStates(prev => ({ ...prev, [sectionId]: state }))
          setShowUnavailable(prev => ({ ...prev, [sectionId]: false }))
          safeLocalSet(`gemini:${yf_symbol}:${sectionId}`, JSON.stringify(state))
        }
      }
    } catch (err) {
      clearInterval(timerRefs.current[sectionId])
      const msg = err instanceof Error ? err.message : 'Request failed'
      setSectionStates(prev => ({ ...prev, [sectionId]: { error: msg } }))
    }
  }

  async function handleSync(forceBackend = false) {
    setSyncing(true)
    try {
      if (forceBackend) {
        await fetch(`${API_URL}/api/quickstats?yf_symbol=${encodeURIComponent(yf_symbol)}&force_refresh=true`)
      }
      await qc.resetQueries({ queryKey: ['quickstats', yf_symbol] })
    } finally {
      setSyncing(false)
    }
  }

  const rangePos =
    qs?.week_52_high && qs?.week_52_low && qs?.current_price
      ? Math.max(0, Math.min(1,
          (qs.current_price - qs.week_52_low) /
          (qs.week_52_high  - qs.week_52_low)
        ))
      : null

  return (
    <div className="space-y-3 pb-4">
      <style>{`
        @keyframes qs-progress {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(350%); }
        }
      `}</style>


      {/* ── Quick Stats tab ──────────────────────────────────── */}
      {reportTab === 'quickstats' && (loading ? (
        <div className="rounded-xl border border-emerald-200 bg-white overflow-hidden">
          <div className="h-[3px]" style={{ background: 'linear-gradient(to right, #10b981, #34d39955)' }} />
          <div className="h-0.5 bg-emerald-50">
            <div className="h-full w-2/5 bg-emerald-500 rounded-full"
                 style={{ animation: 'qs-progress 1.2s ease-in-out infinite' }} />
          </div>
          <div className="px-3 py-5 flex items-center justify-center gap-2 text-emerald-600 text-[12px]">
            Loading stats…
          </div>
        </div>
      ) : (qs && !qs.partial) ? (
        <div className="rounded-xl border border-emerald-200 bg-white overflow-hidden">
          {/* Green top strip */}
          <div className="h-[3px]" style={{ background: 'linear-gradient(to right, #10b981, #34d39955)' }} />
          {/* Progress bar — shown during sync */}
          <div className="h-0.5 bg-emerald-50">
            {syncing && (
              <div className="h-full w-2/5 bg-emerald-500 rounded-full"
                   style={{ animation: 'qs-progress 1.2s ease-in-out infinite' }} />
            )}
          </div>
          <div className="px-3 py-3 space-y-3">

          {/* Fundamentals grid — 4 rows × 4 cols */}
          <div className="grid grid-cols-4 gap-1.5">
            {[
              /* Row 1: Valuation */
              { label: 'P/E',     value: fmtPe(qs.trailing_pe),           color: null },
              { label: 'Fwd P/E', value: fmtPe(qs.forward_pe),            color: null },
              { label: 'P/B',     value: fmtRatio(qs.price_to_book, 1),   color: null },
              { label: 'D/E',     value: fmtRatio(qs.debt_to_equity, 1),  color: null },
              /* Row 2: Returns */
              { label: 'ROCE',       value: qs.roce != null ? `${qs.roce.toFixed(1)}%` : '—', color: colorNum(qs.roce) },
              { label: 'ROE',        value: fmtPct(qs.return_on_equity),                       color: colorNum(qs.return_on_equity) },
              { label: 'ROA',        value: fmtPct(qs.return_on_assets),                       color: colorNum(qs.return_on_assets) },
              { label: 'Net Margin', value: fmtPct(qs.profit_margins),                         color: colorNum(qs.profit_margins) },
              /* Row 3: Revenue Growth */
              { label: 'Rev 1Y',  value: fmtPct(qs.revenue_growth),      color: colorNum(qs.revenue_growth) },
              { label: 'Rev 3Y',  value: fmtPct(qs.revenue_growth_3y),   color: colorNum(qs.revenue_growth_3y) },
              { label: 'EPS 1Y',  value: fmtPct(qs.earnings_growth),     color: colorNum(qs.earnings_growth) },
              { label: 'EPS 3Y',  value: fmtPct(qs.earnings_growth_3y),  color: colorNum(qs.earnings_growth_3y) },
              /* Row 4: Context */
              { label: 'EPS TTM', value: fmtPrice(qs.trailing_eps, qs.currency), color: null },
              { label: 'PEG',     value: fmtRatio(qs.peg_ratio, 1),              color: null },
              { label: 'MCap',    value: qs.market_cap_display ?? '—',           color: null },
              { label: 'Beta',    value: fmtRatio(qs.beta),                      color: null },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-emerald-50 rounded-lg p-1.5">
                <div className="text-[10px] text-emerald-600/70 uppercase tracking-wide mb-0.5 truncate">{label}</div>
                <div
                  className="text-[11px] font-semibold whitespace-nowrap"
                  style={{ color: color ?? '#1e293b' }}
                >
                  {value}
                </div>
              </div>
            ))}
          </div>

          {/* 52W range bar */}
          {rangePos !== null && qs.week_52_low != null && qs.week_52_high != null && qs.current_price != null && (
            <div>
              <div className="text-[10px] text-emerald-600/80 uppercase tracking-wide mb-2">52-Week Range</div>
              <div className="relative h-1.5 rounded-full overflow-visible"
                   style={{ background: 'linear-gradient(to right, #fca5a5, #fde68a, #86efac)' }}>
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2 border-emerald-500 shadow-sm"
                  style={{ left: `calc(${rangePos * 100}% - 6px)` }}
                />
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="text-[10px] text-slate-400">
                  {fmtPrice(qs.week_52_low, qs.currency)}
                </span>
                <span className="text-[10px] font-semibold text-emerald-600">
                  {fmtPrice(qs.current_price, qs.currency)}
                </span>
                <span className="text-[10px] text-slate-400">
                  {fmtPrice(qs.week_52_high, qs.currency)}
                </span>
              </div>
            </div>
          )}

          {/* Analyst row */}
          {(qs.recommendation || qs.num_analyst_opinions || qs.target_mean_price) && (
            <div className="flex items-center justify-between pt-2 border-t border-emerald-100">
              <div className="flex items-center gap-2">
                {normalizeRec(qs.recommendation) && (
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{
                      color:      recColor(normalizeRec(qs.recommendation)),
                      background: recColor(normalizeRec(qs.recommendation)) + '18',
                    }}
                  >
                    {normalizeRec(qs.recommendation)}
                  </span>
                )}
                {qs.num_analyst_opinions != null && (
                  <span className="text-[10px] text-slate-400">
                    {qs.num_analyst_opinions} analysts
                  </span>
                )}
              </div>
              {qs.target_mean_price != null && (
                <div className="text-right">
                  <span className="text-[10px] font-semibold text-slate-700">
                    Target {fmtPrice(qs.target_mean_price, qs.currency)}
                  </span>
                  {qs.upside_pct != null && (
                    <span
                      className="text-[10px] ml-1"
                      style={{ color: qs.upside_pct >= 0 ? '#0a7a42' : '#be1c1c' }}
                    >
                      ({qs.upside_pct >= 0 ? '+' : ''}{qs.upside_pct.toFixed(1)}%)
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
          {/* Footer — source link + analyst ratings */}
          <div className="flex items-center justify-between pt-2 border-t border-emerald-100">
            <a
              href={isIndian
                ? `https://www.screener.in/company/${yf_symbol.replace(/\.(NS|BO)$/i, '')}/`
                : `https://finance.yahoo.com/quote/${encodeURIComponent(yf_symbol)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[10px] font-medium text-sky-600 bg-sky-50 px-2.5 py-1 rounded-full border border-sky-100 active:bg-sky-100"
            >
              <span>{isIndian ? 'Screener.in' : 'Yahoo Finance'}</span>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                <polyline points="15 3 21 3 21 9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
            </a>
            <a
              href={`https://finance.yahoo.com/quote/${encodeURIComponent(yf_symbol)}/analysis/`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 active:bg-emerald-100"
            >
              <span>Analyst Ratings</span>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                <polyline points="15 3 21 3 21 9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
            </a>
          </div>

          </div>{/* inner px-3 */}
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-200 bg-white p-4 flex flex-col items-center gap-2">
          <span className="text-[11px] text-slate-400">Stats unavailable for this symbol</span>
          <button
            onClick={() => handleSync(true)}
            disabled={syncing}
            className="flex items-center gap-1.5 text-[10px] font-medium text-sky-600 bg-sky-50 px-3 py-1.5 rounded-full border border-sky-100 active:bg-sky-100 disabled:opacity-50"
          >
            <span className={`inline-block ${syncing ? 'animate-spin' : ''}`}>↻</span>
            <span>Retry</span>
          </button>
        </div>
      ))}

      {/* PE History chart */}
      {reportTab === 'quickstats' && qs?.pe_history && qs.pe_history.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-slate-400 uppercase tracking-wide">P/E History (5Y)</span>
            <span className="text-[11px] font-semibold text-[#2563eb]">
              {qs.pe_history[qs.pe_history.length - 1]?.pe.toFixed(1)}× now
            </span>
          </div>
          <ResponsiveContainer width="100%" height={80}>
            <LineChart data={qs.pe_history} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <XAxis
                dataKey="date"
                tickFormatter={(d: string) => d.slice(0, 4)}
                interval={3}
                tick={{ fontSize: 8, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={['auto', 'auto']}
                tick={{ fontSize: 8, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{ fontSize: 10, padding: '4px 8px', borderRadius: 6, border: '1px solid #e2e8f0' }}
                formatter={(v: number) => [`${v.toFixed(1)}×`, 'P/E']}
                labelFormatter={(l: string) => l}
              />
              {qs.trailing_pe != null && (
                <ReferenceLine y={qs.trailing_pe} stroke="#2563eb" strokeDasharray="3 3" strokeWidth={1} />
              )}
              <Line
                type="monotone"
                dataKey="pe"
                stroke="#2563eb"
                dot={false}
                strokeWidth={1.5}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
          {(() => {
            const pes = qs.pe_history.map(r => r.pe)
            const min = Math.min(...pes), max = Math.max(...pes), avg = pes.reduce((a, b) => a + b, 0) / pes.length
            return (
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-slate-400">Min {min.toFixed(1)}×</span>
                <span className="text-[10px] text-slate-400">Avg {avg.toFixed(1)}×</span>
                <span className="text-[10px] text-slate-400">Max {max.toFixed(1)}×</span>
              </div>
            )
          })()}
        </div>
      )}

      {/* ── Deep Research tab ────────────────────────────────── */}
      {reportTab === 'deep' && SECTIONS.map(section => {
        const state = sectionStates[section.id] ?? 'idle'
        const isDone = typeof state === 'object' && 'text' in state
        const isError = typeof state === 'object' && 'error' in state
        const _errCode = isError ? (state as { error: string }).error : ''
        const isGemini25Unavailable = _errCode.startsWith('gemini25_')
        const gemini25Label = _errCode === 'gemini25_quota' ? 'Quota exceeded' : _errCode === 'gemini25_timeout' ? 'Timed out' : _errCode === 'gemini25_empty' ? 'Empty response' : _errCode === 'gemini25_overloaded' ? 'Model overloaded — try 3.1' : '2.5 Flash unavailable'
        const isUnavailable = showUnavailable[section.id] ?? false
        const isExpanded = isDone && ((expandedSections[section.id] ?? false) || isUnavailable)

        const toggleExpanded = () => {
          if (!isDone) return
          const isOpen = (expandedSections[section.id] ?? false) || isUnavailable
          if (isUnavailable && isOpen) {
            setShowUnavailable(prev => ({ ...prev, [section.id]: false }))
          }
          setExpandedSections(() => {
            const next: Record<string, boolean> = {}
            for (const s of SECTIONS) next[s.id] = false
            if (!isOpen) next[section.id] = true
            return next
          })
        }

        return (
          <div key={section.id}
            className={`rounded-xl overflow-hidden border ${section.color.bg} ${section.color.border}`}
            style={{ borderLeftWidth: 4, borderLeftColor: section.color.accentHex, borderTopWidth: 2, borderTopColor: section.color.accentHex }}
          >
            {/* Card header */}
            <div className="flex items-center justify-between px-3 py-2.5 gap-2">
              {/* Left: chevron + emoji + title (tappable toggle) */}
              <button
                className="flex items-center gap-2 min-w-0 flex-1 text-left active:opacity-60"
                onClick={toggleExpanded}
              >
                <span className="text-[10px] text-slate-400 shrink-0 w-3 text-center">
                  {isDone ? (isExpanded ? '▼' : '▶') : ''}
                </span>
                <span className="text-[18px] shrink-0 leading-none">{section.emoji}</span>
                <div className="min-w-0">
                  <div className="text-[12px] font-semibold text-slate-800">{section.label}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{section.description}</div>
                </div>
              </button>

              {/* Right: gemini icon + action button + attribution */}
              <div className="shrink-0 flex flex-col items-end gap-0.5">
                <div className="flex items-center gap-1.5">
                  {/* Gemini icon — opens AI Assistant chat for this card */}
                  <button
                    onClick={() => { setChatInitialContext(section.id); setShowChat(true) }}
                    className="p-0.5 shrink-0 active:opacity-70"
                    title="AI Assistant"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24">
                      <defs>
                        <linearGradient id={`gg-${section.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#4285f4"/>
                          <stop offset="100%" stopColor="#9334e9"/>
                        </linearGradient>
                      </defs>
                      <path fill={`url(#gg-${section.id})`} d="M12 2c-.5 4-4 7.5-10 10 6 2.5 9.5 6 10 10 .5-4 4-7.5 10-10-6-2.5-9.5-6-10-10z"/>
                    </svg>
                  </button>
                  {state === 'loading' ? (
                    <span className={`text-[10px] font-medium px-2.5 py-1 rounded-md border opacity-60 ${section.color.btnOutline}`}>
                      …
                    </span>
                  ) : isDone && (state as SectionResult).streaming ? (
                    <span className={`text-[10px] font-medium px-2.5 py-1 rounded-md border opacity-60 ${section.color.btnOutline}`}>
                      Streaming…
                    </span>
                  ) : isDone ? (
                    <button
                      onClick={isUnavailable ? () => handleGenerate(section.id, true) : (isExpanded ? () => handleGenerate(section.id, true) : toggleExpanded)}
                      className={`text-[10px] font-medium px-2.5 py-1 rounded-md ${section.color.btnSolid}`}
                    >
                      {isExpanded ? 'Refresh' : 'Show Results'}
                    </button>
                  ) : (
                    <button
                      onClick={() => isGemini25Unavailable
                        ? handleGenerate(section.id, false, true)
                        : handleGenerate(section.id)
                      }
                      className={`text-[10px] font-medium px-2.5 py-1 rounded-md border ${
                        isGemini25Unavailable
                          ? 'bg-purple-50 text-purple-700 border-purple-300'
                          : isError
                            ? 'bg-red-100 text-red-700 border-red-300'
                            : section.color.btnOutline
                      }`}
                    >
                      {isGemini25Unavailable ? 'Try 2.5 Lite' : isError ? 'Retry' : 'Research'}
                    </button>
                  )}
                </div>
                {isDone && (() => {
                  const s   = state as SectionResult
                  const alt = altStates[section.id]
                  const fallback = s.requestedLite === false && s.model === 'gemini-3.1-flash-lite'
                  return (
                    <span className="flex items-center gap-1 whitespace-nowrap leading-tight">
                      {(alt || fallback) && (
                        <button
                          onClick={e => { e.stopPropagation(); handleAltSwap(section.id) }}
                          className="text-[11px] text-sky-400 active:opacity-50 shrink-0 leading-none"
                          title={isUnavailable ? 'Back to 3.1 Lite result' : (fallback ? 'View 2.5 Flash (unavailable)' : `Switch to ${fmtModelName(alt?.model)} · ${fmtSavedAt(alt?.savedAt)}`)}
                        >⇄</button>
                      )}
                      <span className="text-[10px] text-right leading-tight">
                        {isUnavailable ? (
                          <><span className="text-amber-500">⚠ · </span><span className="text-slate-400">2.5 Flash · unavailable</span></>
                        ) : (
                          <span className="text-slate-400">{fmtModelName(s.model)} · {fmtSavedAt(s.savedAt)}</span>
                        )}
                      </span>
                    </span>
                  )
                })()}
                {isError && (
                  <div className="flex flex-col items-end gap-0.5 max-w-[140px]">
                    <span className={`text-[10px] text-right leading-tight ${isGemini25Unavailable ? 'text-purple-400' : 'text-red-400'}`}>
                      {isGemini25Unavailable ? gemini25Label : (state as { error: string }).error}
                    </span>
                    {isGemini25Unavailable && (state as any).detail && (
                      <span className="text-[10px] text-slate-400 text-right leading-tight line-clamp-2">
                        {(state as any).detail}
                      </span>
                    )}
                  </div>
                )}
              </div>{/* end right col */}
            </div>

            {/* Loading panel */}
            {state === 'loading' && (
              <div className={`px-3 pb-3 border-t ${section.color.border} pt-3 space-y-2`}>
                <div className="h-0.5 bg-white/70 rounded-full overflow-hidden">
                  <div className="h-full w-2/5 bg-slate-400 rounded-full"
                       style={{ animation: 'qs-progress 1.2s ease-in-out infinite' }} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">🔍 Searching the web with Gemini…</span>
                  <span className="text-[11px] font-medium text-slate-600 tabular-nums">
                    {elapsed[section.id] ?? 0}s
                  </span>
                </div>
                <div className="text-[10px] text-slate-400">
                  {(() => {
                    const t = elapsed[section.id] ?? 0
                    if (t < 4)  return `Researching ${section.label.toLowerCase()}…`
                    if (t < 8)  return 'Sending prompt to Gemini 2.5 Flash…'
                    if (t < 13) return 'Searching live web sources & news…'
                    if (t < 19) return 'Reading financial articles & filings…'
                    if (t < 26) return 'Scanning analyst reports & data…'
                    if (t < 34) return 'Analyzing with extended thinking…'
                    if (t < 43) return 'Cross-referencing multiple sources…'
                    if (t < 52) return 'Composing structured answer…'
                    return 'Retrying without extended thinking…'
                  })()}
                </div>
              </div>
            )}

            {/* Expanded content */}
            {isExpanded && (
              <div className={`px-3 pb-3 border-t ${section.color.border} pt-2.5`}>
                {isUnavailable ? (
                  <div className="flex flex-col items-center gap-2 py-6 text-center">
                    <span className="text-2xl">⚠️</span>
                    <span className="text-[12px] font-semibold text-amber-700">Results not available</span>
                    <span className="text-[11px] text-slate-400 leading-snug">Please try with other model</span>
                  </div>
                ) : (
                <>
                <div className="gemini-md text-[12px] text-slate-700 leading-relaxed relative">
                  {(state as SectionResult).streaming && (
                    <span className="inline-block w-0.5 h-3.5 bg-slate-400 animate-pulse align-middle absolute bottom-0 right-0" />
                  )}
                  {(() => {
                    const sr = state as SectionResult
                    const hIdx = { n: 0 }
                    const srcIcon = (url: string | undefined) => !url ? null : (
                      <a href={url} target="_blank" rel="noopener noreferrer"
                         className="inline-flex items-center ml-1.5 text-slate-400 active:text-blue-600"
                         onClick={e => e.stopPropagation()}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                          <polyline points="15 3 21 3 21 9"/>
                          <line x1="10" y1="14" x2="21" y2="3"/>
                        </svg>
                      </a>
                    )
                    return (
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                        h1: ({children}) => {
                          const src = sr.sources[hIdx.n++]
                          return <h1 className="text-[15px] font-bold text-slate-800 mt-3 mb-1 flex items-center">{children}{srcIcon(src)}</h1>
                        },
                        h2: ({children}) => {
                          const src = sr.sources[hIdx.n++]
                          return <h2 className="text-[13px] font-bold text-slate-800 mt-2.5 mb-1 flex items-center">{children}{srcIcon(src)}</h2>
                        },
                        h3: ({children}) => {
                          const src = sr.sources[hIdx.n++]
                          return <h3 className="text-[12px] font-semibold text-slate-600 mt-2 mb-0.5 flex items-center">{children}{srcIcon(src)}</h3>
                        },
                        p:  ({children}) => <p className="mb-1.5">{children}</p>,
                        ul: ({children}) => <ul className="list-disc list-outside pl-5 mb-1.5 space-y-0.5">{children}</ul>,
                        ol: ({children}) => <ol className="list-decimal list-outside pl-5 mb-1.5 space-y-0.5">{children}</ol>,
                        li: ({children}) => <li className="text-[11px] leading-snug pl-0.5">{children}</li>,
                        strong: ({children}) => <strong className="font-semibold text-slate-800">{children}</strong>,
                        table: ({children}) => (
                          <div className="overflow-x-auto my-2">
                            <table className="border-collapse text-[10px]">{children}</table>
                          </div>
                        ),
                        thead: ({children}) => <thead className="bg-white/60">{children}</thead>,
                        tbody: ({children}) => <tbody className="divide-y divide-slate-100">{children}</tbody>,
                        th: ({children}) => <th className="px-2 py-1.5 text-left font-semibold text-slate-600 whitespace-nowrap border border-slate-200">{children}</th>,
                        td: ({children}) => <td className="px-2 py-1.5 text-slate-700 border border-slate-200 whitespace-nowrap align-top">{children}</td>,
                        hr: () => <hr className="my-2 border-slate-200" />,
                      }}>
                        {sr.text}
                      </ReactMarkdown>
                    )
                  })()}
                </div>
                </>
                )}
              </div>
            )}
          </div>
        )
      })}

      {reportTab === 'quickstats' && qs?.partial && (
        <p className="text-[10px] text-slate-400 text-center pb-1">
          Some data unavailable for this symbol
        </p>
      )}


      <DeepResearchChat
        isOpen={showChat}
        onClose={() => setShowChat(false)}
        yf_symbol={yf_symbol}
        stockName={displayName}
        initialContextId={chatInitialContext}
        sections={SECTIONS.map(s => {
          const st = sectionStates[s.id]
          return {
            id: s.id,
            label: s.label,
            emoji: s.emoji,
            text: (typeof st === 'object' && st !== null && 'text' in st) ? (st as { text: string }).text : null,
          }
        })}
        useLite={useLite}
        use31={use31}
        useKey={useKey}
      />

    </div>
  )
}
