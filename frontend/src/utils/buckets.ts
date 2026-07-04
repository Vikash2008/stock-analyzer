// User-defined classification: a Bucket is a named dimension (e.g. "Asset Class", "Type",
// "Risk"); a Label is a value within it (e.g. "Stocks"/"Mutual Funds" under "Asset Class").
// A holding can carry one Label per Bucket, across as many Buckets as exist.
//
// Assignments live in the portable `tags` CSV column (source of truth, e.g.
// "Asset Class=Stocks;Type=Indian Stocks"). The catalog of Bucket/Label *names* (so pickers
// have something to show even before anything is assigned) is a small client-side list in
// localStorage — not portable, but trivial to recreate.

import type { Holding, Transaction, PortfolioData } from '../api/types'
import type { Currency } from '../App'

const ASSET_CLASS = 'Asset Class'
const CATALOG_KEY = 'buckets:catalog'
const LABEL_CURRENCY_KEY = 'buckets:label-currency'

export interface BucketDef {
  name:        string
  labels:      string[]
  showToggle:  boolean
}

export function parseTags(tags: string | null | undefined): Record<string, string> {
  if (!tags) return {}
  const out: Record<string, string> = {}
  for (const part of tags.split(';')) {
    const i = part.indexOf('=')
    if (i === -1) continue
    out[part.slice(0, i)] = part.slice(i + 1)
  }
  return out
}

export function encodeTags(map: Record<string, string>): string {
  return Object.entries(map)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}=${v}`)
    .join(';')
}

/** Resolve a Label for a given Bucket from a raw `tags` string — explicit entry, else
 * 'Unassigned'. No auto-classification: every Bucket (including the auto-seeded "Asset
 * Class") requires an explicit tag now, so a freshly created/recreated Label always starts
 * empty until holdings are tagged into it (e.g. via Copy Holdings). `quoteType` is accepted
 * for call-site compatibility but no longer used. */
export function resolveLabel(tags: string | null | undefined, bucket: string, quoteType?: string): string {
  void quoteType
  const explicit = parseTags(tags)[bucket]
  return explicit || 'Unassigned'
}

/** Resolve a holding/transaction's Label for a given Bucket — explicit `tags` entry only. */
export function getLabel(row: Holding | Transaction, bucket: string): string {
  return resolveLabel(row.tags, bucket)
}

export function filterByLabel(holdings: Holding[], bucket: string, label: string): Holding[] {
  return holdings.filter(h => getLabel(h, bucket) === label)
}

// ── Bucket/Label catalog (localStorage) ─────────────────────────────────────────────────

function defaultCatalog(): BucketDef[] {
  return [{ name: ASSET_CLASS, labels: ['Stocks', 'Mutual Funds'], showToggle: true }]
}

export function getBuckets(): BucketDef[] {
  try {
    const raw = localStorage.getItem(CATALOG_KEY)
    if (!raw) { saveBuckets(defaultCatalog()); return defaultCatalog() }
    return JSON.parse(raw)
  } catch {
    return defaultCatalog()
  }
}

export function saveBuckets(buckets: BucketDef[]) {
  try { localStorage.setItem(CATALOG_KEY, JSON.stringify(buckets)) } catch {}
}

export function createBucket(name: string) {
  const buckets = getBuckets()
  if (buckets.some(b => b.name === name)) return
  saveBuckets([...buckets, { name, labels: [], showToggle: true }])
}

export function deleteBucket(name: string) {
  saveBuckets(getBuckets().filter(b => b.name !== name))
}

export function deleteLabel(bucket: string, label: string) {
  saveBuckets(
    getBuckets().map(b =>
      b.name === bucket ? { ...b, labels: b.labels.filter(l => l !== label) } : b,
    ),
  )
}

export function addLabel(bucket: string, label: string) {
  saveBuckets(
    getBuckets().map(b =>
      b.name === bucket && !b.labels.includes(label)
        ? { ...b, labels: [...b.labels, label] }
        : b,
    ),
  )
}

export function setBucketToggle(bucket: string, enabled: boolean) {
  saveBuckets(getBuckets().map(b => (b.name === bucket ? { ...b, showToggle: enabled } : b)))
}

/** Persist a user-chosen display order for a Bucket's Labels — overwrites the catalog's
 * `labels` list wholesale (including any live-only labels passed in), so cards render in
 * this exact order everywhere `getAllLabelsInBucket` is used. */
export function setLabelOrder(bucket: string, orderedLabels: string[]) {
  saveBuckets(getBuckets().map(b => (b.name === bucket ? { ...b, labels: orderedLabels } : b)))
}

/** Rebuild any Bucket/Label the catalog is missing by scanning every transaction's `tags`
 * column — recovers from a wiped/cleared localStorage catalog after a CSV re-import, since
 * `tags` (unlike the catalog) is portable and survives in the backup file. Only adds; never
 * removes a catalog entry the CSV doesn't mention. */
export function reconcileBucketsFromTags(data: PortfolioData): void {
  const found = new Map<string, Set<string>>()
  for (const tx of data.transactions) {
    for (const [bucket, label] of Object.entries(parseTags(tx.tags))) {
      if (!label) continue
      if (!found.has(bucket)) found.set(bucket, new Set())
      found.get(bucket)!.add(label)
    }
  }
  if (found.size === 0) return

  const buckets = getBuckets()
  let changed = false
  const merged = buckets.map(b => ({ ...b, labels: [...b.labels] }))
  for (const [bucketName, labels] of found) {
    let b = merged.find(b => b.name === bucketName)
    if (!b) {
      b = { name: bucketName, labels: [], showToggle: true }
      merged.push(b)
      changed = true
    }
    for (const label of labels) {
      if (!b.labels.includes(label)) {
        b.labels.push(label)
        changed = true
      }
    }
  }
  if (changed) saveBuckets(merged)
}

// ── Per-Label display currency (Manage Buckets modal) ───────────────────────────────────
// Kept as its own map (bucket+label -> currency), separate from BucketDef.labels, so nothing
// that treats labels as plain strings elsewhere needs to change. Only used for a Label's own
// rollup tile — an individual holding's own numbers always use its own CSV `currency` field.

function readLabelCurrencyMap(): Record<string, Currency> {
  try {
    const raw = localStorage.getItem(LABEL_CURRENCY_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

// ';' is safe as a separator — Bucket/Label names may never contain ';' or '=' (see
// handleNewBucket/handleAddLabel validation in ManageBucketsModal.tsx).
function labelCurrencyKey(bucket: string, label: string): string {
  return bucket + ';' + label
}

export function getLabelCurrency(bucket: string, label: string): Currency {
  return readLabelCurrencyMap()[labelCurrencyKey(bucket, label)] ?? 'INR'
}

export function setLabelCurrency(bucket: string, label: string, currency: Currency) {
  const map = readLabelCurrencyMap()
  map[labelCurrencyKey(bucket, label)] = currency
  try { localStorage.setItem(LABEL_CURRENCY_KEY, JSON.stringify(map)) } catch {}
}

/** The catalog's known Labels for a Bucket, in their saved order, followed by any label
 * that's only resolved live from transactions (not yet in the catalog) — so a Bucket shows
 * real data immediately, even pre-catalog, while still respecting user-chosen ordering. */
export function getAllLabelsInBucket(data: PortfolioData, bucket: string): string[] {
  const catalog = getBuckets().find(b => b.name === bucket)
  const catalogLabels = catalog?.labels ?? []
  const live = new Set<string>()
  for (const tx of data.transactions) live.add(getLabel(tx, bucket))
  live.delete('Unassigned')
  const extra = [...live].filter(l => !catalogLabels.includes(l)).sort()
  return [...catalogLabels, ...extra]
}
