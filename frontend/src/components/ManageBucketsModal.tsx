import { useState } from 'react'
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

  function handleMoveLabel(bucket: string, label: string, dir: 'up' | 'down') {
    const current = getAllLabelsInBucket(data, bucket)
    const i = current.indexOf(label)
    const j = dir === 'up' ? i - 1 : i + 1
    if (i === -1 || j < 0 || j >= current.length) return
    const next = [...current]
    ;[next[i], next[j]] = [next[j], next[i]]
    setLabelOrder(bucket, next)
    refreshBuckets()
  }

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[200]" onClick={onClose} />
      <div
        className="fixed inset-x-3 z-[201] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-emerald-100"
        style={{ top: '5dvh', maxHeight: '90dvh', maxWidth: 460, margin: '0 auto' }}
      >
        <div className="bg-gradient-to-r from-emerald-600 to-teal-500 px-4 py-3 flex items-center justify-between shrink-0">
          <span className="text-sm font-semibold text-white tracking-tight">Manage Buckets</span>
          <button onClick={onClose} className="text-emerald-200 active:text-white text-xl leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto bg-white px-4 py-4 space-y-3">

          {/* Buckets + Labels */}
          <p className="text-[10px] text-emerald-700 font-semibold uppercase tracking-widest">Buckets</p>
          {buckets.map(b => (
            <div key={b.name} className="bg-emerald-50 rounded-xl border border-emerald-100 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-slate-800">{b.name}</span>
                <div className="flex items-center gap-2 shrink-0">
                  {b.name !== 'Asset Class' && (
                    <>
                      <button
                        role="switch"
                        aria-checked={b.showToggle}
                        onClick={() => { setBucketToggle(b.name, !b.showToggle); refreshBuckets() }}
                        className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${b.showToggle ? 'bg-teal-500' : 'bg-slate-300'}`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${b.showToggle ? 'translate-x-4' : 'translate-x-0'}`} />
                      </button>
                      <button
                        onClick={() => handleDeleteBucket(b.name)}
                        disabled={isPending}
                        className="text-[11px] text-red-500 active:text-red-700 disabled:opacity-50"
                        title="Delete bucket"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                {getAllLabelsInBucket(data, b.name).map((l, i, arr) => (
                  <div key={l} className="flex items-center gap-1.5 bg-white border border-emerald-200 rounded-lg px-2 py-1">
                    <div className="flex flex-col -my-0.5 shrink-0">
                      <button
                        onClick={() => handleMoveLabel(b.name, l, 'up')}
                        disabled={i === 0}
                        className="text-slate-400 active:text-emerald-600 disabled:opacity-25 leading-none text-[9px]"
                        title="Move up"
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => handleMoveLabel(b.name, l, 'down')}
                        disabled={i === arr.length - 1}
                        className="text-slate-400 active:text-emerald-600 disabled:opacity-25 leading-none text-[9px]"
                        title="Move down"
                      >
                        ▼
                      </button>
                    </div>
                    <span className="flex-1 text-[11px] text-slate-700">{l}</span>
                    <button
                      onClick={() => handleDeleteLabel(b.name, l)}
                      disabled={isPending}
                      className="text-red-400 active:text-red-600 leading-none disabled:opacity-50 shrink-0 px-1"
                      title="Delete label"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-1.5">
                <input
                  value={newLabelByBucket[b.name] ?? ''}
                  onChange={e => setNewLabelByBucket(prev => ({ ...prev, [b.name]: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddLabel(b.name) }}
                  placeholder="+ Add label"
                  className="flex-1 px-2 py-1.5 text-[11px] border border-emerald-200 rounded-lg bg-white focus:outline-none focus:border-teal-400"
                />
                <button onClick={() => handleAddLabel(b.name)} className="px-3 py-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-100 rounded-lg active:bg-emerald-200">Add</button>
              </div>
            </div>
          ))}

          <div className="flex gap-1.5">
            <input
              value={newBucketName}
              onChange={e => setNewBucketName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleNewBucket() }}
              placeholder="+ New bucket (e.g. Risk, Region)"
              className="flex-1 px-3 py-2 text-sm border border-emerald-200 rounded-lg bg-white focus:outline-none focus:border-teal-400"
            />
            <button onClick={handleNewBucket} className="px-3 py-2 text-[12px] font-semibold text-white bg-emerald-500 rounded-lg active:bg-emerald-600">Create</button>
          </div>
        </div>
      </div>
    </>
  )
}
