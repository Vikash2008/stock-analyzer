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
    staleTime: Infinity,
    gcTime:    Infinity,
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
