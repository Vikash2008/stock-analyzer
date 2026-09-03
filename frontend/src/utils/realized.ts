// Mirrors holdings_page._agg_realized()
// Returns Map keyed by "portfolio:symbol" → [realized_gain_display, cost_of_sold_display]

import type { Realized } from '../api/types'

export type RealizedMap = Map<string, [number, number]>

// Same toggle rule as everywhere else in the app: OFF converts both legs of a SELL at the
// SAME rate (the sell-date's — this trade's own "now"), so currency cancels out of the
// subtraction and only the pure price-based profit remains, fairly translated. ON converts
// each leg at the rate that actually applied (buy-date for cost, sell-date for proceeds) —
// the true, full currency-inclusive profit. `nativeUsd` skips conversion entirely (chart
// displaying in USD, or the row is already INR-native) — there's no second currency to
// translate into, so the toggle has nothing to act on. Falls back to the old blanket-rate
// conversion for DIVIDEND rows or a realized row from before this fix shipped (no
// buy_fx_rate/sell_fx_rate captured yet).
export function realizedGainCost(r: Realized, usdInr: number, includeFx: boolean, nativeUsd = false): { gain: number; cost: number } {
  const isUsd = r.currency === 'USD'
  if (nativeUsd || !isUsd) {
    return { gain: r.realized_pnl, cost: r.type === 'SELL' ? r.quantity * r.buy_price : 0 }
  }
  if (r.type === 'SELL' && r.sell_fx_rate && r.sell_fx_rate > 10) {
    if (includeFx && r.buy_fx_rate && r.buy_fx_rate > 10) {
      return {
        gain: r.sell_price * r.quantity * r.sell_fx_rate - r.buy_price * r.quantity * r.buy_fx_rate,
        cost: r.buy_price * r.quantity * r.buy_fx_rate,
      }
    }
    return {
      gain: (r.sell_price - r.buy_price) * r.quantity * r.sell_fx_rate,
      cost: r.buy_price * r.quantity * r.sell_fx_rate,
    }
  }
  return { gain: r.realized_pnl * usdInr, cost: r.type === 'SELL' ? r.quantity * r.buy_price * usdInr : 0 }
}

export function aggRealized(realized: Realized[], usdInr: number, includeFx: boolean): RealizedMap {
  const map: RealizedMap = new Map()
  for (const r of realized) {
    const key = `${r.portfolio}:${r.symbol}`
    const [g, c] = map.get(key) ?? [0, 0]
    const { gain, cost } = realizedGainCost(r, usdInr, includeFx)
    map.set(key, [g + gain, c + cost])
  }
  return map
}

export function realizedForPortfolio(map: RealizedMap, portfolio: string): [number, number] {
  let g = 0, c = 0
  for (const [key, [rg, rc]] of map) {
    if (key.startsWith(`${portfolio}:`)) { g += rg; c += rc }
  }
  return [g, c]
}

export function realizedForSymbol(map: RealizedMap, portfolio: string, symbol: string): [number, number] {
  return map.get(`${portfolio}:${symbol}`) ?? [0, 0]
}

export function realizedForPorts(map: RealizedMap, ports: Set<string>): [number, number] {
  let g = 0, c = 0
  for (const [key, [rg, rc]] of map) {
    if (ports.has(key.split(':')[0])) { g += rg; c += rc }
  }
  return [g, c]
}
