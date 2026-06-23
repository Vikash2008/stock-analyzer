// Temporary diagnostic log for the mobile CSV-revert investigation.
// Persisted to localStorage (not just memory) so entries survive a service-worker
// update reload — the exact moment we need to see what happened.
const KEY = 'debug:csvlog'
const MAX_ENTRIES = 2000

export interface LogEntry {
  t: number
  msg: string
}

function read(): LogEntry[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch {
    return []
  }
}

export function logDebug(msg: string) {
  try {
    const entries = read()
    entries.push({ t: Date.now(), msg })
    while (entries.length > MAX_ENTRIES) entries.shift()
    localStorage.setItem(KEY, JSON.stringify(entries))
  } catch {
    // localStorage full — nothing more we can do for a debug log
  }
}

export function getDebugLog(): LogEntry[] {
  return read()
}

export function clearDebugLog() {
  localStorage.removeItem(KEY)
}
