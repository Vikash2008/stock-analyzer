// Mirrors holdings_page._agg_realized()
// Returns Map keyed by "portfolio:symbol" → [realized_gain_display, cost_of_sold_display]

import type { Realized } from '../api/types'

export type RealizedMap = Map<string, [number, number]>

export function aggRealized(realized: Realized[], usdInr: number): RealizedMap {
  const map: RealizedMap = new Map()
  for (const r of realized) {
    const fx  = r.currency === 'USD' ? usdInr : 1.0
    const key = `${r.portfolio}:${r.symbol}`
    const [g, c] = map.get(key) ?? [0, 0]
    map.set(key, [
      g + r.realized_pnl * fx,
      c + r.quantity * r.buy_price * fx,
    ])
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
