import { useEffect, useState } from 'react'
import type { PortfolioData } from '../api/types'
import { useSetTags } from '../hooks/useSetTags'
import { getBuckets, addLabel, getAllLabelsInBucket, getLabel } from '../utils/buckets'

interface Props {
  open:    boolean
  onClose: () => void
  data:    PortfolioData
  preFilledPortfolio?: string
  preFilledBucket?: string
  preFilledLabel?:  string
}

interface BrokerConfig {
  portfolio:   string
  allHoldings: boolean
  selected:    Set<string>
}

// Auto-fill Bucket/Label from this portfolio's existing Asset Class assignment (if any),
// so reopening the modal from a specific broker's Holdings page doesn't start blank.
function defaultAssetClassLabel(data: PortfolioData, portfolio?: string): string {
  if (!portfolio) return ''
  const h = data.holdings.find(h => h.portfolio === portfolio)
  if (!h) return ''
  const lbl = getLabel(h, 'Asset Class')
  return lbl !== 'Unassigned' ? lbl : ''
}

export function PullHoldingsModal({ open, onClose, data, preFilledPortfolio, preFilledBucket, preFilledLabel }: Props) {
  const { mutate, isPending } = useSetTags()
  const buckets = getBuckets()
  // Opened from a Bucket/Label page (e.g. the "Indian Stocks" pseudo-portfolio) — the target
  // is unambiguous from where the user navigated here, so lock it instead of leaving it editable.
  const bucketLabelLocked = !!(preFilledBucket && preFilledLabel)

  const [bucket, setBucket] = useState('')
  const [label,  setLabel]  = useState('')
  const [brokerConfigs, setBrokerConfigs] = useState<BrokerConfig[]>([])
  const [brokerPickerOpen, setBrokerPickerOpen] = useState(false)
  const [error, setError] = useState('')
  const [done,  setDone]  = useState(false)

  // Re-derive whenever the modal opens or the page's context changes — this modal stays
  // mounted across page navigations, so a stale Bucket/Label/broker from a previous page
  // would otherwise stick around instead of following wherever the user currently is.
  useEffect(() => {
    if (!open) return
    // A Bucket/Label route (e.g. the "Stocks" Asset Class tile) takes priority over deriving
    // from the broker, since it's the more direct signal of what the user wants to tag.
    const defaultLabel  = preFilledLabel || defaultAssetClassLabel(data, preFilledPortfolio)
    const defaultBucket = preFilledBucket || (defaultLabel ? 'Asset Class' : '')
    setBucket(defaultBucket)
    setLabel(defaultLabel)
    setBrokerConfigs(preFilledPortfolio ? [{ portfolio: preFilledPortfolio, allHoldings: true, selected: new Set() }] : [])
    setBrokerPickerOpen(false)
    setError('')
  }, [open, preFilledPortfolio, preFilledBucket, preFilledLabel]) // eslint-disable-line react-hooks/exhaustive-deps

  const availableBrokers = data.all_portfolios.filter(p => !brokerConfigs.some(c => c.portfolio === p))

  function handleAddBroker(p: string) {
    if (!p || brokerConfigs.some(c => c.portfolio === p)) return
    setBrokerConfigs(prev => [...prev, { portfolio: p, allHoldings: true, selected: new Set() }])
  }

  function handleRemoveBroker(p: string) {
    setBrokerConfigs(prev => prev.filter(c => c.portfolio !== p))
  }

  function toggleBrokerAllHoldings(p: string) {
    setBrokerConfigs(prev => prev.map(c => c.portfolio === p ? { ...c, allHoldings: !c.allHoldings } : c))
  }

  function toggleBrokerHolding(p: string, symbol: string) {
    setBrokerConfigs(prev => prev.map(c => {
      if (c.portfolio !== p) return c
      const next = new Set(c.selected)
      if (next.has(symbol)) next.delete(symbol); else next.add(symbol)
      return { ...c, selected: next }
    }))
  }

  function handleApply() {
    const b = bucket.trim(), l = label.trim()
    if (!b || !l) { setError('Pick a Bucket and a Label.'); return }
    if (brokerConfigs.length === 0) { setError('Add at least one broker.'); return }
    for (const c of brokerConfigs) {
      if (!c.allHoldings && c.selected.size === 0) { setError(`Select at least one holding for "${c.portfolio}", or turn on All Holdings.`); return }
    }
    setError('')

    const assignments = brokerConfigs.flatMap(c =>
      c.allHoldings
        ? [{ portfolio: c.portfolio, bucket: b, label: l }]
        : [...c.selected].map(symbol => ({ portfolio: c.portfolio, symbol, bucket: b, label: l })),
    )

    mutate(assignments, {
      onSuccess: () => {
        addLabel(b, l)
        setDone(true)
        setBrokerConfigs(prev => prev.map(c => ({ ...c, selected: new Set() })))
        setTimeout(() => setDone(false), 2000)
      },
      onError: (e: Error) => setError(e.message || 'Failed to apply.'),
    })
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
          <span className="text-sm font-semibold text-white tracking-tight">Copy Holdings</span>
          <button onClick={onClose} className="text-emerald-200 active:text-white text-xl leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto bg-white px-4 py-4 space-y-3">

          {/* Bucket + Label */}
          <p className="text-[10px] text-emerald-700 font-semibold uppercase tracking-widest">Bucket &amp; Label</p>
          <div className="flex gap-2">
            <select
              value={bucket}
              disabled={bucketLabelLocked}
              onChange={e => { setBucket(e.target.value); setLabel('') }}
              className="flex-1 px-2 py-2 text-[12px] border border-emerald-200 rounded-lg bg-white disabled:bg-slate-100 disabled:text-slate-500"
            >
              <option value="">Bucket…</option>
              {buckets.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
            </select>
            <input
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="Label (existing or new)"
              disabled={!bucket || bucketLabelLocked}
              className="flex-1 px-2 py-2 text-[12px] border border-emerald-200 rounded-lg bg-white disabled:opacity-50"
            />
          </div>
          {bucket && !bucketLabelLocked && (
            <div className="flex flex-wrap gap-1">
              {getAllLabelsInBucket(data, bucket).map(l => (
                <button key={l} onClick={() => setLabel(l)} className={`text-[10px] rounded-full px-2 py-0.5 border ${label === l ? 'bg-teal-500 text-white border-teal-500' : 'bg-white border-emerald-200 text-slate-600'}`}>{l}</button>
              ))}
            </div>
          )}

          {/* Brokers — each gets its own All Holdings toggle + (if off) holdings checklist */}
          <p className="text-[10px] text-emerald-700 font-semibold uppercase tracking-widest pt-2">Brokers</p>
          {brokerConfigs.map(c => {
            const holdingsInPortfolio = data.holdings.filter(h => h.portfolio === c.portfolio)
            return (
              <div key={c.portfolio} className="bg-emerald-50 rounded-xl border border-emerald-100 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-semibold text-slate-700">{c.portfolio}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-slate-500">All Holdings</span>
                    <button
                      role="switch"
                      aria-checked={c.allHoldings}
                      onClick={() => toggleBrokerAllHoldings(c.portfolio)}
                      className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${c.allHoldings ? 'bg-teal-500' : 'bg-slate-300'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${c.allHoldings ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                    <button onClick={() => handleRemoveBroker(c.portfolio)} className="text-red-400 active:text-red-600 leading-none" title="Remove broker">×</button>
                  </div>
                </div>
                {!c.allHoldings && (
                  <div className="max-h-40 overflow-y-auto border border-emerald-200 rounded-lg bg-white divide-y divide-emerald-50">
                    {holdingsInPortfolio.length === 0 && <p className="px-2.5 py-2 text-[11px] text-slate-400">No holdings in this broker.</p>}
                    {holdingsInPortfolio.map(h => (
                      <label key={h.symbol} className="flex items-center gap-2 px-2.5 py-1.5 text-[11px] cursor-pointer active:bg-emerald-50">
                        <input type="checkbox" checked={c.selected.has(h.symbol)} onChange={() => toggleBrokerHolding(c.portfolio, h.symbol)} className="shrink-0" />
                        <span className="font-semibold text-slate-700 shrink-0">{h.symbol}</span>
                        <span className="text-slate-400 truncate">{h.company ?? h.name ?? ''}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {availableBrokers.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setBrokerPickerOpen(v => !v)}
                className="w-full px-2 py-2 text-[12px] border border-emerald-200 rounded-lg bg-white text-slate-500 flex items-center justify-between"
              >
                <span>+ Add a broker…</span>
                <span className="text-emerald-400 text-[10px]">{brokerPickerOpen ? '▲' : '▼'}</span>
              </button>
              {brokerPickerOpen && (
                <>
                  <div className="fixed inset-0 z-[205]" onClick={() => setBrokerPickerOpen(false)} />
                  <div className="absolute left-0 right-0 mt-1 z-[206] bg-white border border-emerald-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {availableBrokers.map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => { handleAddBroker(p); setBrokerPickerOpen(false) }}
                        className="w-full text-left px-2.5 py-2 text-[12px] text-slate-700 active:bg-emerald-50"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {error && <p className="text-[11px] text-red-600">{error}</p>}
          {done  && <p className="text-[11px] text-emerald-700">✓ Applied</p>}

          <button
            onClick={handleApply}
            disabled={isPending}
            className="w-full py-2 rounded-lg text-[12px] font-semibold text-white transition-opacity disabled:opacity-50"
            style={{ background: 'linear-gradient(to right, #059669, #0d9488)' }}
          >
            {isPending ? 'Applying…' : 'Apply'}
          </button>
        </div>
      </div>
    </>
  )
}
