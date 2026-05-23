import type { PortfolioData } from './types'

// Vite proxy rewrites /api → http://localhost:8000 in dev.
// In production set VITE_API_URL to the deployed FastAPI host.
const BASE = (import.meta.env.VITE_API_URL ?? '') + '/api'

export async function fetchPortfolio(
  currency: 'INR' | 'USD' = 'INR',
  forceRefresh = false,
): Promise<PortfolioData> {
  const params = new URLSearchParams({ currency })
  if (forceRefresh) params.set('force_refresh', 'true')

  const res = await fetch(`${BASE}/portfolio?${params}`)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${text}`)
  }
  return res.json() as Promise<PortfolioData>
}
