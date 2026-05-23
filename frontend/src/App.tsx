import { useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
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

export type Currency = 'INR' | 'USD'

export default function App() {
  const [currency, setCurrency] = useState<Currency>('INR')

  return (
    <QueryClientProvider client={queryClient}>
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
    </QueryClientProvider>
  )
}
