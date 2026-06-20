import { useEffect, useState } from 'react'
import type { PortfolioData, Transaction } from '../api/types'
import { useDeleteHolding } from '../hooks/useDeleteHolding'
import { useSetTags } from '../hooks/useSetTags'
import { getBuckets, getAllLabelsInBucket, filterByLabel, getLabel } from '../utils/buckets'

// Display-only row for the picker — lighter than the full `Holding` type since closed
// positions (sold out entirely) don't have one: they only exist in `data.transactions`.
type Row = { portfolio: string; symbol: string; company: string | null; name: string | null }

interface Props {
  open:    boolean
  onClose: () => void
  data:    PortfolioData
  preFilledPortfolio?: string
  preFilledBucket?:    string
  preFilledLabel?:     string
}

type Scope =
  | { kind: 'portfolio'; portfolio: string }
  | { kind: 'label'; bucket: string; label: string }
  | null

function parseScopeKey(key: string): Scope {
  if (!key) return null
  if (key.startsWith('portfolio:')) return { kind: 'portfolio', portfolio: key.slice('portfolio:'.length) }
  if (key.startsWith('label:')) {
    const rest = key.slice('label:'.length)
    const i = rest.indexOf(':')
    return { kind: 'label', bucket: rest.slice(0, i), label: rest.slice(i + 1) }
  }
  return null
}

function scopeLabel(scope: Scope): string {
  if (!scope) return ''
  return scope.kind === 'portfolio' ? scope.portfolio : `${scope.bucket}: ${scope.label}`
}

function holdingKey(portfolio: string, symbol: string): string {
  return `${portfolio}:${symbol}`
}

// No stable row ID exists in the CSV schema, so a transaction is identified by the exact
// combination of fields that also gets sent to the backend for an exact-match delete.
function txnKey(t: Transaction): string {
  return `${t.portfolio}:${t.symbol}:${t.date.slice(0, 10)}:${t.type}:${t.quantity}:${t.price}`
}

const DATE_FMT = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })
const TYPE_COLOR: Record<string, string> = { BUY: '#059669', SELL: '#dc2626', DIVIDEND: '#2563eb' }

function initialScopeKey(preFilledPortfolio?: string, preFilledBucket?: string, preFilledLabel?: string): string {
  if (preFilledPortfolio) return `portfolio:${preFilledPortfolio}`
  if (preFilledBucket && preFilledLabel) return `label:${preFilledBucket}:${preFilledLabel}`
  return ''
}

export function DeleteHoldingModal({ open, onClose, data, preFilledPortfolio, preFilledBucket, preFilledLabel }: Props) {
  const { mutate, isPending: isDeleting } = useDeleteHolding()
  const { mutate: setTags, isPending: isUntagging } = useSetTags()
  const isPending = isDeleting || isUntagging
  const buckets = getBuckets()
  const scopeLocked = !!(preFilledPortfolio || (preFilledBucket && preFilledLabel))

  const [scopeKey, setScopeKey] = useState(initialScopeKey(preFilledPortfolio, preFilledBucket, preFilledLabel))
  const [allHoldings, setAllHoldings] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [selectedTxns, setSelectedTxns] = useState<Set<string>>(new Set())
  const [selectedHoldings, setSelectedHoldings] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')
  const [done,  setDone]  = useState(false)

  // Re-derive whenever the modal opens or the page's portfolio/bucket-label changes — this
  // modal stays mounted across page navigations, so a stale scope from a previous page would
  // otherwise stick around instead of following wherever the user currently is.
  useEffect(() => {
    if (!open) return
    setScopeKey(initialScopeKey(preFilledPortfolio, preFilledBucket, preFilledLabel))
    setAllHoldings(false)
    setExpanded(new Set())
    setSelectedTxns(new Set())
    setSelectedHoldings(new Set())
    setError('')
  }, [open, preFilledPortfolio, preFilledBucket, preFilledLabel])

  const scope = parseScopeKey(scopeKey)
  const openRows: Row[] = (!scope ? [] : scope.kind === 'portfolio'
    ? data.holdings.filter(h => h.portfolio === scope.portfolio)
    : filterByLabel(data.holdings, scope.bucket, scope.label)
  ).map(h => ({ portfolio: h.portfolio, symbol: h.symbol, company: h.company, name: h.name }))

  // A symbol can be fully closed (zero open quantity) under this scope but still have
  // historical transactions/realized gain — it won't appear in data.holdings (open positions
  // only), so without this it's impossible to find and delete it here even though the
  // Holdings page still shows a card for it (to keep realized gain visible).
  const openKeys = new Set(openRows.map(r => holdingKey(r.portfolio, r.symbol)))
  const closedRows: Row[] = []
  if (scope) {
    const seen = new Set<string>()
    for (const t of data.transactions) {
      const inScope = scope.kind === 'portfolio' ? t.portfolio === scope.portfolio : getLabel(t, scope.bucket) === scope.label
      if (!inScope) continue
      const key = holdingKey(t.portfolio, t.symbol)
      if (openKeys.has(key) || seen.has(key)) continue
      seen.add(key)
      closedRows.push({ portfolio: t.portfolio, symbol: t.symbol, company: null, name: t.name })
    }
  }
  const holdingsInScope: Row[] = [...openRows, ...closedRows]

  function txnsFor(h: Row): Transaction[] {
    return data.transactions.filter(t => t.portfolio === h.portfolio && t.symbol === h.symbol)
  }

  function toggleExpand(key: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  // Checking a holding selects every one of its transactions; unchecking clears them all.
  function toggleHolding(h: Row) {
    const keys = txnsFor(h).map(txnKey)
    const allSelected = keys.length > 0 && keys.every(k => selectedTxns.has(k))
    setSelectedTxns(prev => {
      const next = new Set(prev)
      for (const k of keys) { if (allSelected) next.delete(k); else next.add(k) }
      return next
    })
  }

  // Label scope removes the holding from the pseudo-portfolio (untags it) rather than
  // deleting any transactions, so selection is whole-holding only — no per-transaction picks.
  function toggleSelectedHolding(h: Row) {
    const k = holdingKey(h.portfolio, h.symbol)
    setSelectedHoldings(prev => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k); else next.add(k)
      return next
    })
  }

  function toggleTxn(key: string) {
    setSelectedTxns(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  function handleApply() {
    if (!scope) { setError('Pick a portfolio.'); return }
    setError('')

    // Label/Bucket scope is a pseudo-portfolio view — "deleting" here must only clear the
    // Label tag, never touch the real transactions, which stay intact in their actual broker
    // portfolio(s) (the same symbol can be tagged into this Label from more than one broker).
    if (scope.kind === 'label') {
      const targets = allHoldings ? holdingsInScope : holdingsInScope.filter(h => selectedHoldings.has(holdingKey(h.portfolio, h.symbol)))
      if (targets.length === 0) { setError('Select at least one holding, or turn on All Holdings.'); return }
      const confirmMsg = `This will remove ${targets.length} holding(s) from "${scopeLabel(scope)}". They stay untouched in their original broker portfolio(s) — only the Label tag is cleared. Continue?`
      if (!window.confirm(confirmMsg)) return

      const assignments = targets.map(h => ({ portfolio: h.portfolio, symbol: h.symbol, bucket: scope.bucket, label: '' }))
      setTags(assignments, {
        onSuccess: () => { setDone(true); setSelectedHoldings(new Set()); setTimeout(() => { setDone(false); onClose() }, 1200) },
        onError: (e: Error) => setError(e.message || 'Failed to remove.'),
      })
      return
    }

    if (allHoldings) {
      const count = holdingsInScope.length
      if (count === 0) { setError('No holdings here.'); return }
      const confirmMsg = `This will permanently delete all ${count} holding(s) and their full transaction history from "${scopeLabel(scope)}". This cannot be undone. Continue?`
      if (!window.confirm(confirmMsg)) return

      mutate([{ portfolio: scope.portfolio }], {
        onSuccess: () => { setDone(true); setTimeout(() => { setDone(false); onClose() }, 1200) },
        onError: (e: Error) => setError(e.message || 'Failed to delete.'),
      })
      return
    }

    if (selectedTxns.size === 0) { setError('Select at least one holding or transaction, or turn on All Holdings.'); return }

    const targets = holdingsInScope.flatMap(txnsFor).filter(t => selectedTxns.has(txnKey(t)))
    const holdingCount = new Set(targets.map(t => holdingKey(t.portfolio, t.symbol))).size
    const confirmMsg = `This will permanently delete ${targets.length} transaction(s) across ${holdingCount} holding(s) from "${scopeLabel(scope)}". This cannot be undone. Continue?`
    if (!window.confirm(confirmMsg)) return

    const deletions = targets.map(t => ({
      portfolio: t.portfolio, symbol: t.symbol,
      date: t.date.slice(0, 10), type: t.type, quantity: t.quantity, price: t.price,
    }))

    mutate(deletions, {
      onSuccess: () => {
        setDone(true)
        setSelectedTxns(new Set())
        setTimeout(() => { setDone(false); onClose() }, 1200)
      },
      onError: (e: Error) => setError(e.message || 'Failed to delete.'),
    })
  }

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[200]" onClick={onClose} />
      <div
        className="fixed inset-x-3 z-[201] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-rose-100"
        style={{ top: '5dvh', maxHeight: '90dvh', maxWidth: 460, margin: '0 auto' }}
      >
        <div className="bg-gradient-to-r from-rose-400 to-red-300 px-4 py-3 flex items-center justify-between shrink-0">
          <span className="text-sm font-semibold text-white tracking-tight">Delete Holding</span>
          <button onClick={onClose} className="text-rose-100 active:text-white text-xl leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto bg-white px-4 py-4 space-y-3">

          {/* Portfolio */}
          <p className="text-[10px] text-rose-600 font-semibold uppercase tracking-widest">Portfolio</p>
          <select
            value={scopeKey}
            disabled={scopeLocked}
            onChange={e => { setScopeKey(e.target.value); setExpanded(new Set()); setSelectedTxns(new Set()); setSelectedHoldings(new Set()) }}
            className="w-full px-2 py-2 text-[12px] border border-rose-100 rounded-lg bg-white disabled:bg-slate-100 disabled:text-slate-500"
          >
            <option value="">Portfolio…</option>
            <optgroup label="Portfolios">
              {data.all_portfolios.map(p => <option key={`portfolio:${p}`} value={`portfolio:${p}`}>{p}</option>)}
            </optgroup>
            {buckets.map(b => {
              const labels = getAllLabelsInBucket(data, b.name)
              return labels.length > 0 ? (
                <optgroup key={b.name} label={b.name}>
                  {labels.map(l => <option key={`label:${b.name}:${l}`} value={`label:${b.name}:${l}`}>{l}</option>)}
                </optgroup>
              ) : null
            })}
          </select>

          {/* Holdings */}
          {scope && (
            <div className="bg-rose-50/60 rounded-xl border border-rose-100 p-3 space-y-2">
              <label className="flex items-center justify-between gap-2 cursor-pointer">
                <span className="text-[12px] font-medium text-slate-700">All Holdings</span>
                <button
                  role="switch"
                  aria-checked={allHoldings}
                  onClick={() => setAllHoldings(v => !v)}
                  className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${allHoldings ? 'bg-rose-400' : 'bg-slate-300'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${allHoldings ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </label>
              {!allHoldings && (
                <div className="max-h-56 overflow-y-auto border border-rose-100 rounded-lg bg-white divide-y divide-rose-50">
                  {holdingsInScope.length === 0 && <p className="px-2.5 py-2 text-[11px] text-slate-400">No holdings here.</p>}
                  {holdingsInScope.map(h => {
                    const hKey = holdingKey(h.portfolio, h.symbol)
                    const txns = txnsFor(h)
                    const keys = txns.map(txnKey)
                    const isLabelScope = scope.kind === 'label'
                    const checked = isLabelScope
                      ? selectedHoldings.has(hKey)
                      : keys.length > 0 && keys.every(k => selectedTxns.has(k))
                    const isExpanded = expanded.has(hKey)
                    return (
                      <div key={hKey}>
                        <div className="flex items-center gap-2 px-2.5 py-1.5 text-[11px]">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => (isLabelScope ? toggleSelectedHolding(h) : toggleHolding(h))}
                            className="shrink-0"
                          />
                          <span className="font-semibold text-slate-700 shrink-0">{h.symbol}</span>
                          {isLabelScope && <span className="text-slate-400 shrink-0">{h.portfolio}</span>}
                          <span className="text-slate-400 truncate flex-1">{h.company ?? h.name ?? ''}</span>
                          <button
                            onClick={() => toggleExpand(hKey)}
                            className="text-rose-500 text-[10px] font-semibold shrink-0 active:text-rose-700"
                          >
                            {isExpanded ? 'Hide txn' : 'Show txn'}
                          </button>
                        </div>
                        {isExpanded && (
                          <div className="pl-7 pb-1.5 space-y-0.5">
                            {txns.length === 0 && <p className="text-[10px] text-slate-400">No transactions.</p>}
                            {txns.map(t => {
                              const tKey = txnKey(t)
                              return (
                                <label key={tKey} className="flex items-center gap-2 pr-2.5 py-1 text-[10px] cursor-pointer active:bg-rose-50">
                                  {!isLabelScope && (
                                    <input type="checkbox" checked={selectedTxns.has(tKey)} onChange={() => toggleTxn(tKey)} className="shrink-0" />
                                  )}
                                  <span className="text-slate-500 shrink-0 w-14">{DATE_FMT(t.date)}</span>
                                  <span className="font-semibold shrink-0 w-14" style={{ color: TYPE_COLOR[t.type] ?? '#64748b' }}>{t.type}</span>
                                  <span className="text-slate-400 truncate">{t.quantity} sh @ {t.price}</span>
                                </label>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {error && <p className="text-[11px] text-rose-600">{error}</p>}
          {done  && <p className="text-[11px] text-emerald-700">✓ Deleted</p>}

          <button
            onClick={handleApply}
            disabled={isPending}
            className="w-full py-2 rounded-lg text-[12px] font-semibold text-white transition-opacity disabled:opacity-50"
            style={{ background: 'linear-gradient(to right, #fb7185, #f87171)' }}
          >
            {isPending ? (scope?.kind === 'label' ? 'Removing…' : 'Deleting…') : 'Delete'}
          </button>
        </div>
      </div>
    </>
  )
}
