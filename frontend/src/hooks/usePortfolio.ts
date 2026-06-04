import { useQueryClient, useQuery } from '@tanstack/react-query'
import { fetchPortfolio } from '../api/portfolio'
import type { PortfolioData } from '../api/types'
import demoPortfolio from '../demo/portfolio.json'

const DEMO = import.meta.env.VITE_DEMO_MODE === 'true'

export function usePortfolio(currency: 'INR' | 'USD' = 'INR') {
  return useQuery({
    queryKey: ['portfolio', currency],
    queryFn: DEMO
      ? () => Promise.resolve(demoPortfolio as unknown as PortfolioData)
      : () => fetchPortfolio(currency),
    staleTime: Infinity,
    gcTime:    Infinity,
    retry: DEMO ? 0 : 1,
  })
}

export function useForceRefresh(currency: 'INR' | 'USD') {
  const qc = useQueryClient()
  return () => {
    if (DEMO) return Promise.resolve()
    return fetchPortfolio(currency, true).then(data =>
      qc.setQueryData(['portfolio', currency], data)
    )
  }
}
