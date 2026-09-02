import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { PortfolioData } from '../api/types'
import { useSetTags } from '../hooks/useSetTags'
import {
  addLabel, deleteLabel, getLabel, setLabelOrder, getAllLabelsInBucket,
  setLabelBenchmark, SECTOR_BUCKET,
} from '../utils/buckets'
import { SKIP_PORTS } from '../utils/segments'
import { getSectorForHolding, getSectorBenchmark } from '../utils/sectors'

const API_URL = (import.meta.env.VITE_API_URL ?? '') as string

// Editable benchmark-index field with type-ahead — mirrors the Explore search pattern
// (debounced /api/search, which already includes Yahoo INDEX results alongside EQUITY/ETF).
// Free typing + blur-commit still works as a fallback for an index the search doesn't surface.
function BenchmarkInput({ sector }: { sector: string }) {
  const [value, setValue] = useState(() => getSectorBenchmark(sector))
  const [suggestions, setSuggestions] = useState<{ symbol: string; name: string; exchange: string }[]>([])
  const [open, setOpen] = useState(false)
  useEffect(() => { setValue(getSectorBenchmark(sector)) }, [sector])

  useEffect(() => {
    const q = value.trim()
    if (q.length < 1) { setSuggestions([]); return }
    const controller = new AbortController()
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`${API_URL}/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        if (res.ok) setSuggestions(await res.json())
      } catch { /* aborted by next keystroke — ignore */ }
    }, 300)
    return () => { clearTimeout(id); controller.abort() }
  }, [value])

  function commit(v: string) {
    const trimmed = v.trim()
    if (trimmed) setLabelBenchmark(SECTOR_BUCKET, sector, trimmed)
  }

  return (
    <div className="relative shrink-0">
      <input
        value={value}
        onChange={e => { setValue(e.target.value); setOpen(true) }}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onBlur={() => { setTimeout(() => setOpen(false), 150); commit(value) }}
        onKeyDown={e => { if (e.key === 'Enter') { commit(value); (e.target as HTMLInputElement).blur() } }}
        placeholder="Benchmark index"
        title="Benchmark index used for this category's XIRR comparison"
        className="w-[92px] px-1.5 py-1 text-[10px] border border-emerald-100 rounded-md bg-white focus:outline-none focus:border-teal-400"
      />
      {open && suggestions.length > 0 && (
        <div className="absolute right-0 top-full mt-1 z-[210] w-[180px] bg-white border border-emerald-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
          {suggestions.map(s => (
            <button
              key={s.symbol}
              type="button"
              onMouseDown={() => { setValue(s.symbol); commit(s.symbol); setOpen(false) }}
              className="w-full text-left px-2 py-1.5 active:bg-emerald-50 border-b border-emerald-50 last:border-b-0"
            >
              <p className="text-[11px] font-semibold text-slate-800 truncate">{s.symbol}</p>
              <p className="text-[9px] text-slate-400 truncate">{s.name}{s.exchange ? ` · ${s.exchange}` : ''}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface Props {
  open:    boolean
  onClose: () => void
  data:    PortfolioData
  onChanged: () => void
}

export function ManageCategoryModal({ open, onClose, data, onChanged }: Props) {
  const { mutate, isPending } = useSetTags()

  const [labels, setLabels] = useState<string[]>(() => getAllLabelsInBucket(data, SECTOR_BUCKET))
  const [newSectorName, setNewSectorName] = useState('')

  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  useEffect(() => { if (open) setExpanded(new Set()) }, [open])
  useEffect(() => { setLabels(getAllLabelsInBucket(data, SECTOR_BUCKET)) }, [data])
  function toggleExpanded(key: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  function refresh() {
    setLabels(getAllLabelsInBucket(data, SECTOR_BUCKET))
    onChanged()
  }

  function handleAddSector() {
    const name = newSectorName.trim()
    if (!name || name.includes(';') || name.includes('=')) return
    addLabel(SECTOR_BUCKET, name)
    setNewSectorName('')
    refresh()
  }

  function affectedHoldings(sector: string) {
    const seen = new Set<string>()
    const out: { portfolio: string; symbol: string }[] = []
    for (const tx of data.transactions) {
      if (getLabel(tx, SECTOR_BUCKET) !== sector) continue
      const key = `${tx.portfolio}:${tx.symbol}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ portfolio: tx.portfolio, symbol: tx.symbol })
    }
    return out
  }

  function handleDeleteSector(sector: string) {
    const affected = affectedHoldings(sector)
    if (affected.length > 0 && !window.confirm(`"${sector}" has ${affected.length} holding(s) assigned. Delete anyway? This will unassign them.`)) return
    function afterUnassign() { deleteLabel(SECTOR_BUCKET, sector); refresh() }
    if (affected.length === 0) { afterUnassign(); return }
    mutate(affected.map(h => ({ ...h, bucket: SECTOR_BUCKET, label: '' })), { onSuccess: afterUnassign })
  }

  // One row per unique symbol (not per portfolio:symbol) — a holding's category doesn't vary by
  // broker, so reassigning it applies across every portfolio it's currently held in.
  const uniqueHoldings = useMemo(() => {
    const map = new Map<string, { symbol: string; label: string; portfolios: string[]; sector: string }>()
    for (const h of data.holdings) {
      if (SKIP_PORTS.has(h.portfolio)) continue
      const existing = map.get(h.symbol)
      if (existing) { existing.portfolios.push(h.portfolio); continue }
      map.set(h.symbol, {
        symbol: h.symbol,
        label: h.company || h.name || h.symbol,
        portfolios: [h.portfolio],
        sector: getSectorForHolding(h.yf_symbol, h.tags),
      })
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label))
  }, [data])

  function handleSectorChange(h: { symbol: string; portfolios: string[] }, sector: string) {
    mutate(h.portfolios.map(portfolio => ({ portfolio, symbol: h.symbol, bucket: SECTOR_BUCKET, label: sector })), {
      onSuccess: refresh,
    })
  }

  // Drag-to-reorder for sector rows — same pattern as ManageBucketsModal's Label reordering.
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const [drag, setDrag] = useState<{ label: string; pointerId: number; startY: number; y: number } | null>(null)

  function reorderForPointer(label: string, pointerY: number) {
    const without = labels.filter(l => l !== label)
    let insertAt  = without.length
    for (let i = 0; i < without.length; i++) {
      const el = rowRefs.current.get(without[i])
      if (!el) continue
      const rect = el.getBoundingClientRect()
      if (pointerY < rect.top + rect.height / 2) { insertAt = i; break }
    }
    const next = [...without]
    next.splice(insertAt, 0, label)
    if (next.join('|') !== labels.join('|')) {
      setLabelOrder(SECTOR_BUCKET, next)
      refresh()
    }
  }

  function handleDragPointerDown(label: string, e: ReactPointerEvent) {
    e.preventDefault()
    const pointerId = e.pointerId
    setDrag({ label, pointerId, startY: e.clientY, y: e.clientY })

    const prevBodyOverflow = document.body.style.overflow
    const prevBodyTouchAction = document.body.style.touchAction
    document.body.style.overflow = 'hidden'
    document.body.style.touchAction = 'none'

    function blockTouch(ev: TouchEvent) { ev.stopPropagation(); ev.preventDefault() }
    window.addEventListener('touchstart', blockTouch, { capture: true, passive: false })
    window.addEventListener('touchmove', blockTouch, { capture: true, passive: false })

    function onMove(ev: PointerEvent) {
      if (ev.pointerId !== pointerId) return
      ev.preventDefault()
      setDrag(prev => (prev ? { ...prev, y: ev.clientY } : prev))
      reorderForPointer(label, ev.clientY)
    }
    function onUp(ev: PointerEvent) {
      if (ev.pointerId !== pointerId) return
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('touchstart', blockTouch, { capture: true })
      window.removeEventListener('touchmove', blockTouch, { capture: true })
      document.body.style.overflow = prevBodyOverflow
      document.body.style.touchAction = prevBodyTouchAction
      setDrag(null)
    }
    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
  }

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[200]" onClick={onClose} />
      <div
        className="fixed inset-x-3 z-[201] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-emerald-100"
        style={{ top: '5dvh', maxHeight: '90dvh', maxWidth: 320, margin: '0 auto' }}
      >
        <div className="px-3.5 py-2 flex items-center justify-between shrink-0" style={{ background: 'linear-gradient(135deg, #0b3b3a 0%, #0d9488 100%)' }}>
          <span className="text-[15px] font-extrabold text-white tracking-[-0.2px]">Manage Category</span>
          <button onClick={onClose} className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[13px] leading-none" style={{ background: 'rgba(255,255,255,0.12)' }}>✕</button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 px-2.5 py-2.5" style={{ background: '#f8fafc' }}>

          {/* Manage Index — the category catalog: name + benchmark index per row */}
          {(() => {
            const isOpen = expanded.has('__index__')
            return (
            // overflow-visible while open — BenchmarkInput's suggestions dropdown is an
            // absolutely-positioned descendant that must escape this card's rounded-corner clip.
            <div className={`bg-white rounded-lg border border-emerald-100 shadow-sm ${isOpen ? 'overflow-visible' : 'overflow-hidden'}`}>
              <div
                className="flex items-center gap-1 px-2 py-1.5 cursor-pointer"
                style={{ background: 'rgba(13,148,136,0.06)' }}
                onClick={() => toggleExpanded('__index__')}
              >
                <span className="text-slate-400 text-[10px] shrink-0 w-3">{isOpen ? '▾' : '▸'}</span>
                <span className="text-[13px] font-bold text-[#0b3b3a] truncate flex-1 min-w-0">Manage Index</span>
                <div className="relative shrink-0 w-[84px]" onClick={e => e.stopPropagation()}>
                  <input
                    value={newSectorName}
                    onChange={e => setNewSectorName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAddSector() }}
                    placeholder="Add category"
                    className="w-full pl-1.5 pr-6 py-1 text-[11px] border border-emerald-100 rounded-md bg-white focus:outline-none focus:border-teal-400"
                  />
                  <button
                    onClick={handleAddSector}
                    className="absolute right-[3px] top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center rounded-md text-white active:opacity-80"
                    style={{ background: 'linear-gradient(135deg, #0b3b3a 0%, #0d9488 100%)' }}
                    title="Add category"
                  >
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                  </button>
                </div>
              </div>

              {isOpen && (
                <div className="px-2 py-1.5 space-y-1">
                  {labels.map(l => {
                    const isDragging = drag?.label === l
                    return (
                    <div
                      key={l}
                      ref={el => { if (el) rowRefs.current.set(l, el); else rowRefs.current.delete(l) }}
                      className={`flex items-center gap-1.5 bg-emerald-50/60 border rounded-lg pl-1 pr-1.5 py-0.5 ${isDragging ? 'border-emerald-400 shadow-lg relative z-50' : 'border-emerald-100'}`}
                      style={isDragging ? { transform: `translateY(${drag.y - drag.startY}px)`, touchAction: 'none' } : undefined}
                    >
                      <button
                        onPointerDown={e => handleDragPointerDown(l, e)}
                        className="text-emerald-300 active:text-emerald-600 leading-none shrink-0 w-6 h-6 flex items-center justify-center cursor-grab active:cursor-grabbing"
                        style={{ touchAction: 'none' }}
                        title="Drag to reorder"
                      >
                        <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor"><circle cx="2" cy="2" r="1.3" /><circle cx="8" cy="2" r="1.3" /><circle cx="2" cy="7" r="1.3" /><circle cx="8" cy="7" r="1.3" /><circle cx="2" cy="12" r="1.3" /><circle cx="8" cy="12" r="1.3" /></svg>
                      </button>
                      <span className="flex-1 text-[13px] font-medium text-slate-700 truncate min-w-0">{l}</span>
                      <BenchmarkInput sector={l} />
                      <button
                        onClick={() => handleDeleteSector(l)}
                        disabled={isPending}
                        className="text-red-300 active:text-red-600 leading-none disabled:opacity-50 shrink-0 w-5 h-5 flex items-center justify-center"
                        title="Delete category"
                      >
                        ×
                      </button>
                    </div>
                    )
                  })}
                </div>
              )}
            </div>
            )
          })()}

          {/* Manage Holdings — direct per-holding category reassignment */}
          {(() => {
            const isOpen = expanded.has('__holdings__')
            return (
            <div className="bg-white rounded-lg border border-emerald-100 shadow-sm overflow-hidden">
              <div
                className="flex items-center gap-1 px-2 py-1.5 cursor-pointer"
                style={{ background: 'rgba(13,148,136,0.06)' }}
                onClick={() => toggleExpanded('__holdings__')}
              >
                <span className="text-slate-400 text-[10px] shrink-0 w-3">{isOpen ? '▾' : '▸'}</span>
                <span className="text-[13px] font-bold text-[#0b3b3a] flex-1">Manage Holdings</span>
              </div>
              {isOpen && (
                <div className="px-2 py-1.5 space-y-1 max-h-64 overflow-y-auto">
                  {uniqueHoldings.map(h => (
                    <div key={h.symbol} className="flex items-center gap-1.5 bg-emerald-50/60 border border-emerald-100 rounded-lg pl-2 pr-1.5 py-1">
                      <span className="flex-1 min-w-0 text-[13px] font-medium text-slate-700 truncate">{h.label}</span>
                      <select
                        value={h.sector}
                        disabled={isPending}
                        onChange={e => handleSectorChange(h, e.target.value)}
                        className="shrink-0 max-w-[110px] px-1.5 py-1 text-[11px] border border-emerald-100 rounded-md bg-white focus:outline-none focus:border-teal-400 disabled:opacity-50"
                      >
                        {!labels.includes(h.sector) && <option value={h.sector}>{h.sector}</option>}
                        {labels.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>
            )
          })()}
        </div>
      </div>
    </>
  )
}
