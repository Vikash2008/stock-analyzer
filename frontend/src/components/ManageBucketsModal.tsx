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
        style={{ top: '5dvh', maxHeight: '90dvh', maxWidth: 460, margin: '0 auto' }}
      >
        <div className="px-4 py-2 flex items-center justify-between shrink-0" style={{ background: 'linear-gradient(135deg, #0b3b3a 0%, #0d9488 100%)' }}>
          <span className="text-[13.5px] font-extrabold text-white tracking-[-0.2px]">Manage Buckets</span>
          <button onClick={onClose} className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[13px] leading-none" style={{ background: 'rgba(255,255,255,0.12)' }}>✕</button>
        </div>

        <div className="flex-1 overflow-y-auto bg-white px-3 py-2.5 space-y-2">

          {/* Buckets + Labels */}
          <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#0b3b3a' }}>Buckets</p>
          {buckets.map(b => (
            <div key={b.name} className="bg-emerald-50/60 rounded-lg border border-emerald-100 p-2 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-bold text-[#0b3b3a]">{b.name}</span>
                <div className="flex items-center gap-2 shrink-0">
                  {b.name !== 'Asset Class' && (
                    <>
                      <button
                        role="switch"
                        aria-checked={b.showToggle}
                        onClick={() => { setBucketToggle(b.name, !b.showToggle); refreshBuckets() }}
                        className="relative w-8 h-4 rounded-full transition-colors duration-200"
                        style={{ background: b.showToggle ? 'linear-gradient(135deg, #0b3b3a 0%, #0d9488 100%)' : '#e2e8f0' }}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform duration-200 ${b.showToggle ? 'translate-x-4' : 'translate-x-0'}`} />
                      </button>
                      <button
                        onClick={() => handleDeleteBucket(b.name)}
                        disabled={isPending}
                        className="text-[10px] text-red-500 active:text-red-700 disabled:opacity-50"
                        title="Delete bucket"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="space-y-0.5">
                {getAllLabelsInBucket(data, b.name).map(l => {
                  const isDragging = drag?.bucket === b.name && drag.label === l
                  return (
                  <div
                    key={l}
                    ref={el => { if (el) rowRefs.current.set(`${b.name}:${l}`, el); else rowRefs.current.delete(`${b.name}:${l}`) }}
                    className={`flex items-center gap-1 bg-white border rounded-lg px-1.5 py-0.5 ${isDragging ? 'border-emerald-400 shadow-lg relative z-50' : 'border-emerald-200'}`}
                    style={isDragging ? { transform: `translateY(${drag.y - drag.startY}px)`, touchAction: 'none' } : undefined}
                  >
                    <button
                      onPointerDown={e => handleDragPointerDown(b.name, l, e)}
                      className="text-slate-400 active:text-emerald-600 leading-none shrink-0 w-7 h-7 flex items-center justify-center text-[12px] cursor-grab active:cursor-grabbing"
                      style={{ touchAction: 'none' }}
                      title="Drag to reorder"
                    >
                      ≡
                    </button>
                    <span className="flex-1 text-[11px] text-slate-700">{l}</span>
                    <button
                      onClick={() => handleDeleteLabel(b.name, l)}
                      disabled={isPending}
                      className="text-red-400 active:text-red-600 leading-none disabled:opacity-50 shrink-0 w-6 h-6 flex items-center justify-center"
                      title="Delete label"
                    >
                      ×
                    </button>
                  </div>
                  )
                })}
              </div>
              <div className="flex gap-1">
                <input
                  value={newLabelByBucket[b.name] ?? ''}
                  onChange={e => setNewLabelByBucket(prev => ({ ...prev, [b.name]: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddLabel(b.name) }}
                  placeholder="+ Add label"
                  className="flex-1 px-2 py-1 text-[11px] border border-emerald-200 rounded-lg bg-white focus:outline-none focus:border-teal-400"
                />
                <button onClick={() => handleAddLabel(b.name)} className="px-2.5 py-1 text-[11px] font-semibold text-white rounded-lg active:opacity-80" style={{ background: 'linear-gradient(135deg, #0b3b3a 0%, #0d9488 100%)' }}>Add</button>
              </div>
            </div>
          ))}

          <div className="flex gap-1">
            <input
              value={newBucketName}
              onChange={e => setNewBucketName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleNewBucket() }}
              placeholder="+ New bucket (e.g. Risk, Region)"
              className="flex-1 px-2 py-1 text-[11px] border border-emerald-200 rounded-lg bg-white focus:outline-none focus:border-teal-400"
            />
            <button onClick={handleNewBucket} className="px-2.5 py-1 text-[11px] font-semibold text-white rounded-lg active:opacity-80" style={{ background: 'linear-gradient(135deg, #0b3b3a 0%, #0d9488 100%)' }}>Create</button>
          </div>
        </div>
      </div>
    </>
  )
}
