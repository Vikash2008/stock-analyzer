import { useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useQuickStats } from '../hooks/useQuickStats'
import { ReportTab } from '../components/ReportTab'
import { AnalysisTab } from '../components/AnalysisTab'
import { PriceChart } from '../components/PriceChart'

type ActiveTab    = 'report' | 'charts' | 'notes'
type ReportSubTab = 'quickstats' | 'deep'

export default function ResearchPage() {
  const navigate  = useNavigate()
  const { symbol } = useParams<{ symbol: string }>()
  const location  = useLocation()
  const qc        = useQueryClient()

  const yf_symbol = decodeURIComponent(symbol ?? '').toUpperCase()
  const locName   = (location.state as { name?: string } | null)?.name
  const isIndian  = yf_symbol.endsWith('.NS') || yf_symbol.endsWith('.BO')

  const [activeTab,      setActiveTab]      = useState<ActiveTab>('report')
  const [reportSubTab,   setReportSubTab]   = useState<ReportSubTab>('quickstats')
  const [reportUseLite,  setReportUseLite]  = useState(false)
  const [reportUseKey,   setReportUseKey]   = useState<0 | 1>(() =>
    localStorage.getItem('gemini:key_index') === '1' ? 1 : 0)
  const [reportGearOpen, setReportGearOpen] = useState(false)
  const [reportSyncing,  setReportSyncing]  = useState(false)
  const [chartSyncing,   setChartSyncing]   = useState(false)

  const { data: qs, isPending: qsPending, isFetching: qsFetching } =
    useQuickStats(yf_symbol, true)

  const name    = locName ?? yf_symbol
  const cur     = qs?.current_price ?? null
  const hi      = qs?.week_52_high  ?? null
  const lo      = qs?.week_52_low   ?? null
  const fmtPx   = (v: number) => isIndian
    ? `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
    : `$${v.toLocaleString('en-US', { maximumFractionDigits: 2 })}`

  return (
    <div className="h-[100dvh] flex flex-col bg-white max-w-xl mx-auto">

      {/* ── Sticky header ─────────────────────────────────── */}
      <div className="shrink-0 px-4 pt-4 bg-white">

        {/* Back */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1 text-[11px] text-[#2563eb] mb-3 active:text-blue-800"
        >
          ← Home
        </button>

        {/* Overview card */}
        <div
          className="rounded-xl border bg-slate-50 px-4 py-3 mb-3 shadow-sm"
          style={{ borderColor: '#e0e7ff', borderLeftWidth: 4, borderLeftColor: '#6366f1' }}
        >
          {/* Name row + sector */}
          <div className="flex items-start justify-between mb-1.5">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold text-slate-800 leading-tight truncate">{locName ?? qs?.company_name ?? yf_symbol}</p>
            </div>
            {qs && (qs.sector ?? qs.industry) && (
              <p className="text-[10px] text-slate-500 truncate max-w-[110px] ml-3 shrink-0 text-right">{qs.sector ?? qs.industry}</p>
            )}
          </div>

          {/* Price + 1Y return + 52W + 5Y CAGR */}
          {qs ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-[20px] font-bold text-slate-900">
                  {cur != null ? fmtPx(cur) : '—'}
                </span>
                <div className="text-right shrink-0 ml-2">
                  {qs.one_year_return != null ? (
                    <p className="text-[14px] font-semibold" style={{ color: qs.one_year_return >= 0 ? '#0a7a42' : '#be1c1c' }}>
                      CAGR 1Y: {qs.one_year_return >= 0 ? '+' : ''}{(qs.one_year_return * 100).toFixed(1)}%
                    </p>
                  ) : (
                    <p className="text-[14px] text-slate-400">CAGR 1Y: —</p>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between mt-0.5">
                {hi != null && lo != null ? (
                  <p className="text-[10px] text-slate-400">52W {fmtPx(lo)} – {fmtPx(hi)}</p>
                ) : (
                  <span />
                )}
                {qs.five_year_cagr != null && (
                  <p className="text-[10px] font-semibold shrink-0 ml-2" style={{ color: qs.five_year_cagr >= 0 ? '#0a7a42' : '#be1c1c' }}>
                    CAGR 5Y: {qs.five_year_cagr >= 0 ? '+' : ''}{(qs.five_year_cagr * 100).toFixed(1)}%
                  </p>
                )}
              </div>
            </>
          ) : (
            <p className="text-[13px] text-slate-400 animate-pulse">
              {qsPending || qsFetching ? 'Loading…' : 'Stats unavailable'}
            </p>
          )}
        </div>

        {/* Tab bar */}
        <div className="flex bg-slate-100 rounded-full p-0.5 gap-0.5 mb-2">
          {([['report', 'Research'], ['charts', 'Charts'], ['notes', 'Notes']] as const).map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 text-[10px] py-1 rounded-full font-medium transition-all ${
                activeTab === tab
                  ? tab === 'report'
                    ? 'bg-violet-200 text-violet-800 shadow-sm'
                    : tab === 'charts'
                    ? 'bg-sky-200 text-sky-800 shadow-sm'
                    : 'bg-rose-200 text-rose-800 shadow-sm'
                  : 'text-slate-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Research strip */}
        {activeTab === 'report' && (
          <div className="bg-violet-50 border border-violet-100 rounded-xl px-2.5 py-1.5 mb-2 flex items-center justify-between">
            <div className="flex items-center bg-violet-100 rounded-lg p-0.5 gap-0.5">
              <button
                onClick={() => setReportSubTab('quickstats')}
                className={`text-[10px] px-2.5 py-1 rounded-md transition-colors font-medium ${
                  reportSubTab === 'quickstats'
                    ? 'bg-emerald-500 text-white shadow-sm border border-emerald-600'
                    : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                }`}
              >Quick Stats</button>
              <button
                onClick={() => setReportSubTab('deep')}
                className={`text-[10px] px-2.5 py-1 rounded-md transition-colors font-medium ${
                  reportSubTab === 'deep'
                    ? 'bg-violet-600 text-white shadow-sm border border-violet-700'
                    : 'bg-violet-200 text-violet-600 border border-violet-300'
                }`}
              >Deep Research</button>
            </div>

            {reportSubTab === 'deep' ? (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setReportUseLite(v => !v)}
                  className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium border transition-colors ${
                    reportUseLite
                      ? 'bg-slate-100 text-slate-500 border-slate-300'
                      : 'bg-violet-100 text-violet-700 border-violet-300'
                  }`}
                >
                  <span>{reportUseLite ? '⚡' : '🌐'}</span>
                  <span>{reportUseLite ? '3.1 Lite' : '2.5 Pro'}</span>
                </button>
                <div className="relative">
                  <button
                    onClick={() => setReportGearOpen(o => !o)}
                    className="p-1 text-violet-400 active:text-violet-600"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="3"/>
                      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
                    </svg>
                  </button>
                  {reportGearOpen && (
                    <>
                      <div className="fixed inset-0 z-[9]" onClick={() => setReportGearOpen(false)} />
                      <div className="absolute right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg z-10 px-3 py-2.5 flex items-center gap-3 whitespace-nowrap">
                        <span className="text-[11px] text-slate-600">Backup Key</span>
                        <button
                          onClick={() => {
                            const next = (reportUseKey === 0 ? 1 : 0) as 0 | 1
                            setReportUseKey(next)
                            localStorage.setItem('gemini:key_index', String(next))
                          }}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${reportUseKey === 1 ? 'bg-blue-500' : 'bg-slate-200'}`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${reportUseKey === 1 ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <button
                className="flex items-center gap-0.5 rounded-full px-1.5 py-0.5 border active:opacity-60 bg-gradient-to-br from-violet-600 to-purple-800 border-violet-700"
                onClick={() => {
                  if (reportSyncing) return
                  setReportSyncing(true)
                  qc.resetQueries({ queryKey: ['quickstats', yf_symbol] })
                  setTimeout(() => setReportSyncing(false), 1500)
                }}
              >
                <span className={`text-[9px] text-white leading-none inline-block ${reportSyncing ? 'animate-spin' : ''}`}>↻</span>
              </button>
            )}
          </div>
        )}

        {/* Charts strip */}
        {activeTab === 'charts' && (
          <div className="bg-sky-50 border border-sky-200 rounded-xl px-2.5 py-1.5 mb-2">
            <div className="flex items-center gap-2">
              <div
                className="flex gap-0.5 overflow-x-auto flex-1 rounded-lg p-0.5"
                style={{ backgroundColor: '#bae6fd44', scrollbarWidth: 'none' } as React.CSSProperties}
              >
                <button className="text-[10px] whitespace-nowrap px-2.5 py-1 rounded-md font-medium transition-all bg-sky-500 text-white shadow-sm border border-sky-600">
                  Price
                </button>
              </div>
              <button
                className="flex items-center gap-0.5 shrink-0 rounded-full px-1.5 py-0.5 border active:opacity-60 bg-gradient-to-br from-sky-600 to-cyan-700 border-sky-700"
                onClick={() => {
                  if (chartSyncing) return
                  setChartSyncing(true)
                  qc.invalidateQueries({ queryKey: ['history', yf_symbol] })
                  setTimeout(() => setChartSyncing(false), 1500)
                }}
              >
                <span className={`text-[9px] text-white leading-none inline-block ${chartSyncing ? 'animate-spin' : ''}`}>↻</span>
              </button>
            </div>
          </div>
        )}

        {/* Notes strip */}
        {activeTab === 'notes' && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl px-2.5 py-1.5 mb-2 flex items-center">
            <span className="text-[10px] text-rose-700">Personal notes</span>
          </div>
        )}
      </div>

      {/* ── Scrollable content ────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {activeTab === 'report' && (
          <ReportTab
            yf_symbol={yf_symbol}
            name={name}
            qs={qs}
            loading={qsPending || qsFetching}
            reportTab={reportSubTab}
            useLite={reportUseLite}
            useKey={reportUseKey}
          />
        )}
        {activeTab === 'charts' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-3 mt-1">
            <PriceChart
              transactions={[]}
              yf_symbol={yf_symbol}
              currency={isIndian ? 'INR' : 'USD'}
              usdInr={95.5}
              hideLegend
              showZoom
            />
          </div>
        )}
        {activeTab === 'notes' && (
          <AnalysisTab portfolio="research" symbol={yf_symbol} />
        )}
      </div>
    </div>
  )
}
