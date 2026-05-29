import { useQueryClient, useQuery } from '@tanstack/react-query'
import { fetchPortfolio } from '../api/portfolio'

const STALE_MS = 24 * 60 * 60 * 1000  // 1 day — manual sync via ↻ refreshes prices

export function usePortfolio(currency: 'INR' | 'USD' = 'INR') {
  return useQuery({
    queryKey: ['portfolio', currency],
    queryFn:  () => fetchPortfolio(currency),
    staleTime: STALE_MS,
    gcTime:    STALE_MS * 2,
    retry: 1,
  })
}

export function useForceRefresh(currency: 'INR' | 'USD') {
  const qc = useQueryClient()
  return () => {
    return fetchPortfolio(currency, true).then(data =>
      qc.setQueryData(['portfolio', currency], data)
    )
  }
}
