// Diagnostic panel for the mobile CSV-revert investigation, kept as a safety
// net per user request. Opened via the "Debug Log" row in PortfoliosPage's
// Settings popover (dispatches the 'debug-overlay:open' window event below)
// rather than its own floating trigger button.
import { useEffect, useState } from 'react'
import { getDebugLog, clearDebugLog } from '../utils/debugLog'

function fmtTime(t: number) {
  return new Date(t).toLocaleTimeString('en-IN', { hour12: false })
}

export default function DebugOverlay() {
  const [open, setOpen] = useState(false)
  const [entries, setEntries] = useState(getDebugLog())

  useEffect(() => {
    const handler = () => { setEntries(getDebugLog()); setOpen(true) }
    window.addEventListener('debug-overlay:open', handler)
    return () => window.removeEventListener('debug-overlay:open', handler)
  }, [])

  useEffect(() => {
    if (!open) return
    const id = setInterval(() => setEntries(getDebugLog()), 1000)
    return () => clearInterval(id)
  }, [open])

  if (!open) return null

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
