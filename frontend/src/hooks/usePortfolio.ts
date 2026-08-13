import { useQueryClient, useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { fetchPortfolio } from '../api/portfolio'
import type { PortfolioData } from '../api/types'
import { logDebug } from '../utils/debugLog'
import { AuthRequiredError, isSignedIn, clearSession, getUserEmail } from '../utils/auth'

// The cached CSV belongs to whichever account last imported it (stamped as
// 'portfolio:csv:owner' at import time in PortfoliosPage.tsx's handleImport). If a
// different Google account is now signed in on the same device, that CSV must never
// be sent under the new account's token — treat it as absent instead. Legacy CSVs
// with no owner tag yet (imported before this check existed) are still trusted; they
// get backfilled with the current account's email the next time a real fetch succeeds
// (see fetchPortfolioGuarded below).
function getCsvContent(): string | undefined {
  const owner = localStorage.getItem('portfolio:csv:owner')
  if (owner && owner !== getUserEmail()) return undefined
  return localStorage.getItem('portfolio:csv') ?? undefined
}

// App.tsx's loading gate needs the same ownership-aware view — a raw localStorage
// existence check would count a foreign (different-account) CSV as "has CSV" and
// block forever waiting for real data that will never come under this account.
export function hasOwnCsv(): boolean {
  return !!getCsvContent()
}

// Backend only sets csv_hash on the real-CSV (POST) response, never on the demo (GET) response.
// If we sent a CSV but got back data without csv_hash, something went wrong — refuse it so
// React Query retries instead of silently caching/showing demo data over real data.
async function fetchPortfolioGuarded(forceRefresh: boolean): Promise<PortfolioData> {
  // Not signed in — never attempt to send the CSV (fetchPortfolio would just throw
  // AuthRequiredError client-side). Go straight to demo so the app always has
  // something to render instead of sitting in an error state.
  let csvContent = isSignedIn() ? getCsvContent() : undefined
  logDebug(`fetch start: forceRefresh=${forceRefresh} csvLen=${csvContent?.length ?? 'null'}`)
  let data: PortfolioData
  try {
    data = await fetchPortfolio('INR', forceRefresh, csvContent)
  } catch (e) {
    if (e instanceof AuthRequiredError && csvContent) {
      // Token was present locally but the backend rejected it (expired/revoked) —
      // drop the stale session and fall back to demo rather than blocking forever.
      logDebug('token rejected by backend — clearing session, falling back to demo')
      clearSession()
      csvContent = undefined
      data = await fetchPortfolio('INR', forceRefresh, undefined)
    } else {
      logDebug(`fetch threw: ${String(e)}`)
      throw e
    }
  }
  logDebug(`fetch done: method=${csvContent ? 'POST' : 'GET'} csv_hash=${data.csv_hash ?? 'none'}`)
  if (csvContent && !data.csv_hash) {
    logDebug('GUARD TRIGGERED: sent CSV but got demo data back — throwing for retry')
    throw new Error('Expected real portfolio data but got demo data — retrying')
  }
  if (csvContent && data.csv_hash && !localStorage.getItem('portfolio:csv:owner')) {
    try { localStorage.setItem('portfolio:csv:owner', getUserEmail() ?? '') } catch {}
  }
  return data
}

const REFRESH_MS = 2 * 60 * 1000

// Always fetch in INR — per-portfolio USD conversion is done on the frontend.
// The currency param is kept for call-site compatibility but ignored internally.
export function usePortfolio(_currency: 'INR' | 'USD' = 'INR') {
  const qc = useQueryClient()

  // If localStorage was cleared (CSV gone) but cache still holds real portfolio data,
  // wipe the cache immediately so loading skeleton shows instead of stale data.
  // Returns true if a wipe happened.
  const wipeCsvMismatch = () => {
    const cached = qc.getQueryData<PortfolioData>(['portfolio'])
    if (!getCsvContent() && cached?.csv_hash) {
      qc.removeQueries({ queryKey: ['portfolio'] })
      logDebug('csv mismatch: wiped stale portfolio cache')
      return true
    }
    return false
  }

  // Mobile browsers suspend JS timers when screen locks or app backgrounds.
  // visibilitychange is reliable — check elapsed time and refetch if >= REFRESH_MS.
  useEffect(() => {
    // On mount: wipe immediately if CSV was cleared while app was frozen/backgrounded.
    // removeQueries causes useQuery to re-enter pending state and auto-refetch.
    wipeCsvMismatch()

    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return
      const wiped = wipeCsvMismatch()
      const state = qc.getQueryState(['portfolio'])
      const lastFetch = state?.dataUpdatedAt ?? 0
      if (wiped || Date.now() - lastFetch >= REFRESH_MS) {
        logDebug(`visibilitychange: ${wiped ? 'csv cleared' : 'stale'}, refetching`)
        qc.refetchQueries({ queryKey: ['portfolio'], type: 'active' })
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [qc])

  const query = useQuery({
    queryKey: ['portfolio'],
    queryFn: () => fetchPortfolioGuarded(false),
    staleTime:                   REFRESH_MS,
    gcTime:                      Infinity,
    refetchInterval:             REFRESH_MS,     // fires when tab is active (desktop/foreground)
    refetchIntervalInBackground: false,           // don't rely on suspended timers; visibilitychange handles it
    refetchOnWindowFocus:        false,           // handled manually above with elapsed-time check
    refetchOnMount:              true,            // refetch only if data is older than staleTime — avoids spinning on every in-app navigation back to this page
    // Not signed in won't resolve itself by retrying — let AppRoutes show a sign-in
    // gate instead of burning 3 retries against a 401 that needs user action.
    retry: (failureCount, error) => !(error instanceof AuthRequiredError) && failureCount < 3,
    retryDelay: 20_000,
  })

  // wipeCsvMismatch() above only runs from an effect (after paint) — on a fresh page
  // load, React Query's persister can hydrate a *different* account's real portfolio
  // synchronously before that effect fires, which would render it for one frame. Never
  // hand foreign cached data to the caller, even for that one frame.
  if (query.data?.csv_hash && !getCsvContent()) return { ...query, data: undefined }
  return query
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
