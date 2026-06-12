import { useQueryClient, useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { fetchPortfolio } from '../api/portfolio'
import type { PortfolioData } from '../api/types'

function getCsvContent(): string | undefined {
  return localStorage.getItem('portfolio:csv') ?? undefined
}

const REFRESH_MS = 30 * 60 * 1000

export function usePortfolio(currency: 'INR' | 'USD' = 'INR') {
  const qc = useQueryClient()

  // Mobile browsers suspend JS timers when screen locks or app backgrounds.
  // visibilitychange is reliable — check elapsed time and refetch if >= 30 min.
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return
      const state = qc.getQueryState(['portfolio', currency])
      const lastFetch = state?.dataUpdatedAt ?? 0
      if (Date.now() - lastFetch >= REFRESH_MS) {
        qc.invalidateQueries({ queryKey: ['portfolio', currency] })
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [qc, currency])

  return useQuery({
    queryKey: ['portfolio', currency],
    queryFn: () => fetchPortfolio(currency, false, getCsvContent()),
    staleTime:                   REFRESH_MS,
    gcTime:                      Infinity,
    refetchInterval:             REFRESH_MS,     // fires when tab is active (desktop/foreground)
    refetchIntervalInBackground: false,           // don't rely on suspended timers; visibilitychange handles it
    refetchOnWindowFocus:        false,           // handled manually above with elapsed-time check
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
