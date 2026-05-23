import { useQueryClient, useQuery } from '@tanstack/react-query'
import { fetchPortfolio } from '../api/portfolio'

const STALE_MS = 30 * 60 * 1000  // 30 min — matches backend price TTL

export function usePortfolio(currency: 'INR' | 'USD' = 'INR') {
  return useQuery({
    queryKey: ['portfolio', currency],
    queryFn:  () => fetchPortfolio(currency),
    staleTime: STALE_MS,
    gcTime:    STALE_MS * 2,
    retry: 1,
  })
}

// Call this to force a live price refresh (pull-to-refresh equivalent)
export function useForceRefresh(currency: 'INR' | 'USD') {
  const qc = useQueryClient()
  return () => {
    // Invalidate so the next render re-fetches with force_refresh=true
    qc.invalidateQueries({ queryKey: ['portfolio', currency] })
    return fetchPortfolio(currency, true).then(data =>
      qc.setQueryData(['portfolio', currency], data)
    )
  }
}
