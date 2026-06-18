import { useState, useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, useIsRestoring } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { usePortfolio } from './hooks/usePortfolio'
import { useRefreshAllDividends, getLastDividendAutoRefreshMonth, setLastDividendAutoRefreshMonth } from './hooks/useDividends'
import PortfoliosPage   from './pages/PortfoliosPage'
import HoldingsPage     from './pages/HoldingsPage'
import TransactionsPage from './pages/TransactionsPage'
import ResearchPage     from './pages/ResearchPage'
import DebugOverlay     from './components/DebugOverlay'
import { logDebug } from './utils/debugLog'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
      retry: 1,
    },
  },
})

const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'stock-analyzer-cache',
})

export type Currency = 'INR' | 'USD'

function LoadingScreen({ message = 'Loading your portfolio…' }: { message?: string }) {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-4">
      <div className="text-[22px] font-bold bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
        Portfolio Manager
      </div>
      <div className="flex items-center gap-2 text-slate-400 text-[13px]">
        <span className="inline-block animate-spin text-emerald-400 text-[18px]">↻</span>
        {message}
      </div>
    </div>
  )
}

function FetchingScreen() {
  const [progress, setProgress] = useState(0)
  const [overtime, setOvertime] = useState(false)

  useEffect(() => {
    const TICK_MS = 500
    const TICKS   = 180          // 180 × 500ms = 90s — matches retry:3/retryDelay:20s worst case
    const step    = 100 / TICKS

    const id = setInterval(() => {
      setProgress(prev => {
        const next = prev + step
        if (next >= 100) {
          clearInterval(id)
          setOvertime(true)
          return 100
        }
        return next
      })
    }, TICK_MS)

    return () => clearInterval(id)
  }, [])

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-5 px-6">
      <div className="text-[22px] font-bold bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
        Portfolio Manager
      </div>
      <div className="flex items-center gap-2 text-slate-400 text-[13px]">
        <span className="inline-block animate-spin text-emerald-400 text-[18px]">↻</span>
        {overtime ? 'Taking a bit more time…' : 'Fetching latest prices…'}
      </div>
      <div className="w-full max-w-[260px]">
        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  )
}

function AppRoutes({ currency, onCurrencyChange }: { currency: Currency; onCurrencyChange: (c: Currency) => void }) {
  const isRestoring = useIsRestoring()
  const { data } = usePortfolio()
  const loggedRestore = useRef(false)
  const refreshAllDividends = useRefreshAllDividends()

  // Once-per-calendar-month automatic dividends refresh — no other auto-refresh exists for
  // dividends (no interval, no focus refetch); this is the only scheduled freshness trigger.
  useEffect(() => {
    if (!data?.all_portfolios) return
    const thisMonth = new Date().toISOString().slice(0, 7) // "YYYY-MM"
    if (getLastDividendAutoRefreshMonth() === thisMonth) return
    setLastDividendAutoRefreshMonth(thisMonth)
    refreshAllDividends(data.all_portfolios, undefined)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.all_portfolios])

  // One-time log of exactly what the gate saw right as restore finished — lets us tell,
  // after the fact, whether a blocking FetchingScreen was justified (nothing cached yet)
  // or a bug (real data was cached but the gate didn't see it in time).
  useEffect(() => {
    if (isRestoring || loggedRestore.current) return
    loggedRestore.current = true
    const hasCsv      = !!localStorage.getItem('portfolio:csv')
    const hasRealData = !!data?.csv_hash
    const willBlock    = !data || (hasCsv && !hasRealData)
    logDebug(`gate: hasData=${!!data} csv_hash=${data?.csv_hash ?? 'none'} hasCsv=${hasCsv} hasRealData=${hasRealData} -> ${willBlock ? 'BLOCKING (FetchingScreen)' : 'instant render'}`)
  }, [isRestoring, data])

  if (isRestoring) return <LoadingScreen />

  // csv_hash is only ever set on a real-CSV response, never demo (fetchPortfolioGuarded
  // in usePortfolio.ts throws rather than resolve with demo data when a CSV was sent).
  // If a CSV is saved locally but we don't yet have real data cached, keep blocking so
  // demo never flashes. Otherwise render immediately with whatever we have — even if
  // stale by hours/a day — and let the header's existing ↻ spinner show the background sync.
  const hasCsv     = !!localStorage.getItem('portfolio:csv')
  const hasRealData = !!data?.csv_hash
  if (!data || (hasCsv && !hasRealData)) return <FetchingScreen />

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={<PortfoliosPage currency={currency} onCurrencyChange={onCurrencyChange} />}
        />
        <Route
          path="/holdings/portfolio/:portfolio"
          element={<HoldingsPage currency={currency} />}
        />
        <Route
          path="/holdings/segment/:segment"
          element={<HoldingsPage currency={currency} />}
        />
        <Route
          path="/transactions/:portfolio/:symbol"
          element={<TransactionsPage currency={currency} />}
        />
        <Route
          path="/research/:symbol"
          element={<ResearchPage />}
        />
      </Routes>
    </BrowserRouter>
  )
}

export default function App() {
  const [currency, setCurrency] = useState<Currency>(
    () => (localStorage.getItem('currency') as Currency) || 'INR'
  )

  const handleCurrencyChange = (c: Currency) => {
    localStorage.setItem('currency', c)
    setCurrency(c)
  }
  const [updateReady, setUpdateReady] = useState(false)

  useEffect(() => {
    // Ask the browser to exempt this origin from automatic storage eviction
    // (default "best-effort" storage can be silently cleared under storage pressure
    // or after a period of inactivity — this is what was wiping the imported CSV).
    logDebug(`app mount: csvLen=${(localStorage.getItem('portfolio:csv') ?? '').length}`)

    // Orphaned key from a renamed/removed feature — nothing reads or writes it anymore,
    // but it sits at ~1.4MB on devices that had it written historically, eating quota
    // that the CSV import needs.
    localStorage.removeItem('stock-analyzer-chart-cache')

    if (navigator.storage?.persist) {
      navigator.storage.persist().then(granted => {
        logDebug(granted ? 'storage.persist GRANTED' : 'storage.persist NOT granted')
      })
    }

    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      logDebug(`controllerchange: csvLen=${(localStorage.getItem('portfolio:csv') ?? '').length}`)
      setUpdateReady(true)
    })

    const triggerCheck = () => {
      navigator.serviceWorker.getRegistration().then(reg => { if (reg) reg.update() })
    }

    // Check on visibility restore
    const onVisibility = () => { if (document.visibilityState === 'visible') triggerCheck() }
    document.addEventListener('visibilitychange', onVisibility)

    // Check every 15 seconds so banner appears almost immediately after deploy
    const interval = setInterval(triggerCheck, 15_000)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      clearInterval(interval)
    }
  }, [])

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 3 * 24 * 60 * 60 * 1000,  // 3 days
        dehydrateOptions: {
          // 'history' and 'quickstats' already have their own dedicated per-symbol
          // localStorage caches (useHistory.ts, useQuickStats.ts) — persisting them
          // again here duplicates potentially MBs of data into one big blob that gets
          // rewritten on every fetch, increasing the odds of hitting the device's
          // storage quota (which risks corrupting/evicting unrelated small keys like
          // portfolio:csv on some Android WebView versions).
          shouldDehydrateQuery: (query) =>
            query.queryKey[0] === 'portfolio' ||
            query.queryKey[0] === 'benchmark-hist',
        },
      }}
    >
      <AppRoutes currency={currency} onCurrencyChange={handleCurrencyChange} />
      <DebugOverlay />
      {updateReady && (
        <div className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-between px-4 py-2 bg-emerald-50 border-b border-emerald-200">
          <span className="text-[12px] text-emerald-700">New version available</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                logDebug(`update tapped: csvLen=${(localStorage.getItem('portfolio:csv') ?? '').length}, reloading`)
                window.location.reload()
              }}
              className="text-[12px] font-semibold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-300 active:bg-emerald-200"
            >
              Update
            </button>
            <button
              onClick={() => setUpdateReady(false)}
              aria-label="Dismiss"
              className="text-emerald-700 text-[16px] leading-none px-1.5 py-1 active:bg-emerald-100 rounded-full"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </PersistQueryClientProvider>
  )
}
