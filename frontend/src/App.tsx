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

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      const d = new Date(__BUILD_TIME__)
      const label = d.toLocaleString('en-GB', {
        day: 'numeric', month: 'short',
        hour: '2-digit', minute: '2-digit', hour12: false,
        timeZone: 'Asia/Kolkata',
      })
      const el = document.createElement('div')
      el.style.cssText = [
        'position:fixed', 'bottom:80px', 'left:50%', 'transform:translateX(-50%)',
        'background:#0f172a', 'color:#4ade80', 'font-size:13px', 'font-weight:600',
        'padding:10px 18px', 'border-radius:999px', 'z-index:9999',
        'box-shadow:0 4px 16px rgba(0,0,0,0.4)', 'white-space:nowrap',
        'border:1px solid #334155',
      ].join(';')
      el.textContent = `✓ App updated · Built ${label}`
      document.body.appendChild(el)
      setTimeout(() => window.location.reload(), 2500)
    })

    const checkForUpdate = () => {
      if (document.visibilityState === 'visible') {
        navigator.serviceWorker.getRegistration().then(reg => {
          if (reg) reg.update()
        })
      }
    }

    document.addEventListener('visibilitychange', checkForUpdate)
    return () => document.removeEventListener('visibilitychange', checkForUpdate)
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
    </PersistQueryClientProvider>
  )
}
