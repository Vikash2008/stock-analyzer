// Shared incremental-merge + shrink-guard helpers used by both chart request shapes
// (useHistory.ts's single-array per-symbol price series, useBackendPortfolioHistory.ts's
// multi-array per-user aggregate series). Previously each hook implemented its own version of
// "merge a delta onto existing data" / "don't trust a suspiciously-shrunk response" slightly
// differently — a fix to that logic had to be made twice. This is the one place it lives now.

interface DatedShape {
  dates: string[]
}

// Looser bound for guardShrink — only ever needs .length, so it works for either useHistory.ts's
// string-dates shape or useBackendPortfolioHistory.ts's Date[]-dates shape without forcing a cast.
interface HasDateCount {
  dates: { length: number }
}

// Merges a delta response onto existing cached data, date-aligned across every numeric series
// named in `numericKeys` — e.g. ['prices'] for a single-series shape, or
// ['values','invested','unrealized',...] for a multi-series one. Dates present in both keep the
// delta's value (the backend always re-includes the boundary bar, which may have been revised).
export function mergeDateAligned<T extends DatedShape>(
  existing: T,
  delta: T,
  numericKeys: (keyof T)[],
): T {
  const merged: Record<string, Record<string, number>> = {}
  for (const key of numericKeys) merged[key as string] = {}

  existing.dates.forEach((d, i) => {
    for (const key of numericKeys) {
      const arr = existing[key] as unknown as number[] | undefined
      if (arr) merged[key as string][d] = arr[i]
    }
  })
  delta.dates.forEach((d, i) => {
    for (const key of numericKeys) {
      const arr = delta[key] as unknown as number[] | undefined
      if (arr) merged[key as string][d] = arr[i]
    }
  })

  const dates = Object.keys(merged[numericKeys[0] as string] ?? {}).sort()
  // delta must win for non-array metadata (dataAsOf, guardRejected, ...) — otherwise every
  // delta merge after the first fetch keeps re-serving the original fetch's stale timestamp
  // forever, even though the underlying data keeps refreshing successfully.
  const out: Record<string, unknown> = { ...(existing as object), ...(delta as object), dates }
  for (const key of numericKeys) {
    out[key as string] = dates.map(d => merged[key as string][d])
  }
  return out as T
}

// Below this point count, a shrink comparison isn't meaningful — short real histories exist
// (e.g. a portfolio/holding that only started a few weeks ago). Mirrors the backend's own
// _MIN_HEALTHY_POINTS (portfolio_history.py) / MIN_HEALTHY_DATES (useHistory.ts, pre-unification).
export const MIN_HEALTHY_POINTS = 30

// Defense against a fresh (non-delta) response being suspiciously shorter than what's already
// cached — a transient bad recompute/download shouldn't silently replace good data. Returns the
// fresh response unchanged when it looks healthy; otherwise keeps the existing data and flags
// the rejection so the caller can surface a "couldn't verify latest update" state instead of
// showing (or worse, persisting) a collapsed chart.
export function guardShrink<T extends HasDateCount>(
  existing: T | undefined,
  fresh: T,
  onReject?: (existingLen: number, freshLen: number) => void,
): { data: T; rejected: boolean } {
  if (!existing?.dates?.length || existing.dates.length < MIN_HEALTHY_POINTS) {
    return { data: fresh, rejected: false }
  }
  if (fresh.dates.length >= existing.dates.length * 0.5) {
    return { data: fresh, rejected: false }
  }
  onReject?.(existing.dates.length, fresh.dates.length)
  return { data: existing, rejected: true }
}

// ── Shared freshness signal (Category 7) ────────────────────────────────────────────────────
// Turns a fetched series' envelope fields into a user-facing freshness signal — the whole point
// of dataAsOf/guardRejected/todayMismatch existing on the backend is so the UI can say "this may
// be wrong or old" instead of silently showing possibly-stale data as if it were current. Used
// by both chart types; each hook's own getChartFreshness (if it has one) is a thin wrapper
// around this with its own refresh cadence.
export interface ChartFreshness {
  label:   string   // "As of 14:32"
  warning: boolean  // true → render with warning styling instead of plain gray
  detail?: string   // short reason appended after the label when warning is true
}

interface FreshnessEnvelope {
  dataAsOfMs:     number
  guardRejected?: boolean
  todayMismatch?: boolean
}

export function computeChartFreshness(series: FreshnessEnvelope | null | undefined, refreshMs: number): ChartFreshness | null {
  if (!series) return null
  const d = new Date(series.dataAsOfMs)
  const label = `As of ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  if (series.guardRejected) return { label, warning: true, detail: "couldn't verify latest update" }
  if (series.todayMismatch) return { label, warning: true, detail: 'numbers may be off' }
  if (Date.now() - series.dataAsOfMs > 2 * refreshMs) {
    return { label, warning: true, detail: 'refresh may be delayed' }
  }
  return { label, warning: false }
}
