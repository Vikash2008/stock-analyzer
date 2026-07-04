// Mirrors Python _fmt() from dashboard/metrics.py

export function fmtINR(value: number): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(2)} Cr`
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(2)} L`
  return `${sign}₹${Math.round(abs).toLocaleString('en-IN')}`
}

export function fmtUSD(value: number): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`
  return `${sign}$${Math.round(abs).toLocaleString('en-US')}`
}

export function fmt(value: number, currency: 'INR' | 'USD'): string {
  return currency === 'INR' ? fmtINR(value) : fmtUSD(value)
}

export function fmtPct(value: number): string {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

// "+₹4.2L (+12.3%)" or "−₹4.2L (−12.3%)" — used in card gain rows
export function fmtGainLine(
  gain: number,
  pct: number | null,
  currency: 'INR' | 'USD',
): string {
  const sign   = gain >= 0 ? '+' : '−'
  const valStr = `${sign}${fmt(Math.abs(gain), currency)}`
  if (pct === null) return valStr
  return `${valStr} (${fmtPct(pct)})`
}

export function fmtCompact(value: number, currency: 'INR' | 'USD'): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (currency === 'INR') {
    if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(1)}Cr`
    if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(1)}L`
    if (abs >= 1e3) return `${sign}₹${(abs / 1e3).toFixed(1)}K`
    return `${sign}₹${Math.round(abs)}`
  }
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`
  return `${sign}$${Math.round(abs)}`
}

export function fmtCompactGainLine(gain: number, pct: number | null, currency: 'INR' | 'USD'): string {
  const arrow = gain >= 0 ? '▲' : '▼'
  const valStr = `${arrow} ${fmtCompact(Math.abs(gain), currency)}`
  if (pct === null) return valStr
  return `${valStr} (${fmtPct(pct)})`
}

// Formats a date ISO string → "23 May 2026"
export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

// "14:32 04 Jul" — used by every "last synced"/"last fetched" label (Charts, Benchmarking,
// Dividends refresh controls)
export function fmtSyncTime(d: Date): string {
  const hh  = String(d.getHours()).padStart(2, '0')
  const mm  = String(d.getMinutes()).padStart(2, '0')
  const dd  = String(d.getDate()).padStart(2, '0')
  const mon = d.toLocaleString('en-US', { month: 'short' })
  return `${hh}:${mm} ${dd} ${mon}`
}
