import { useQueryClient, useQuery } from '@tanstack/react-query'
import { fetchPortfolio } from '../api/portfolio'
import type { PortfolioData } from '../api/types'

function getCsvContent(): string | undefined {
  return localStorage.getItem('portfolio:csv') ?? undefined
}

export function usePortfolio(currency: 'INR' | 'USD' = 'INR') {
  return useQuery({
    queryKey: ['portfolio', currency],
    queryFn: () => fetchPortfolio(currency, false, getCsvContent()),
    staleTime:                  30 * 60 * 1000,  // 30 min
    gcTime:                     Infinity,
    refetchInterval:            30 * 60 * 1000,  // auto-refresh every 30 min
    refetchIntervalInBackground: true,            // continues when tab is minimized or backgrounded
    refetchOnWindowFocus:       true,
    retry: 3,
    retryDelay: 20_000,
  })
}

export function useForceRefresh(currency: 'INR' | 'USD') {
  const qc = useQueryClient()
  return () =>
    qc.fetchQuery({
      queryKey: ['portfolio', currency],
      queryFn: () => fetchPortfolio(currency, true, getCsvContent()),
      staleTime: 0,
    })
}
