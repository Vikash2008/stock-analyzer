// Mirrors dashboard/classify.py exactly — single source of truth kept in Python,
// this file is a faithful TypeScript port for client-side filtering.

import type { Holding } from '../api/types'

export const USD_PORTS  = new Set(['Vested', 'IndMoney US', 'IndMoney Mummy'])
export const SKIP_PORTS = new Set(['Equity', 'MF_Portfolio'])
const US_MF_SYMS  = new Set(['0P0001NCLP.BO', '0P0001JMZB.BO'])
const US_ETF_SYMS = new Set(['MON100.NS', 'MAFANG.NS'])

export type SegKey = 'total' | 'stk' | 'mf' | 'indian_stock' | 'us_stock' | 'indian_mf' | 'us_mf'

export const SEGMENT_LABELS: Record<string, string> = {
  total:        'All Holdings',
  stk:          'Stocks',
  mf:           'Mutual Funds',
  indian_stock: 'Indian Stocks',
  us_stock:     'US Stocks',
  indian_mf:    'Indian MF',
  us_mf:        'US MF',
}

const SEGMENT_FILTER: Record<string, Set<string> | null> = {
  total:        null,
  stk:          new Set(['indian_stock', 'us_stock']),
  mf:           new Set(['indian_mf', 'us_mf']),
  indian_stock: new Set(['indian_stock']),
  us_stock:     new Set(['us_stock']),
  indian_mf:    new Set(['indian_mf']),
  us_mf:        new Set(['us_mf']),
}

export function getSegmentType(portfolio: string, yf_symbol: string): string {
  if (SKIP_PORTS.has(portfolio)) return 'skip'
  if (portfolio.startsWith('MF_')) return US_MF_SYMS.has(yf_symbol) ? 'us_mf' : 'indian_mf'
  if (USD_PORTS.has(portfolio) || US_ETF_SYMS.has(yf_symbol)) return 'us_stock'
  return 'indian_stock'
}

export function filterBySegment(holdings: Holding[], segment: string): Holding[] {
  const active = holdings.filter(h => !SKIP_PORTS.has(h.portfolio))
  const allowed = SEGMENT_FILTER[segment]
  if (allowed === null) return active
  return active.filter(h => allowed.has(getSegmentType(h.portfolio, h.yf_symbol)))
}
