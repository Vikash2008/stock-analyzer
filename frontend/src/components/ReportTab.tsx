import React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import type { QuickStats } from '../api/types'
import { SECTIONS, buildPerplexityUrl, buildFullReportUrl } from '../utils/reportLinks'

const API_URL = (import.meta.env.VITE_API_URL ?? '') as string

interface Props {
  yf_symbol: string
  name:      string
  qs:        QuickStats | undefined
  loading:   boolean
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

function recColor(rec: string | null): string {
  if (!rec) return '#94a3b8'
  const r = rec.toLowerCase()
  if (r.includes('buy')) return '#0a7a42'
  if (r.includes('sell') || r.includes('underperform')) return '#be1c1c'
  return '#b45309'
}

export function ReportTab({ yf_symbol, name, qs, loading }: Props) {
  const isIndian = yf_symbol.endsWith('.NS') || yf_symbol.endsWith('.BO')
  const displayName = name || yf_symbol
  const qc = useQueryClient()
  const [syncing, setSyncing] = React.useState(false)

  async function handleSync() {
    setSyncing(true)
    try {
      await fetch(`${API_URL}/api/quickstats?yf_symbol=${encodeURIComponent(yf_symbol)}&force_refresh=true`)
      await qc.invalidateQueries({ queryKey: ['quickstats', yf_symbol] })
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

      {/* ── Quick Stats ─────────────────────────────────────── */}
      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="h-0.5 bg-slate-100">
            <div className="h-full w-2/5 bg-blue-500 rounded-full"
                 style={{ animation: 'qs-progress 1.2s ease-in-out infinite' }} />
          </div>
          <div className="px-3 py-5 flex items-center justify-center gap-2 text-slate-400 text-[12px]">
            Loading stats…
          </div>
        </div>
      ) : qs ? (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          {/* Progress bar — shown during sync */}
          <div className="h-0.5 bg-slate-100">
            {syncing && (
              <div className="h-full w-2/5 bg-blue-500 rounded-full"
                   style={{ animation: 'qs-progress 1.2s ease-in-out infinite' }} />
            )}
          </div>
          <div className="px-3 py-3 space-y-3">

          {/* Source link + sync */}
          <div className="flex items-center justify-between -mb-1">
            <button
              onClick={handleSync}
              className={`text-[10px] text-slate-400 px-1.5 py-0.5 rounded active:bg-slate-100 ${syncing ? 'animate-spin pointer-events-none' : ''}`}
              title="Force refresh from source"
            >
              ↻
            </button>
            <a
              href={isIndian
                ? `https://www.screener.in/company/${yf_symbol.replace(/\.(NS|BO)$/i, '')}/`
                : `https://finance.yahoo.com/quote/${encodeURIComponent(yf_symbol)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10px] text-slate-400 active:text-slate-600"
            >
              <span>{isIndian ? 'Screener' : 'Yahoo Finance'}</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                <polyline points="15 3 21 3 21 9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
            </a>
          </div>

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
              <div key={label} className="bg-slate-50 rounded-lg p-1.5">
                <div className="text-[9px] text-slate-400 uppercase tracking-wide mb-0.5 truncate">{label}</div>
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
              <div className="text-[10px] text-slate-400 uppercase tracking-wide mb-2">52-Week Range</div>
              <div className="relative h-1.5 rounded-full overflow-visible"
                   style={{ background: 'linear-gradient(to right, #fca5a5, #fde68a, #86efac)' }}>
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2 border-[#2563eb] shadow-sm"
                  style={{ left: `calc(${rangePos * 100}% - 6px)` }}
                />
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="text-[10px] text-slate-400">
                  {fmtPrice(qs.week_52_low, qs.currency)}
                </span>
                <span className="text-[10px] font-semibold text-[#2563eb]">
                  {fmtPrice(qs.current_price, qs.currency)}
                </span>
                <span className="text-[9px] text-slate-400">
                  {fmtPrice(qs.week_52_high, qs.currency)}
                </span>
              </div>
            </div>
          )}

          {/* Analyst row */}
          {(qs.recommendation || qs.num_analyst_opinions || qs.target_mean_price) && (
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2">
                {qs.recommendation && (
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{
                      color:      recColor(qs.recommendation),
                      background: recColor(qs.recommendation) + '18',
                    }}
                  >
                    {qs.recommendation}
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
          </div>{/* inner px-3 */}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-center text-slate-400 text-[11px]">
          Stats unavailable for this symbol
        </div>
      )}

      {/* ── PE History chart ────────────────────────────────── */}
      {qs?.pe_history && qs.pe_history.length > 0 && (
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
                <span className="text-[9px] text-slate-400">Min {min.toFixed(1)}×</span>
                <span className="text-[9px] text-slate-400">Avg {avg.toFixed(1)}×</span>
                <span className="text-[9px] text-slate-400">Max {max.toFixed(1)}×</span>
              </div>
            )
          })()}
        </div>
      )}

      {/* ── Analysis sections ───────────────────────────────── */}
      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest pt-1">
        Analysis
      </div>

      {SECTIONS.map(section => {
        let href = buildPerplexityUrl(displayName, section.id, isIndian, yf_symbol)
        if (section.id === 'results' && isIndian) {
          const cleanSym = yf_symbol.replace(/\.(NS|BO)$/i, '')
          const filingUrl = `${API_URL}/api/filing/${cleanSym}`
          const prompt = `${filingUrl}\n\nAnalyze this quarterly earnings filing for ${displayName}. Write as a buy-side analyst — no preamble, output directly:\n- Executive summary (3 lines)\n- Quarter scorecard table: Revenue, Net Profit, EPS, Key Margin — with YoY and QoQ\n- Segment performance\n- What went well (exact numbers)\n- What was weak / concerning (exact numbers)\n- Management guidance\n- Key risks\n- Verdict: Very Strong / Strong / Mixed / Weak`
          href = `https://www.perplexity.ai/search?q=${encodeURIComponent(prompt)}`
        }
        return (
        <a
          key={section.id}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5 active:bg-slate-50 no-underline"
        >
          <div className="flex items-start gap-2.5 min-w-0">
            <span className="text-[18px] shrink-0 mt-0.5 leading-none">{section.emoji}</span>
            <div className="min-w-0">
              <div className="text-[12px] font-semibold text-slate-800">{section.label}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{section.description}</div>
            </div>
          </div>
          <span className="text-slate-400 text-[14px] mt-0.5 shrink-0 ml-3">↗</span>
        </a>
        )
      })}

      {/* ── Full Report button ───────────────────────────────── */}
      <a
        href={buildFullReportUrl(displayName, isIndian, yf_symbol)}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 w-full rounded-xl border border-[#2563eb] text-[#2563eb] bg-white py-2.5 text-[12px] font-semibold active:bg-blue-50 no-underline mt-1"
      >
        Open Full Report in Perplexity ↗
      </a>

      {qs?.partial && (
        <p className="text-[10px] text-slate-400 text-center pb-1">
          Some data unavailable for this symbol
        </p>
      )}
    </div>
  )
}
