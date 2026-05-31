import React from 'react'
import type { QuickStats } from '../api/types'
import { SECTIONS, buildPerplexityUrl, buildFullReportUrl } from '../utils/reportLinks'

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

  const rangePos =
    qs?.week_52_high && qs?.week_52_low && qs?.current_price
      ? Math.max(0, Math.min(1,
          (qs.current_price - qs.week_52_low) /
          (qs.week_52_high  - qs.week_52_low)
        ))
      : null

  return (
    <div className="space-y-3 pb-4">

      {/* ── Quick Stats ─────────────────────────────────────── */}
      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5 flex items-center justify-center gap-2 text-slate-400 text-[12px]">
          <span className="animate-spin inline-block text-[16px]">↻</span>
          Loading stats…
        </div>
      ) : qs ? (
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 space-y-3">

          {/* Row 1: Valuation ratios */}
          <div className="grid grid-cols-4 gap-x-1">
            {[
              { label: 'P/E',     value: fmtPe(qs.trailing_pe) },
              { label: 'Fwd P/E', value: fmtPe(qs.forward_pe)  },
              { label: 'MCap',    value: qs.market_cap_display ?? '—' },
              { label: 'Beta',    value: qs.beta != null ? qs.beta.toFixed(2) : '—' },
            ].map(({ label, value }) => (
              <div key={label}>
                <div className="text-[8px] text-slate-400 uppercase tracking-wide mb-0.5">{label}</div>
                <div className="text-[12px] font-semibold text-slate-800 whitespace-nowrap">{value}</div>
              </div>
            ))}
          </div>

          {/* Div yield (only if non-zero) */}
          {qs.dividend_yield != null && qs.dividend_yield > 0 && (
            <div className="text-[10px] text-slate-500">
              Dividend yield{' '}
              <span className="font-semibold text-slate-700">
                {(qs.dividend_yield * 100).toFixed(2)}%
              </span>
            </div>
          )}

          {/* 52W range bar */}
          {rangePos !== null && qs.week_52_low != null && qs.week_52_high != null && qs.current_price != null && (
            <div>
              <div className="text-[8px] text-slate-400 uppercase tracking-wide mb-2">52-Week Range</div>
              <div className="relative h-1.5 rounded-full overflow-visible"
                   style={{ background: 'linear-gradient(to right, #fca5a5, #fde68a, #86efac)' }}>
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2 border-[#2563eb] shadow-sm"
                  style={{ left: `calc(${rangePos * 100}% - 6px)` }}
                />
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="text-[9px] text-slate-400">
                  {fmtPrice(qs.week_52_low, qs.currency)}
                </span>
                <span className="text-[9px] font-semibold text-[#2563eb]">
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
                  <span className="text-[9px] text-slate-400">
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
                      className="text-[9px] ml-1"
                      style={{ color: qs.upside_pct >= 0 ? '#0a7a42' : '#be1c1c' }}
                    >
                      ({qs.upside_pct >= 0 ? '+' : ''}{qs.upside_pct.toFixed(1)}%)
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-center text-slate-400 text-[11px]">
          Stats unavailable for this symbol
        </div>
      )}

      {/* ── Analysis sections ───────────────────────────────── */}
      <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest pt-1">
        Analysis
      </div>

      {SECTIONS.map(section => (
        <a
          key={section.id}
          href={buildPerplexityUrl(displayName, section.id, isIndian)}
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
      ))}

      {/* ── Full Report button ───────────────────────────────── */}
      <a
        href={buildFullReportUrl(displayName, isIndian)}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 w-full rounded-xl border border-[#2563eb] text-[#2563eb] bg-white py-2.5 text-[12px] font-semibold active:bg-blue-50 no-underline mt-1"
      >
        Open Full Report in Perplexity ↗
      </a>

      {qs?.partial && (
        <p className="text-[9px] text-slate-400 text-center pb-1">
          Some data unavailable for this symbol
        </p>
      )}
    </div>
  )
}
