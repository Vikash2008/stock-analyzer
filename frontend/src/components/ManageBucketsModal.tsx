import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { PortfolioData } from '../api/types'
import { useSetTags } from '../hooks/useSetTags'
import {
  getBuckets, createBucket, addLabel, setBucketToggle, getAllLabelsInBucket,
  deleteBucket, deleteLabel, getLabel, setLabelOrder,
  type BucketDef,
} from '../utils/buckets'

interface Props {
  open:    boolean
  onClose: () => void
  data:    PortfolioData
  onChanged: () => void   // call after any catalog edit so the caller can refresh its toggle list
}

export function ManageBucketsModal({ open, onClose, data, onChanged }: Props) {
  const { mutate, isPending } = useSetTags()

  const [buckets, setBuckets] = useState<BucketDef[]>(getBuckets)
  const [newBucketName, setNewBucketName] = useState('')
  const [newLabelByBucket, setNewLabelByBucket] = useState<Record<string, string>>({})

  function refreshBuckets() {
    setBuckets(getBuckets())
    onChanged()
  }

  function handleNewBucket() {
    const name = newBucketName.trim()
    if (!name || name.includes(';') || name.includes('=')) return
    createBucket(name)
    setNewBucketName('')
    refreshBuckets()
  }

  function handleAddLabel(bucket: string) {
    const label = (newLabelByBucket[bucket] ?? '').trim()
    if (!label || label.includes(';') || label.includes('=')) return
    addLabel(bucket, label)
    setNewLabelByBucket(prev => ({ ...prev, [bucket]: '' }))
    refreshBuckets()
  }

  function clearTagsThen(holdings: { portfolio: string; symbol: string }[], bucket: string, after: () => void) {
    if (holdings.length === 0) { after(); return }
    mutate(
      holdings.map(h => ({ portfolio: h.portfolio, symbol: h.symbol, bucket, label: '' })),
      { onSuccess: after },
    )
  }

  // Source affected rows from `data.transactions`, not `data.holdings` — getAllLabelsInBucket
  // resolves labels from transactions too, so a tag on a closed-out symbol (no current holding)
  // would otherwise never get cleared and the label would reappear after refreshBuckets().
  function affectedPortfolioSymbols(predicate: (label: string) => boolean, bucket: string) {
    const seen = new Set<string>()
    const out: { portfolio: string; symbol: string }[] = []
    for (const tx of data.transactions) {
      if (!predicate(getLabel(tx, bucket))) continue
      const key = `${tx.portfolio}:${tx.symbol}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ portfolio: tx.portfolio, symbol: tx.symbol })
    }
    return out
  }

  function handleDeleteBucket(bucket: string) {
    const affected = affectedPortfolioSymbols(lbl => lbl !== 'Unassigned', bucket)
    if (affected.length > 0 && !window.confirm(`"${bucket}" has ${affected.length} holding(s) assigned. Delete anyway? This will unassign them.`)) return
    clearTagsThen(affected, bucket, () => { deleteBucket(bucket); refreshBuckets() })
  }

  function handleDeleteLabel(bucket: string, label: string) {
    const affected = affectedPortfolioSymbols(lbl => lbl === label, bucket)
    if (affected.length > 0 && !window.confirm(`"${label}" has ${affected.length} holding(s) assigned. Delete anyway? This will unassign them.`)) return
    clearTagsThen(affected, bucket, () => { deleteLabel(bucket, label); refreshBuckets() })
  }

  // Drag-to-reorder for Labels — a dedicated grip handle (rather than long-press anywhere on
  // the row) so it doesn't fight with scrolling the modal on mobile. The list reorders live as
  // the finger crosses a row's midpoint; the dragged row tracks the finger via a transform
  // offset (total pointer movement since pointerdown) so it stays visually under the touch
  // point regardless of where it lands in the underlying array.
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const [drag, setDrag] = useState<{ bucket: string; label: string; pointerId: number; startY: number; y: number } | null>(null)

  function reorderForPointer(bucket: string, label: string, pointerY: number) {
    const order   = getAllLabelsInBucket(data, bucket)
    const without = order.filter(l => l !== label)
    let insertAt  = without.length
    for (let i = 0; i < without.length; i++) {
      const el = rowRefs.current.get(`${bucket}:${without[i]}`)
      if (!el) continue
      const rect = el.getBoundingClientRect()
      if (pointerY < rect.top + rect.height / 2) { insertAt = i; break }
    }
    const next = [...without]
    next.splice(insertAt, 0, label)
    if (next.join('|') !== order.join('|')) {
      setLabelOrder(bucket, next)
      refreshBuckets()
    }
  }

  function handleDragPointerDown(bucket: string, label: string, e: ReactPointerEvent) {
    e.preventDefault()
    const pointerId = e.pointerId
    setDrag({ bucket, label, pointerId, startY: e.clientY, y: e.clientY })

    const prevBodyOverflow = document.body.style.overflow
    const prevBodyTouchAction = document.body.style.touchAction
    document.body.style.overflow = 'hidden'
    document.body.style.touchAction = 'none'

    // PortfoliosPage's own pull-to-refresh is wired via native onTouchStart/onTouchMove on an
    // ancestor div this modal renders inside of — those are a separate event stream from
    // Pointer Events, so preventDefault()/body-overflow above never stopped them from bubbling
    // up and moving the page underneath. Block them at the window in the capture phase (fires
    // before the gesture reaches that ancestor) for the duration of the drag.
    function blockTouch(ev: TouchEvent) {
      ev.stopPropagation()
      ev.preventDefault()
    }
    window.addEventListener('touchstart', blockTouch, { capture: true, passive: false })
    window.addEventListener('touchmove', blockTouch, { capture: true, passive: false })

    function onMove(ev: PointerEvent) {
      if (ev.pointerId !== pointerId) return
      ev.preventDefault()
      setDrag(prev => (prev ? { ...prev, y: ev.clientY } : prev))
      reorderForPointer(bucket, label, ev.clientY)
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
          <span className="text-[13px] font-extrabold text-white tracking-[-0.2px]">Manage Buckets</span>
          <button onClick={onClose} className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[12px] leading-none" style={{ background: 'rgba(255,255,255,0.12)' }}>✕</button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 px-2.5 py-2.5" style={{ background: '#f8fafc' }}>

          {/* Count + New bucket */}
          <div className="flex items-center gap-1.5">
            <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest shrink-0" style={{ color: '#0b3b3a' }}>
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M1.5 2h9L7 6.5V10l-2-1V6.5L1.5 2z" /></svg>
              {buckets.length}
            </p>
            <input
              value={newBucketName}
              onChange={e => setNewBucketName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleNewBucket() }}
              placeholder="New bucket…"
              className="flex-1 min-w-0 px-2 py-1 text-[10.5px] border border-emerald-100 rounded-md bg-white focus:outline-none focus:border-teal-400"
            />
            <button
              onClick={handleNewBucket}
              className="px-2 py-1 text-[10.5px] font-semibold text-white rounded-md active:opacity-80 whitespace-nowrap shrink-0"
              style={{ background: 'linear-gradient(135deg, #0b3b3a 0%, #0d9488 100%)' }}
            >
              + Create
            </button>
          </div>

          {buckets.map(b => (
            <div key={b.name} className="bg-white rounded-lg border border-emerald-100 shadow-sm overflow-hidden">
              <div className="flex items-center gap-1 px-2 py-1.5" style={{ background: 'rgba(13,148,136,0.06)' }}>
                <span className="text-[11px] font-bold text-[#0b3b3a] truncate flex-1 min-w-0">{b.name}</span>
                <input
                  value={newLabelByBucket[b.name] ?? ''}
                  onChange={e => setNewLabelByBucket(prev => ({ ...prev, [b.name]: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddLabel(b.name) }}
                  placeholder="+label"
                  className="w-[58px] shrink-0 px-1.5 py-1 text-[10px] border border-emerald-100 rounded-md bg-white focus:outline-none focus:border-teal-400"
                />
                <button
                  onClick={() => handleAddLabel(b.name)}
                  className="w-5 h-5 shrink-0 flex items-center justify-center rounded-md text-white active:opacity-80"
                  style={{ background: 'linear-gradient(135deg, #0b3b3a 0%, #0d9488 100%)' }}
                  title="Add label"
                >
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                </button>
                {b.name !== 'Asset Class' && (
                  <>
                    <button
                      role="switch"
                      aria-checked={b.showToggle}
                      onClick={() => { setBucketToggle(b.name, !b.showToggle); refreshBuckets() }}
                      className="relative w-7 h-4 rounded-full transition-colors duration-200 shrink-0"
                      style={{ background: b.showToggle ? 'linear-gradient(135deg, #0b3b3a 0%, #0d9488 100%)' : '#e2e8f0' }}
                      title="Show as filter toggle"
                    >
                      <span className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform duration-200 ${b.showToggle ? 'translate-x-3' : 'translate-x-0'}`} />
                    </button>
                    <button
                      onClick={() => handleDeleteBucket(b.name)}
                      disabled={isPending}
                      className="w-5 h-5 shrink-0 flex items-center justify-center rounded-full text-red-400 active:bg-red-50 active:text-red-600 disabled:opacity-50"
                      title="Delete bucket"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" /></svg>
                    </button>
                  </>
                )}
              </div>

              {getAllLabelsInBucket(data, b.name).length > 0 && (
                <div className="px-2 py-1.5 space-y-1">
                  {getAllLabelsInBucket(data, b.name).map(l => {
                    const isDragging = drag?.bucket === b.name && drag.label === l
                    return (
                    <div
                      key={l}
                      ref={el => { if (el) rowRefs.current.set(`${b.name}:${l}`, el); else rowRefs.current.delete(`${b.name}:${l}`) }}
                      className={`flex items-center gap-1.5 bg-emerald-50/60 border rounded-lg pl-1 pr-1.5 py-0.5 ${isDragging ? 'border-emerald-400 shadow-lg relative z-50' : 'border-emerald-100'}`}
                      style={isDragging ? { transform: `translateY(${drag.y - drag.startY}px)`, touchAction: 'none' } : undefined}
                    >
                      <button
                        onPointerDown={e => handleDragPointerDown(b.name, l, e)}
                        className="text-emerald-300 active:text-emerald-600 leading-none shrink-0 w-6 h-6 flex items-center justify-center cursor-grab active:cursor-grabbing"
                        style={{ touchAction: 'none' }}
                        title="Drag to reorder"
                      >
                        <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor"><circle cx="2" cy="2" r="1.3" /><circle cx="8" cy="2" r="1.3" /><circle cx="2" cy="7" r="1.3" /><circle cx="8" cy="7" r="1.3" /><circle cx="2" cy="12" r="1.3" /><circle cx="8" cy="12" r="1.3" /></svg>
                      </button>
                      <span className="flex-1 text-[11px] font-medium text-slate-700">{l}</span>
                      <button
                        onClick={() => handleDeleteLabel(b.name, l)}
                        disabled={isPending}
                        className="text-red-300 active:text-red-600 leading-none disabled:opacity-50 shrink-0 w-5 h-5 flex items-center justify-center"
                        title="Delete label"
                      >
                        ×
                      </button>
                    </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
