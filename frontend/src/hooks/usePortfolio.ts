import { useQueryClient, useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { fetchPortfolio } from '../api/portfolio'
import type { PortfolioData } from '../api/types'
import { logDebug } from '../utils/debugLog'

function getCsvContent(): string | undefined {
  return localStorage.getItem('portfolio:csv') ?? undefined
}

// Backend only sets csv_hash on the real-CSV (POST) response, never on the demo (GET) response.
// If we sent a CSV but got back data without csv_hash, something went wrong — refuse it so
// React Query retries instead of silently caching/showing demo data over real data.
async function fetchPortfolioGuarded(forceRefresh: boolean): Promise<PortfolioData> {
  const csvContent = getCsvContent()
  logDebug(`fetch start: forceRefresh=${forceRefresh} csvLen=${csvContent?.length ?? 'null'}`)
  let data: PortfolioData
  try {
    data = await fetchPortfolio('INR', forceRefresh, csvContent)
  } catch (e) {
    logDebug(`fetch threw: ${String(e)}`)
    throw e
  }
  logDebug(`fetch done: method=${csvContent ? 'POST' : 'GET'} csv_hash=${data.csv_hash ?? 'none'}`)
  if (csvContent && !data.csv_hash) {
    logDebug('GUARD TRIGGERED: sent CSV but got demo data back — throwing for retry')
    throw new Error('Expected real portfolio data but got demo data — retrying')
  }
  return data
}

const REFRESH_MS = 30 * 60 * 1000

// Always fetch in INR — per-portfolio USD conversion is done on the frontend.
// The currency param is kept for call-site compatibility but ignored internally.
export function usePortfolio(_currency: 'INR' | 'USD' = 'INR') {
  const qc = useQueryClient()

  // Mobile browsers suspend JS timers when screen locks or app backgrounds.
  // visibilitychange is reliable — check elapsed time and refetch if >= 30 min.
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return
      const state = qc.getQueryState(['portfolio'])
      const lastFetch = state?.dataUpdatedAt ?? 0
      if (Date.now() - lastFetch >= REFRESH_MS) {
        logDebug('visibilitychange: stale, refetching')
        qc.refetchQueries({ queryKey: ['portfolio'], type: 'active' })
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [qc])

  return useQuery({
    queryKey: ['portfolio'],
    queryFn: () => fetchPortfolioGuarded(false),
    staleTime:                   REFRESH_MS,
    gcTime:                      Infinity,
    refetchInterval:             REFRESH_MS,     // fires when tab is active (desktop/foreground)
    refetchIntervalInBackground: false,           // don't rely on suspended timers; visibilitychange handles it
    refetchOnWindowFocus:        false,           // handled manually above with elapsed-time check
    refetchOnMount:              true,            // refetch only if data is older than staleTime — avoids spinning on every in-app navigation back to this page
    retry: 3,
    retryDelay: 20_000,
  })
}

export function useForceRefresh(_currency: 'INR' | 'USD') {
  const qc = useQueryClient()
  return () =>
    qc.fetchQuery({
      queryKey: ['portfolio'],
      queryFn: () => fetchPortfolioGuarded(true),
      staleTime: 0,
    })
}
