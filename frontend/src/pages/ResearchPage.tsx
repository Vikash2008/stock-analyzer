import { useState, useRef, useEffect } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useQuickStats } from '../hooks/useQuickStats'
import { useIsWatchlisted, useAddToWatchlist, useRemoveFromWatchlist } from '../hooks/useWatchlist'
import { usePortfolio } from '../hooks/usePortfolio'
import { ReportTab } from '../components/ReportTab'
import { AnalysisTab } from '../components/AnalysisTab'
import { PriceChart } from '../components/PriceChart'
import { AddTransactionModal } from '../components/AddTransactionModal'

type ActiveTab    = 'report' | 'charts' | 'notes'
type ReportSubTab = 'quickstats' | 'deep' | 'links'

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
  const [reportUse31,    setReportUse31]    = useState(false)
  const [reportUseKey,   setReportUseKey]   = useState<0 | 1 | 2>(() => { const v = localStorage.getItem('gemini:key_index'); return (v === '1' ? 1 : v === '2' ? 2 : 0) })
  const [reportSyncing,  setReportSyncing]  = useState(false)
  const [chartSyncing,   setChartSyncing]   = useState(false)
  const [deepFullScreen, setDeepFullScreen] = useState(false)
  const [settingsOpen,   setSettingsOpen]   = useState(false)
  const [addTxnOpen,     setAddTxnOpen]     = useState(false)
  const chatOpenerRef = useRef<{ open: (contextId?: string) => void } | null>(null)

  const { data: portfolioData } = usePortfolio()

  // Full-screen reading only makes sense while actually looking at Deep Research —
  // drop it automatically if the user navigates away so they don't get stranded with
  // no header on an unrelated tab.
  useEffect(() => {
    if (!(activeTab === 'report' && reportSubTab === 'deep')) setDeepFullScreen(false)
  }, [activeTab, reportSubTab])

  const { data: qs, isPending: qsPending, isFetching: qsFetching } =
    useQuickStats(yf_symbol, true)

  const name    = locName ?? yf_symbol
  const cur     = qs?.current_price ?? null
  const hi      = qs?.week_52_high  ?? null
  const lo      = qs?.week_52_low   ?? null
  const fmtPx   = (v: number) => isIndian
    ? `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
    : `$${v.toLocaleString('en-US', { maximumFractionDigits: 2 })}`

  const cleanSymbol = yf_symbol.replace(/\.(NS|BO)$/i, '')
  const exchange    = yf_symbol.endsWith('.BO') ? 'BSE' : yf_symbol.endsWith('.NS') ? 'NSE' : 'US'

  const isWatchlisted   = useIsWatchlisted(yf_symbol)
  const addWatchlist    = useAddToWatchlist()
  const removeWatchlist = useRemoveFromWatchlist()
  const toggleWatchlist = () => {
    if (isWatchlisted) {
      removeWatchlist.mutate(yf_symbol)
    } else {
      addWatchlist.mutate({
        yf_symbol,
        symbol: cleanSymbol,
        name: qs?.company_name ?? locName ?? yf_symbol,
        exchange,
        currency: isIndian ? 'INR' : 'USD',
      })
    }
  }

  return (
    <div
      className="flex flex-col bg-white max-w-xl mx-auto"
      style={{ height: 'calc(100dvh - var(--reauth-banner-h, 0px))', marginTop: 'var(--reauth-banner-h, 0px)' }}
    >

      {/* ── Sticky header ─────────────────────────────────── */}
      <div className="shrink-0 px-1 bg-white">

        {!deepFullScreen && (
        <>
        {/* Nav row — Back, Watchlist star, Settings — fused with the Overview card below into one block */}
        <div
          className="flex items-center justify-between px-4 py-2 min-h-[46px] border-4 rounded-t-[14px]"
          style={{ borderColor: '#0b3b3a', background: '#e6f7f5' }}
        >
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-[#0b3b3a] active:opacity-70"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            <span className="text-[17px] font-extrabold tracking-tight whitespace-nowrap">Explore</span>
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={toggleWatchlist}
              aria-label={isWatchlisted ? 'Remove from watchlist' : 'Add to watchlist'}
              className="w-[30px] h-[30px] flex items-center justify-center rounded-full active:bg-teal-50"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill={isWatchlisted ? '#f59e0b' : 'none'} stroke={isWatchlisted ? '#f59e0b' : '#94a3b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </button>
            <div className="relative">
              <button
                onClick={() => setSettingsOpen(o => !o)}
                aria-label="Settings"
                className={`w-[30px] h-[30px] flex items-center justify-center rounded-full transition-colors text-[#0b3b3a] ${settingsOpen ? 'bg-teal-50' : 'active:bg-teal-50'}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 0 0-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 0 0-2.282.819l-.922 1.597a1.875 1.875 0 0 0 .432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 0 0 0 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 0 0-.432 2.385l.922 1.597a1.875 1.875 0 0 0 2.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.985.57.182.088.277.228.297.35l.178 1.071c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.673-.356.985-.57.167-.114.335-.125.45-.082l1.02.382a1.875 1.875 0 0 0 2.28-.819l.923-1.597a1.875 1.875 0 0 0-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 0 0 0-1.139c-.016-.2.059-.352.153-.43l.84-.692c.708-.582.891-1.59.433-2.385l-.922-1.597a1.875 1.875 0 0 0-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 0 0-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 0 0-1.85-1.567h-1.843ZM12 15.75a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z" clipRule="evenodd" />
                </svg>
              </button>
              {settingsOpen && (
                <>
                  <div className="fixed inset-0 z-[998]" onClick={() => setSettingsOpen(false)} />
                  <div className="absolute right-0 top-full mt-1.5 z-[999] w-[320px] max-w-[calc(100vw-24px)] rounded-2xl overflow-hidden shadow-xl">
                    <div className="flex items-center justify-between px-4 py-[11px]" style={{ background: 'linear-gradient(135deg, #0b3b3a 0%, #0d9488 100%)' }}>
                      <p className="text-[13.5px] font-extrabold text-white tracking-[-0.2px]">Settings</p>
                      <button onClick={() => setSettingsOpen(false)} className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[13px] leading-none" style={{ background: 'rgba(255,255,255,0.12)' }}>✕</button>
                    </div>
                    <div className="flex flex-col gap-1.5" style={{ background: '#f8fafc', padding: '10px 14px' }}>
                      <div className="bg-teal-50/60 border border-teal-100 rounded-lg px-2.5 py-[7px] flex items-center justify-between gap-2">
                        <span className="text-[12px] font-bold text-[#0b3b3a]">Add Transaction</span>
                        <button
                          onClick={() => { setSettingsOpen(false); setAddTxnOpen(true) }}
                          className="w-[70px] text-center text-white text-[10px] font-semibold rounded-full px-3 py-1 active:opacity-80"
                          style={{ background: 'linear-gradient(135deg, #0b3b3a 0%, #0d9488 100%)' }}
                        >
                          Add Txn
                        </button>
                      </div>
                      <div className="bg-teal-50/60 border border-teal-100 rounded-lg px-2.5 py-[7px] flex items-center justify-between gap-2">
                        <span className="text-[12px] font-bold text-[#0b3b3a]">Charts</span>
                        <button
                          onClick={() => {
                            if (chartSyncing) return
                            setChartSyncing(true)
                            qc.invalidateQueries({ queryKey: ['history', yf_symbol] })
                            setTimeout(() => setChartSyncing(false), 1500)
                          }}
                          className="w-[70px] text-center text-white text-[10px] font-semibold rounded-full px-3 py-1 active:opacity-80"
                          style={{ background: 'linear-gradient(135deg, #0b3b3a 0%, #0d9488 100%)' }}
                        >
                          {chartSyncing ? 'Syncing…' : 'Refresh'}
                        </button>
                      </div>
                      <div className="bg-teal-50/60 border border-teal-100 rounded-lg px-2.5 py-[7px] flex items-center justify-between gap-2">
                        <span className="text-[12px] font-bold text-[#0b3b3a] shrink-0">AI Model</span>
                        <div className="flex bg-white rounded-full p-0.5 gap-0.5 border border-teal-100">
                          {([
                            { label: '2.5 Flash', lite: false, is31: false },
                            { label: '2.5 Lite',  lite: true,  is31: false },
                            { label: '3.1 Lite',  lite: false, is31: true  },
                          ] as const).map(opt => {
                            const active = opt.is31 ? reportUse31 : (!reportUse31 && reportUseLite === opt.lite)
                            return (
                              <button key={opt.label}
                                onClick={() => { setReportUse31(opt.is31); setReportUseLite(opt.lite) }}
                                className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium transition-colors whitespace-nowrap ${active ? 'text-white shadow-sm' : 'text-slate-400'}`}
                                style={active ? { background: 'linear-gradient(135deg, #0b3b3a 0%, #0d9488 100%)' } : undefined}
                              >{opt.label}</button>
                            )
                          })}
                        </div>
                      </div>
                      <div className="bg-teal-50/60 border border-teal-100 rounded-lg px-2.5 py-[7px] flex items-center justify-between gap-2">
                        <span className="text-[12px] font-bold text-[#0b3b3a] shrink-0">API Key</span>
                        <div className="flex bg-white rounded-full p-0.5 gap-0.5 border border-teal-100">
                          {([0, 1, 2] as const).map(i => (
                            <button
                              key={i}
                              onClick={() => { setReportUseKey(i); localStorage.setItem('gemini:key_index', String(i)) }}
                              className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium transition-colors whitespace-nowrap ${reportUseKey === i ? 'text-white shadow-sm' : 'text-slate-400 active:bg-teal-50'}`}
                              style={reportUseKey === i ? { background: 'linear-gradient(135deg, #0b3b3a 0%, #0d9488 100%)' } : undefined}
                            >Key {i + 1}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Overview card — same dark hero style as SummaryCard (Transactions/Holdings pages), sits flush under the Nav row above so the two read as one component */}
        <div
          className="rounded-b-[18px] p-4 mb-3 relative overflow-hidden"
          style={{ background: 'linear-gradient(150deg, #10243f 0%, #0b3b3a 100%)', boxShadow: '0 14px 30px -10px rgba(11,59,58,0.45)' }}
        >
          <div className="absolute top-[-40px] right-[-40px] w-[160px] h-[160px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(45,212,191,0.25), transparent 70%)' }} />
          <div className="relative">
            <p className="text-[11px] font-bold uppercase tracking-[1.2px] truncate mb-2" style={{ color: '#99e6dc' }}>{locName ?? qs?.company_name ?? yf_symbol}</p>

            {qs ? (
              <>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[22px] font-extrabold text-white tracking-tight">{cur != null ? fmtPx(cur) : '—'}</span>
                  <span
                    className="text-[11px] font-bold rounded-full px-3 py-1 whitespace-nowrap shrink-0"
                    style={{ background: 'rgba(45,212,191,0.18)', color: (qs.today_pct ?? 0) >= 0 ? '#5eead4' : '#fca5a5', border: '1px solid rgba(94,234,212,0.3)' }}
                  >
                    {qs.today_pct != null ? `Day ${qs.today_pct >= 0 ? '+' : ''}${qs.today_pct.toFixed(1)}%` : 'Day —'}
                  </span>
                </div>

                <div className="grid gap-y-0.5 items-center mt-1" style={{ gridTemplateColumns: '1fr auto', color: 'rgba(255,255,255,0.55)' }}>
                  <span className="text-[11px]">52W Low <span className="font-semibold text-white">{lo != null ? fmtPx(lo) : '—'}</span></span>
                  <span className="text-[11px]">52W High <span className="font-semibold text-white">{hi != null ? fmtPx(hi) : '—'}</span></span>
                </div>

                <div className="flex justify-between pt-2.5 mt-2.5" style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[8px] font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.45)' }}>1Y Return</span>
                    <span className="text-[13px] font-bold whitespace-nowrap" style={{ color: (qs.one_year_return ?? 0) >= 0 ? '#5eead4' : '#fca5a5' }}>
                      {qs.one_year_return != null ? `${qs.one_year_return >= 0 ? '+' : ''}${(qs.one_year_return * 100).toFixed(1)}%` : '—'}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5 items-end">
                    <span className="text-[8px] font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.45)' }}>5Y CAGR</span>
                    <span className="text-[13px] font-bold whitespace-nowrap" style={{ color: (qs.five_year_cagr ?? 0) >= 0 ? '#5eead4' : '#fca5a5' }}>
                      {qs.five_year_cagr != null ? `${qs.five_year_cagr >= 0 ? '+' : ''}${(qs.five_year_cagr * 100).toFixed(1)}%` : '—'}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-[13px] animate-pulse" style={{ color: 'rgba(255,255,255,0.55)' }}>
                {qsPending || qsFetching ? 'Loading…' : 'Stats unavailable'}
              </p>
            )}
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex bg-slate-100 rounded-full p-0.5 gap-0.5 mb-2">
          {([['report', 'Research'], ['charts', 'Charts'], ['notes', 'Notes']] as const).map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 text-[11px] py-1.5 rounded-full font-medium transition-all ${
                activeTab === tab ? 'text-white shadow-sm' : 'text-slate-500'
              }`}
              style={activeTab === tab ? { background: 'linear-gradient(135deg, #0b3b3a 0%, #0d9488 100%)' } : undefined}
            >
              {label}
            </button>
          ))}
        </div>
        </>
        )}

        {/* Research strip */}
        {activeTab === 'report' && (
          <div className="bg-teal-50 border border-teal-100 rounded-xl px-2.5 py-1.5 mb-2 min-h-[38px] flex items-center justify-between">
            <div className="flex items-center bg-teal-100 rounded-lg p-0.5 gap-0.5">
              <button
                onClick={() => setReportSubTab('quickstats')}
                className={`text-[10px] px-2.5 py-1 rounded-md transition-colors font-medium ${reportSubTab === 'quickstats' ? 'text-white shadow-sm border border-teal-700' : 'bg-teal-50 text-teal-700 border border-teal-200'}`}
                style={reportSubTab === 'quickstats' ? { background: 'linear-gradient(135deg, #0b3b3a 0%, #0d9488 100%)' } : undefined}
              >Quick Stats</button>
              <button
                onClick={() => setReportSubTab('deep')}
                className={`text-[10px] px-2.5 py-1 rounded-md transition-colors font-medium ${reportSubTab === 'deep' ? 'text-white shadow-sm border border-teal-700' : 'bg-teal-50 text-teal-700 border border-teal-200'}`}
                style={reportSubTab === 'deep' ? { background: 'linear-gradient(135deg, #0b3b3a 0%, #0d9488 100%)' } : undefined}
              >Deep Research</button>
              <button
                onClick={() => setReportSubTab('links')}
                className={`text-[10px] px-2.5 py-1 rounded-md transition-colors font-medium ${reportSubTab === 'links' ? 'text-white shadow-sm border border-teal-700' : 'bg-teal-50 text-teal-700 border border-teal-200'}`}
                style={reportSubTab === 'links' ? { background: 'linear-gradient(135deg, #0b3b3a 0%, #0d9488 100%)' } : undefined}
              >Explore</button>
            </div>

            {reportSubTab === 'links' ? null : reportSubTab === 'deep' ? (
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => setDeepFullScreen(v => !v)}
                  title={deepFullScreen ? 'Exit full screen' : 'Full screen'}
                  className="p-1 text-teal-500 active:text-teal-700 shrink-0"
                >
                  {deepFullScreen ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 3v4a1 1 0 01-1 1H4M15 3v4a1 1 0 001 1h4M9 21v-4a1 1 0 00-1-1H4M15 21v-4a1 1 0 011-1h4"/>
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M8 3H4v4M16 3h4v4M8 21H4v-4M16 21h4v-4"/>
                    </svg>
                  )}
                </button>
                <button
                  onClick={() => chatOpenerRef.current?.open()}
                  className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full text-white shrink-0 shadow-sm ring-1 ring-white/40 active:scale-95 transition-transform"
                  style={{ background: 'linear-gradient(135deg, #0b3b3a 0%, #0d9488 100%)' }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2c-.5 4-4 7.5-10 10 6 2.5 9.5 6 10 10 .5-4 4-7.5 10-10-6-2.5-9.5-6-10-10z"/>
                  </svg>
                  <span>AI Assistant</span>
                </button>
              </div>
            ) : (
              <button
                className="flex items-center gap-0.5 rounded-full px-1.5 py-0.5 border active:opacity-60 border-teal-700"
                style={{ background: 'linear-gradient(135deg, #0b3b3a 0%, #0d9488 100%)' }}
                onClick={() => {
                  if (reportSyncing) return
                  setReportSyncing(true)
                  qc.resetQueries({ queryKey: ['quickstats', yf_symbol] })
                  setTimeout(() => setReportSyncing(false), 1500)
                }}
              >
                <span className={`text-[10px] text-white leading-none inline-block ${reportSyncing ? 'animate-spin' : ''}`}>↻</span>
              </button>
            )}
          </div>
        )}

        {/* Charts strip */}
        {activeTab === 'charts' && (
          <div className="bg-teal-50 border border-teal-100 rounded-xl px-2.5 py-1.5 mb-2 min-h-[38px] flex flex-col justify-center">
            <div className="flex items-center gap-2">
              <div
                className="flex gap-0.5 overflow-x-auto flex-1 rounded-lg p-0.5"
                style={{ backgroundColor: '#99f6e444', scrollbarWidth: 'none' } as React.CSSProperties}
              >
                <button
                  className="text-[10px] whitespace-nowrap px-2.5 py-1 rounded-md font-medium transition-all text-white shadow-sm border border-teal-700"
                  style={{ background: 'linear-gradient(135deg, #0b3b3a 0%, #0d9488 100%)' }}
                >
                  Price
                </button>
              </div>
              <button
                className="flex items-center gap-0.5 shrink-0 rounded-full px-1.5 py-0.5 border active:opacity-60 border-teal-700"
                style={{ background: 'linear-gradient(135deg, #0b3b3a 0%, #0d9488 100%)' }}
                onClick={() => {
                  if (chartSyncing) return
                  setChartSyncing(true)
                  qc.invalidateQueries({ queryKey: ['history', yf_symbol] })
                  setTimeout(() => setChartSyncing(false), 1500)
                }}
              >
                <span className={`text-[10px] text-white leading-none inline-block ${chartSyncing ? 'animate-spin' : ''}`}>↻</span>
              </button>
            </div>
          </div>
        )}

        {/* Notes strip */}
        {activeTab === 'notes' && (
          <div className="bg-teal-50 border border-teal-100 rounded-xl px-2.5 py-1.5 mb-2 min-h-[38px] flex items-center">
            <span className="text-[13px] font-semibold text-[#0b3b3a]">Personal notes</span>
          </div>
        )}
      </div>

      {/* ── Scrollable content ────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-1 pb-4">
        {activeTab === 'report' && reportSubTab !== 'links' && (
          <ReportTab
            yf_symbol={yf_symbol}
            name={name}
            qs={qs}
            loading={qsPending || qsFetching}
            reportTab={reportSubTab}
            useLite={reportUseLite}
            use31={reportUse31}
            useKey={reportUseKey}
            chatOpenerRef={chatOpenerRef}
          />
        )}
        {activeTab === 'report' && reportSubTab === 'links' && (() => {
          const cleanSym = yf_symbol.replace(/\.(NS|BO)$/i, '')
          const links: { name: string; desc: string; url: string; color: string }[] = isIndian ? [
            { name: 'Screener.in',   desc: 'Fundamentals, financials & ratios',     url: `https://www.screener.in/company/${cleanSym}/`,                                                                          color: '#0d9488' },
            { name: 'Trendlyne',     desc: 'Technicals, forecasts & DII/FII data',  url: `https://trendlyne.com/equity/${cleanSym.toUpperCase()}/NSENB/`,                                                               color: '#7c3aed' },
            { name: 'NSE India',     desc: 'Exchange quotes, filings & F&O',        url: `https://www.nseindia.com/get-quotes/equity?symbol=${cleanSym}`,                                                        color: '#1d4ed8' },
            { name: 'Yahoo Finance', desc: 'Price, news & analyst consensus',       url: `https://finance.yahoo.com/quote/${yf_symbol}`,                                                                         color: '#2563eb' },
          ] : [
            { name: 'YFinance',      desc: 'Price, news & analyst consensus',       url: `https://finance.yahoo.com/quote/${yf_symbol}`,                                                                         color: '#2563eb' },
            { name: 'MacroTrends',   desc: 'Long-term historical financials',       url: `https://www.macrotrends.net/stocks/charts/${cleanSym.toUpperCase()}/${cleanSym.toLowerCase()}/stock-price-history`,    color: '#7c3aed' },
            { name: 'TipRanks',      desc: 'Analyst ratings & price targets',       url: `https://www.tipranks.com/stocks/${cleanSym.toLowerCase()}`,                                                            color: '#ea580c' },
            { name: 'IndMoney',      desc: 'Buy/track on IndMoney',                 url: `https://www.indmoney.com/investments/us-stocks/explore-all?stockSlug=${cleanSym.toUpperCase()}`,                        color: '#dc2626' },
            { name: 'Vested',        desc: 'Buy/track on Vested Finance',           url: `https://app.vestedfinance.com/en/global/stocks/${cleanSym.toUpperCase()}`,                                             color: '#0d9488' },
          ]
          return (
            <div className="pt-1 pb-4 flex flex-col gap-2">
              {links.map(link => (
                <a
                  key={link.name}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between rounded-xl border border-slate-100 bg-white px-3 py-2.5 shadow-sm active:opacity-60"
                >
                  <div>
                    <p className="text-[12px] font-semibold text-slate-700">{link.name}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{link.desc}</p>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={link.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 ml-3">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                    <polyline points="15 3 21 3 21 9"/>
                    <line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                </a>
              ))}
            </div>
          )
        })()}
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

      {portfolioData && (
        <AddTransactionModal
          open={addTxnOpen}
          onClose={() => setAddTxnOpen(false)}
          data={portfolioData}
          preFilledSymbol={yf_symbol}
          preFilledSymbolName={qs?.company_name ?? locName ?? undefined}
          preFilledExchange={exchange}
          preFilledCurrency={isIndian ? 'INR' : 'USD'}
          preFilledPrice={cur ?? undefined}
          lockSymbol
        />
      )}
    </div>
  )
}
