// Shared key-value cache backed by IndexedDB instead of localStorage. Same per-key usage
// pattern the chart/quickstats/dividends/gemini caches already had (lsGet/lsSet-style), but
// quota here is a slice of the device's actual free disk (tens-to-hundreds of MB) instead of
// localStorage's fixed ~5-10MB per-origin ceiling — the root cause behind several past bugs
// (mobile CSV reverting to demo, silent write failures under quota pressure).
//
// React Query's initialData/placeholderData need a synchronous value at hook-call time, so
// the whole store is loaded into an in-memory Map once at app boot (`idbReady`, awaited in
// main.tsx before the first render) and every read after that is synchronous against the Map.
// Writes update the Map immediately and persist to IndexedDB in the background.

const DB_NAME = 'stock-analyzer'
const STORE = 'cache'
const DB_VERSION = 1

let _map: Map<string, unknown> = new Map()
let _db: IDBDatabase | null = null

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE) }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export const idbReady: Promise<void> = (async () => {
  try {
    _db = await openDb()
    const entries = await new Promise<[string, unknown][]>((resolve, reject) => {
      const tx = _db!.transaction(STORE, 'readonly')
      const store = tx.objectStore(STORE)
      const out: [string, unknown][] = []
      const cursorReq = store.openCursor()
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result
        if (cursor) { out.push([String(cursor.key), cursor.value]); cursor.continue() }
        else resolve(out)
      }
      cursorReq.onerror = () => reject(cursorReq.error)
    })
    _map = new Map(entries)
  } catch {
    // IndexedDB unavailable (private browsing, very old browser) — every read misses and
    // every fetch just runs fresh, same as a permanently-cold cache.
  }
})()

export function idbGet<T = unknown>(key: string): T | undefined {
  return _map.get(key) as T | undefined
}

export function idbSet(key: string, value: unknown): void {
  _map.set(key, value)
  if (!_db) return
  try {
    _db.transaction(STORE, 'readwrite').objectStore(STORE).put(value, key)
  } catch { /* best-effort persistence; in-memory copy is already up to date */ }
}

export function idbDelete(key: string): void {
  _map.delete(key)
  if (!_db) return
  try {
    _db.transaction(STORE, 'readwrite').objectStore(STORE).delete(key)
  } catch { /* best-effort */ }
}

export function idbKeys(prefix?: string): string[] {
  const keys = [..._map.keys()]
  return prefix ? keys.filter(k => k.startsWith(prefix)) : keys
}
