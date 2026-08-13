import { useState, useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, useIsRestoring } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { usePortfolio } from './hooks/usePortfolio'
import { useRefreshAllBenchmarks, getLastBenchmarkAutoRefreshDay, setLastBenchmarkAutoRefreshDay } from './hooks/useBenchmarkXirr'
import PortfoliosPage   from './pages/PortfoliosPage'
import HoldingsPage     from './pages/HoldingsPage'
import TransactionsPage from './pages/TransactionsPage'
import ResearchPage     from './pages/ResearchPage'
import JoinPage         from './pages/JoinPage'
import DebugOverlay     from './components/DebugOverlay'
import GoogleSignInButton from './components/GoogleSignInButton'
import { logDebug } from './utils/debugLog'
import { AuthRequiredError } from './utils/auth'

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

function SignInGate() {
  const [error, setError] = useState('')
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-4 px-6">
      <div className="text-[22px] font-bold bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
        Portfolio Manager
      </div>
      <p className="text-slate-400 text-[13px] text-center max-w-xs">
        Your session expired or this device isn't signed in — sign in with Google to see your portfolio again.
      </p>
      <GoogleSignInButton onSuccess={() => window.location.reload()} onError={setError} />
      {error && <p className="text-[12px] text-red-400">{error}</p>}
    </div>
  )
}

// Non-blocking version of SignInGate — shown when we already have real
// portfolio data cached (so the app renders normally with last-known
// numbers) but the background refresh is failing because this device isn't
// signed in. Without this, that failure was silent: numbers would just
// quietly stop updating with no indication why.
function ReauthBanner() {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  return (
    <div className="fixed top-0 left-0 right-0 z-[9998] bg-amber-50 border-b border-amber-200">
      <div className="flex items-center justify-between gap-3 px-4 py-2">
        <span className="text-[12px] text-amber-800">
          Showing your last saved portfolio — sign in to keep it syncing.
        </span>
        <button
          onClick={() => setOpen((v) => !v)}
          className="shrink-0 text-[12px] font-semibold text-amber-800 bg-amber-100 px-3 py-1 rounded-full border border-amber-300 active:bg-amber-200"
        >
          Sign in
        </button>
      </div>
      {open && (
        <div className="px-4 pb-3 flex flex-col items-center gap-2">
          <GoogleSignInButton onSuccess={() => window.location.reload()} onError={setError} />
          {error && <p className="text-[11px] text-red-600">{error}</p>}
        </div>
      )}
    </div>
  )
}

function FetchingScreen() {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-4">
      <div className="text-[22px] font-bold bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
        Portfolio Manager
      </div>
      <div className="flex items-center gap-2 text-slate-400 text-[13px]">
        <span className="inline-block animate-spin text-emerald-400 text-[18px]">↻</span>
        Fetching latest prices…
      </div>
    </div>
  )
}

function AppRoutes({ currency, onCurrencyChange }: { currency: Currency; onCurrencyChange: (c: Currency) => void }) {
  const isRestoring = useIsRestoring()
  const { data, error } = usePortfolio()
  const loggedRestore = useRef(false)

  // Dividends have no automatic refresh at all (see hooks/useDividends.ts) — manual only,
  // triggered from the Settings popover or the Dividends tab's own "Refresh"/"Fetch" button.

  const refreshAllBenchmarks = useRefreshAllBenchmarks()

  // Once-per-calendar-day automatic benchmark-index refresh — covers every portfolio/segment
  // view in one pass since SECTOR_BENCHMARK is a fixed set, not derived from holdings, so this
  // doesn't need to wait on portfolio data like the dividends effect above does.
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10) // "YYYY-MM-DD"
    if (getLastBenchmarkAutoRefreshDay() === today) return
    setLastBenchmarkAutoRefreshDay(today)
    refreshAllBenchmarks()
  }, [])

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

  // /join is a public landing page for the invite link — it doesn't need portfolio
  // data at all, so it must never sit behind the loading/sign-in gates below (a
  // brand new visitor has no CSV and no session yet, that's the whole point of it).
  if (window.location.pathname === '/join') {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/join" element={<JoinPage />} />
        </Routes>
      </BrowserRouter>
    )
  }

  if (isRestoring) return <LoadingScreen />

  // csv_hash is only ever set on a real-CSV response, never demo (fetchPortfolioGuarded
  // in usePortfolio.ts throws rather than resolve with demo data when a CSV was sent).
  // If a CSV is saved locally but we don't yet have real data cached, keep blocking so
  // demo never flashes. Otherwise render immediately with whatever we have — even if
  // stale by hours/a day — and let the header's existing ↻ spinner show the background sync.
  const hasCsv     = !!localStorage.getItem('portfolio:csv')
  const hasRealData = !!data?.csv_hash
  if (hasCsv && !hasRealData && error instanceof AuthRequiredError) return <SignInGate />
  if (!data || (hasCsv && !hasRealData)) return <FetchingScreen />

  // We have real data on screen (from cache), but the latest background refresh
  // failed because this device isn't signed in — show the softer banner instead
  // of silently letting numbers go stale with no explanation.
  const needsReauth = hasRealData && error instanceof AuthRequiredError

  return (
    <BrowserRouter>
      {needsReauth && <ReauthBanner />}
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
          path="/holdings/bucket/:bucket/:label"
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
