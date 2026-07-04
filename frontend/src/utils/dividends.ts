// TypeScript port of the old backend/routers/dividends.py's per-symbol shares-on-date +
// aggregation logic (same porting pattern as utils/realized.ts / utils/xirr.ts). Dividend data
// is now fetched purely symbol-wise (see api/dividends.ts's fetchDividendEvents) and shared
// across every view — this is what turns that shared raw data into the portfolio/segment/
// bucket-scoped shape DividendsTab.tsx (and every other consumer) renders.

import type { Transaction } from '../api/types'
import type { SymbolDividendData } from '../api/dividends'
import type { DividendsData, DividendSymbol, DividendEvent, DividendTimelineEntry } from '../api/dividends'
import { SKIP_PORTS } from './segments'

const round2 = (v: number) => Math.round(v * 100) / 100
const round4 = (v: number) => Math.round(v * 10000) / 10000

function sortedRounded(rec: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const k of Object.keys(rec).sort()) out[k] = round2(rec[k])
  return out
}

const CUTOFF_TRAILING_MS = 365 * 24 * 60 * 60 * 1000

export function computeDividendsForScope(
  eventsBySymbol: Record<string, SymbolDividendData>,   // keyed by yf_symbol
  transactions: Transaction[],
  usdInr: number,
  // Restrict shares-held math to these portfolios only; undefined = every portfolio. Callers
  // that also need a Bucket/Label or segment's symbol-name filter apply that separately on top
  // of this function's `by_symbol` result (see HoldingsPage.tsx's `filteredDivSymbols`) — tags
  // aren't a transaction-level concept the shares-on-date walk needs to know about.
  scopePortfolios?: string[],
): DividendsData {
  const inScope = (t: Transaction): boolean => {
    if (SKIP_PORTS.has(t.portfolio)) return false
    if (scopePortfolios && !scopePortfolios.includes(t.portfolio)) return false
    return true
  }

  // Group in-scope BUY/SELL transactions per symbol (sorted by date) and accumulate total BUY
  // cost per symbol (for yield-on-cost) in one pass.
  const txnsByYf = new Map<string, Transaction[]>()
  const investedBySymbol = new Map<string, number>()
  for (const t of transactions) {
    if (!inScope(t)) continue
    if (t.type === 'BUY') {
      const cost = t.quantity * t.price * (t.currency === 'USD' ? usdInr : 1)
      investedBySymbol.set(t.yf_symbol, (investedBySymbol.get(t.yf_symbol) ?? 0) + cost)
    }
    if (t.type !== 'BUY' && t.type !== 'SELL') continue
    const arr = txnsByYf.get(t.yf_symbol)
    if (arr) arr.push(t)
    else txnsByYf.set(t.yf_symbol, [t])
  }
  for (const arr of txnsByYf.values()) arr.sort((a, b) => a.date.localeCompare(b.date))

  const cutoffTrailing = Date.now() - CUTOFF_TRAILING_MS
  const bySymbol: DividendSymbol[] = []
  const timeline: DividendTimelineEntry[] = []
  const byYear:  Record<string, number> = {}
  const byMonth: Record<string, number> = {}
  let grandTotal = 0, grandCount = 0, grandProj = 0

  for (const [yfSym, symData] of Object.entries(eventsBySymbol)) {
    const txns = txnsByYf.get(yfSym)
    if (!txns || txns.length === 0) continue   // not held (in this scope) at all

    // Cumulative running shares via a sorted-pointer walk (same pattern usePortfolioHistory.ts
    // uses for its own qty-delta accumulation) — O(txns + events) per symbol instead of
    // rescanning every transaction for every ex-date.
    let txnPtr = 0
    let runningQty = 0
    const events: DividendEvent[] = []
    let symTotal = 0
    let trailing12m = 0
    const monthPattern: number[] = []

    for (const ev of symData.events) {   // already sorted ascending by ex_date
      while (txnPtr < txns.length && txns[txnPtr].date.slice(0, 10) <= ev.ex_date) {
        runningQty += txns[txnPtr].type === 'BUY' ? txns[txnPtr].quantity : -txns[txnPtr].quantity
        txnPtr++
      }
      const shares = Math.max(0, runningQty)
      if (shares <= 0) continue

      const amountNative = shares * ev.div_per_share
      const amountInr = symData.currency === 'USD' ? amountNative * usdInr : amountNative

      events.push({
        ex_date:        ev.ex_date,
        shares_held:    round4(shares),
        div_per_share:  round4(ev.div_per_share),
        div_currency:   symData.currency,
        amount:         round2(amountInr),
        amount_native:  round2(amountNative),
      })

      symTotal    += amountInr
      grandTotal  += amountInr
      grandCount  += 1

      const yr = ev.ex_date.slice(0, 4)
      const mo = ev.ex_date.slice(0, 7)
      byYear[yr]  = (byYear[yr]  ?? 0) + amountInr
      byMonth[mo] = (byMonth[mo] ?? 0) + amountInr
      monthPattern.push(parseInt(ev.ex_date.slice(5, 7), 10))

      timeline.push({ date: ev.ex_date, symbol: symData.symbol, exchange: symData.exchange, amount: round2(amountInr) })

      if (new Date(ev.ex_date).getTime() >= cutoffTrailing) trailing12m += amountInr
    }

    if (events.length === 0) continue

    const invested = investedBySymbol.get(yfSym) ?? 0
    const yoc  = invested > 0 ? (symTotal / invested) * 100 : null
    const proj = round2(trailing12m)
    grandProj += proj

    bySymbol.push({
      symbol:           symData.symbol,
      yf_symbol:        yfSym,
      exchange:         symData.exchange,
      total_dividends:  round2(symTotal),
      event_count:      events.length,
      yield_on_cost:    yoc !== null ? round2(yoc) : null,
      last_ex_date:     events[events.length - 1].ex_date,   // ascending order -> last = most recent
      projected_annual: proj,
      month_pattern:    [...new Set(monthPattern)].sort((a, b) => a - b),
      events:           [...events].sort((a, b) => b.ex_date.localeCompare(a.ex_date)),  // newest first for display
    })
  }

  bySymbol.sort((a, b) => b.total_dividends - a.total_dividends)
  timeline.sort((a, b) => b.date.localeCompare(a.date))

  return {
    summary: {
      total_dividends_inr:    round2(grandTotal),
      dividend_count:         grandCount,
      symbols_with_dividends: bySymbol.length,
      projected_annual_inr:   round2(grandProj),
    },
    by_symbol: bySymbol,
    by_year:   sortedRounded(byYear),
    by_month:  sortedRounded(byMonth),
    timeline,
  }
}
