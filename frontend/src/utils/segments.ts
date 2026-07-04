// Currency/skip-portfolio concerns only — classification (Stocks vs Mutual Funds, Indian vs
// US, or any custom split) now lives in user-defined Buckets/Labels, see '../utils/buckets'.

import type { Currency } from '../App'

export const USD_PORTS  = new Set(['Vested', 'IndMoney US', 'IndMoney Mummy'])
// Equity/MF_Portfolio pseudo-portfolios were removed (manually-duplicated aggregate rows that
// silently fell out of sync) — kept here only as a defensive no-op in case old data resurfaces.
export const SKIP_PORTS = new Set(['Equity', 'MF_Portfolio'])

// User-configurable per-broker-portfolio display currency (Manage Buckets modal "Portfolios"
// section) — only used for a portfolio's own rollup tile/chart, never for an individual
// holding's own numbers (those always use that holding's own CSV `currency` field instead).
// USD_PORTS above is only the seed default for a portfolio the user hasn't overridden yet.
const PORTFOLIO_CURRENCY_KEY = 'portfolio:currency'

function readPortfolioCurrencyMap(): Record<string, Currency> {
  try {
    const raw = localStorage.getItem(PORTFOLIO_CURRENCY_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function getPortfolioCurrency(name: string): Currency {
  const override = readPortfolioCurrencyMap()[name]
  if (override) return override
  return USD_PORTS.has(name) ? 'USD' : 'INR'
}

export function setPortfolioCurrency(name: string, currency: Currency) {
  const map = readPortfolioCurrencyMap()
  map[name] = currency
  try { localStorage.setItem(PORTFOLIO_CURRENCY_KEY, JSON.stringify(map)) } catch {}
}
