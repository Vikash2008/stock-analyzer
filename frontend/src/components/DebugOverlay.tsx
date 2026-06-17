// Temporary diagnostic panel for the mobile CSV-revert investigation.
// Remove once root cause is confirmed and fixed.
import { useEffect, useState } from 'react'
import { getDebugLog, clearDebugLog } from '../utils/debugLog'

function fmtTime(t: number) {
  return new Date(t).toLocaleTimeString('en-IN', { hour12: false })
}

export default function DebugOverlay() {
  const [open, setOpen] = useState(false)
  const [entries, setEntries] = useState(getDebugLog())

  useEffect(() => {
    if (!open) return
    const id = setInterval(() => setEntries(getDebugLog()), 1000)
    return () => clearInterval(id)
  }, [open])

  if (!open) {
    return (
      <button
        onClick={() => setEntries(getDebugLog()) || setOpen(true)}
        aria-label="Open debug log"
        className="fixed bottom-2 left-2 z-[9999] w-11 h-11 rounded-full bg-slate-800 text-white text-[16px] flex items-center justify-center opacity-60 active:opacity-100"
      >
        🐛
      </button>
    )
  }

  const csvLen = (localStorage.getItem('portfolio:csv') ?? '').length
  const csvMeta = localStorage.getItem('portfolio:csv:meta')

  const keySizes = Object.keys(localStorage)
    .map(k => ({ k, size: (localStorage.getItem(k) ?? '').length }))
    .sort((a, b) => b.size - a.size)
  const totalSize = keySizes.reduce((s, e) => s + e.size, 0)

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 flex flex-col p-2">
      <div className="flex items-center justify-between bg-slate-900 text-white px-3 py-2 rounded-t-lg">
        <span className="text-[13px] font-semibold">Debug Log</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { clearDebugLog(); setEntries([]) }}
            className="text-[11px] bg-slate-700 px-2 py-1 rounded"
          >
            Clear
          </button>
          <button
            onClick={() => setOpen(false)}
            className="text-[16px] px-2"
          >
            ×
          </button>
        </div>
      </div>
      <div className="bg-slate-800 text-emerald-300 text-[10px] px-3 py-2">
        portfolio:csv length: {csvLen} · meta: {csvMeta ?? 'null'}
      </div>
      <div className="bg-slate-800 text-amber-300 text-[10px] px-3 py-2 border-t border-slate-700">
        localStorage total: ~{(totalSize / 1024).toFixed(0)}KB across {keySizes.length} keys
        <div className="mt-1 max-h-[120px] overflow-y-auto">
          {keySizes.slice(0, 15).map(({ k, size }) => (
            <div key={k} className="flex justify-between gap-2">
              <span className="truncate">{k}</span>
              <span className="shrink-0">{(size / 1024).toFixed(1)}KB</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto bg-slate-950 text-slate-200 text-[10px] font-mono p-2 rounded-b-lg">
        {entries.length === 0 && <div className="text-slate-500">No entries yet.</div>}
        {entries.map((e, i) => (
          <div key={i} className="mb-1 border-b border-slate-800 pb-1">
            <span className="text-slate-500">{fmtTime(e.t)}</span> {e.msg}
          </div>
        ))}
      </div>
    </div>
  )
}
