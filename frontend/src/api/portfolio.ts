import type { PortfolioData } from './types'
import { getAuthToken, AuthRequiredError } from '../utils/auth'

// Vite proxy rewrites /api → http://localhost:8000 in dev.
// In production set VITE_API_URL to the deployed FastAPI host.
const BASE = (import.meta.env.VITE_API_URL ?? '') + '/api'

export async function fetchPortfolio(
  currency: 'INR' | 'USD' = 'INR',
  forceRefresh = false,
  csvContent?: string,
): Promise<PortfolioData> {
  const params = new URLSearchParams({ currency })
  if (forceRefresh) params.set('force_refresh', 'true')

  // Demo (GET) stays open to everyone; a real CSV upload/refresh (POST) requires
  // being signed in — 2026-08-13, see backend/routers/portfolio.py.
  let init: RequestInit | undefined
  if (csvContent) {
    const token = getAuthToken()
    if (!token) throw new AuthRequiredError()
    init = {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain', Authorization: `Bearer ${token}` },
      body: csvContent,
    }
  }

  const res = await fetch(`${BASE}/portfolio?${params}`, init)
  if (res.status === 401) throw new AuthRequiredError()
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${text}`)
  }
  return res.json() as Promise<PortfolioData>
}
