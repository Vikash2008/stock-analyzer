import { getClientId } from '../utils/clientId'

const BASE = (import.meta.env.VITE_API_URL ?? '') + '/api'

export interface WatchlistItem {
  id: string
  yf_symbol: string
  symbol: string
  name: string
  exchange: string
  currency: 'INR' | 'USD'
  added_at: number
}

export interface WatchlistQuote {
  price: number | null
  prev_close: number | null
  change_pct: number | null
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const sep = path.includes('?') ? '&' : '?'
  const url = `${BASE}${path}${sep}client_id=${encodeURIComponent(getClientId())}`
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

export function fetchWatchlist(): Promise<{ items: WatchlistItem[] }> {
  return req('/watchlist')
}

export function addToWatchlist(item: {
  yf_symbol: string
  symbol?: string
  name?: string
  exchange?: string
  currency?: 'INR' | 'USD'
}): Promise<{ item: WatchlistItem }> {
  return req('/watchlist', { method: 'POST', body: JSON.stringify(item) })
}

export function removeFromWatchlist(yf_symbol: string): Promise<{ ok: true }> {
  return req(`/watchlist/${encodeURIComponent(yf_symbol)}`, { method: 'DELETE' })
}

export function fetchWatchlistQuotes(): Promise<{ quotes: Record<string, WatchlistQuote> }> {
  return req('/watchlist/quotes')
}
