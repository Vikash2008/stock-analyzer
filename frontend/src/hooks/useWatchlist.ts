import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addToWatchlist,
  fetchWatchlist,
  fetchWatchlistQuotes,
  removeFromWatchlist,
} from '../api/watchlist'
import { REFRESH_MS } from './useHistory'

export function useWatchlistItems() {
  const query = useQuery({
    queryKey: ['watchlist'],
    queryFn: fetchWatchlist,
    staleTime: REFRESH_MS,
  })
  return { ...query, items: query.data?.items ?? [] }
}

export function useIsWatchlisted(yf_symbol: string) {
  const { items } = useWatchlistItems()
  return items.some((i) => i.yf_symbol === yf_symbol)
}

export function useAddToWatchlist() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (item: {
      yf_symbol: string
      symbol?: string
      name?: string
      exchange?: string
      currency?: 'INR' | 'USD'
    }) => addToWatchlist(item),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['watchlist'] })
      // A freshly-starred symbol isn't in the last quotes payload yet — refetch
      // immediately instead of waiting for the next REFRESH_MS tick, otherwise
      // the row shows no price for up to 2 minutes.
      qc.invalidateQueries({ queryKey: ['watchlist-quotes'] })
    },
  })
}

export function useRemoveFromWatchlist() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (yf_symbol: string) => removeFromWatchlist(yf_symbol),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['watchlist'] })
      qc.invalidateQueries({ queryKey: ['watchlist-quotes'] })
    },
  })
}

export function useWatchlistQuotes(enabled: boolean) {
  const { items } = useWatchlistItems()
  const query = useQuery({
    queryKey: ['watchlist-quotes'],
    queryFn: fetchWatchlistQuotes,
    enabled: enabled && items.length > 0,
    staleTime: REFRESH_MS,
    refetchInterval: enabled ? REFRESH_MS : false,
    refetchIntervalInBackground: false,
  })
  return { ...query, quotes: query.data?.quotes ?? {} }
}
