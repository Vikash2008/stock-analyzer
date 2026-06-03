import { useQueryClient, useQuery } from '@tanstack/react-query'
import { fetchPortfolio } from '../api/portfolio'

export function usePortfolio(currency: 'INR' | 'USD' = 'INR') {
  return useQuery({
    queryKey: ['portfolio', currency],
    queryFn:  () => fetchPortfolio(currency),
    staleTime: Infinity,
    gcTime:    Infinity,
    retry: 1,
    refetchInterval: 30 * 60 * 1000,
    refetchIntervalInBackground: false,
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
