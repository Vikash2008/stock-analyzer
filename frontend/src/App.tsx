import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import PortfoliosPage   from './pages/PortfoliosPage'
import HoldingsPage     from './pages/HoldingsPage'
import TransactionsPage from './pages/TransactionsPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 60 * 1000,  // 30 min
      retry: 1,
    },
  },
})

const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'stock-analyzer-cache',
})

export type Currency = 'INR' | 'USD'

export default function App() {
  const [currency, setCurrency] = useState<Currency>('INR')

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload()
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
        maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 days
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => query.queryKey[0] === 'history' || query.queryKey[0] === 'portfolio',
        },
      }}
    >
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={<PortfoliosPage currency={currency} onCurrencyChange={setCurrency} />}
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
        </Routes>
      </BrowserRouter>
    </PersistQueryClientProvider>
  )
}
