// Shared currency-toggle resolution — was independently duplicated as cardCur/cardFx
// (HoldingsPage), dispCur/holdFx (TransactionsPage), usdCur/usdScale (PortfoliosPage).
import type { Currency } from '../App'

export function resolveDisplayCurrency(native: Currency, toggle: Currency): Currency {
  return native === 'USD' && toggle === 'USD' ? 'USD' : 'INR'
}

export function fxMultiplier(displayCurrency: Currency, usdInr: number): number {
  return displayCurrency === 'USD' ? 1 / usdInr : 1
}

// The FX toggle rule, applied to one USD transaction: OFF = one consistent (today's) rate for
// every cash flow — mathematically equivalent to computing XIRR in pure USD, a genuine
// currency-neutral reading, not a meaningless one. ON = the real rate that applied on this
// cash flow's own date (BUY at buy_fx_rate, SELL at sell_fx_rate). Caller is responsible for
// checking the transaction is actually USD-native and that conversion is even wanted (e.g.
// skip entirely when displaying natively in USD) — this only picks the rate once both are true.
export function txFxRate(
  tx: { type: string; buy_fx_rate?: number | null; sell_fx_rate?: number | null },
  includeFx: boolean,
  usdInr: number,
): number {
  if (!includeFx) return usdInr
  const r = tx.type === 'BUY' ? tx.buy_fx_rate : tx.type === 'SELL' ? tx.sell_fx_rate : null
  return (r && r > 10) ? r : usdInr
}
