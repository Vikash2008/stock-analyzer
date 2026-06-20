// Currency/skip-portfolio concerns only — classification (Stocks vs Mutual Funds, Indian vs
// US, or any custom split) now lives in user-defined Buckets/Labels, see '../utils/buckets'.

export const USD_PORTS  = new Set(['Vested', 'IndMoney US', 'IndMoney Mummy'])
// Equity/MF_Portfolio pseudo-portfolios were removed (manually-duplicated aggregate rows that
// silently fell out of sync) — kept here only as a defensive no-op in case old data resurfaces.
export const SKIP_PORTS = new Set(['Equity', 'MF_Portfolio'])
