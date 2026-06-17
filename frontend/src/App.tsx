import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, useIsRestoring } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import PortfoliosPage   from './pages/PortfoliosPage'
import HoldingsPage     from './pages/HoldingsPage'
import TransactionsPage from './pages/TransactionsPage'
import ResearchPage     from './pages/ResearchPage'

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

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-4">
      <div className="text-[22px] font-bold bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
        Portfolio Manager
      </div>
      <div className="flex items-center gap-2 text-slate-400 text-[13px]">
        <span className="inline-block animate-spin text-emerald-400 text-[18px]">↻</span>
        Loading your portfolio…
      </div>
    </div>
  )
}

function AppRoutes({ currency, onCurrencyChange }: { currency: Currency; onCurrencyChange: (c: Currency) => void }) {
  const isRestoring = useIsRestoring()
  if (isRestoring) return <LoadingScreen />

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
    if (navigator.storage?.persist) {
      navigator.storage.persist().then(granted => {
        console.log(granted ? '[storage] persistent storage granted' : '[storage] persistent storage NOT granted')
      })
    }

    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker.addEventListener('controllerchange', () => {
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
      {updateReady && (
        <div className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-between px-4 py-2 bg-emerald-50 border-b border-emerald-200">
          <span className="text-[12px] text-emerald-700">New version available</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.location.reload()}
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
