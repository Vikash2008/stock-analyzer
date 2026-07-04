// Shared currency-toggle resolution — was independently duplicated as cardCur/cardFx
// (HoldingsPage), dispCur/holdFx (TransactionsPage), usdCur/usdScale (PortfoliosPage).
import type { Currency } from '../App'

export function resolveDisplayCurrency(native: Currency, toggle: Currency): Currency {
  return native === 'USD' && toggle === 'USD' ? 'USD' : 'INR'
}

export function fxMultiplier(displayCurrency: Currency, usdInr: number): number {
  return displayCurrency === 'USD' ? 1 / usdInr : 1
}
