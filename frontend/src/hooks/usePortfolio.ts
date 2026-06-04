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
    retry: 1,
  })
}

export function useForceRefresh(currency: 'INR' | 'USD') {
  const qc = useQueryClient()
  return () =>
    fetchPortfolio(currency, true, getCsvContent()).then(data =>
      qc.setQueryData(['portfolio', currency], data)
    )
}
