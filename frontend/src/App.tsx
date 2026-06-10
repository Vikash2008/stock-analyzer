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
  const [currency, setCurrency] = useState<Currency>('INR')
  const [updateReady, setUpdateReady] = useState(false)

  useEffect(() => {
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

    // Also check every 30 minutes while app is open
    const interval = setInterval(triggerCheck, 30 * 60 * 1000)

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
          shouldDehydrateQuery: (query) =>
            query.queryKey[0] === 'history' ||
            query.queryKey[0] === 'portfolio' ||
            query.queryKey[0] === 'benchmark-hist' ||
            query.queryKey[0] === 'quickstats',
        },
      }}
    >
      <AppRoutes currency={currency} onCurrencyChange={setCurrency} />
      {updateReady && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 bg-slate-900 border border-slate-700 rounded-2xl px-4 py-3 shadow-xl whitespace-nowrap">
          <span className="text-[12px] text-slate-300">New version available</span>
          <button
            onClick={() => window.location.reload()}
            className="text-[12px] font-semibold text-emerald-400 bg-emerald-400/10 px-3 py-2 rounded-full border border-emerald-400/30 active:bg-emerald-400/20"
          >
            Update now
          </button>
        </div>
      )}
    </PersistQueryClientProvider>
  )
}
