import { useState } from 'react'
import type { AlertDirection, AlertRule, AlertType } from '../api/alerts'
import { useAlertRules, useCreateAlertRule, useDeleteAlertRule, useUpdateAlertRule } from '../hooks/useAlerts'

interface Props {
  open: boolean
  onClose: () => void
  yfSymbol: string
  symbol: string
  name?: string
  portfolio: string
  currentPrice?: number | null
}

const CUR = (yf: string) => (yf.endsWith('.NS') || yf.endsWith('.BO') ? '₹' : '$')

function ruleSummary(rule: AlertRule, cur: string): string {
  if (rule.type === 'pct_move') {
    const verb = rule.direction === 'above' ? 'rises' : 'falls'
    return `Alert when price ${verb} ${rule.threshold_value}% from ${cur}${rule.reference_value.toFixed(2)}`
  }
  const verb = rule.direction === 'above' ? 'crosses above' : 'crosses below'
  return `Alert when price ${verb} ${cur}${rule.threshold_value.toFixed(2)}`
}

interface DirToggleProps {
  direction: AlertDirection
  onToggle: () => void
}

function DirToggle({ direction, onToggle }: DirToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={direction === 'below' ? 'Below' : 'Above'}
      className="shrink-0 w-7 h-7 rounded-lg border border-emerald-200 bg-white flex items-center justify-center text-[13px] font-bold text-teal-700 active:opacity-70"
    >
      {direction === 'below' ? '↓' : '↑'}
    </button>
  )
}

export function ManageAlertsModal({ open, onClose, yfSymbol, symbol, name, portfolio, currentPrice }: Props) {
  const { rules } = useAlertRules(symbol)
  const createMutation = useCreateAlertRule()
  const updateMutation = useUpdateAlertRule()
  const deleteMutation = useDeleteAlertRule()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingType, setEditingType] = useState<AlertType | null>(null)

  const [pctThreshold, setPctThreshold] = useState('')
  const [pctDirection, setPctDirection] = useState<AlertDirection>('below')
  const [priceThreshold, setPriceThreshold] = useState('')
  const [priceDirection, setPriceDirection] = useState<AlertDirection>('below')

  const [error, setError] = useState('')
  const submitting = createMutation.isPending || updateMutation.isPending

  const cur = CUR(yfSymbol)

  function resetForm() {
    setEditingId(null)
    setEditingType(null)
    setPctThreshold('')
    setPctDirection('below')
    setPriceThreshold('')
    setPriceDirection('below')
    setError('')
  }

  function startEdit(rule: AlertRule) {
    setEditingId(rule.id)
    setEditingType(rule.type)
    if (rule.type === 'pct_move') {
      setPctThreshold(String(rule.threshold_value))
      setPctDirection(rule.direction)
      setPriceThreshold('')
    } else {
      setPriceThreshold(String(rule.threshold_value))
      setPriceDirection(rule.direction)
      setPctThreshold('')
    }
    setError('')
  }

  async function handleSubmit() {
    setError('')

    if (editingId && editingType) {
      const raw = editingType === 'pct_move' ? pctThreshold : priceThreshold
      const value = parseFloat(raw)
      if (!Number.isFinite(value) || value <= 0) {
        setError('Enter a threshold greater than 0.')
        return
      }
      if (editingType === 'pct_move' && (currentPrice == null || currentPrice <= 0)) {
        setError('Live price unavailable — try again once the price loads.')
        return
      }
      const patch: Record<string, unknown> = {
        direction: editingType === 'pct_move' ? pctDirection : priceDirection,
        threshold_value: value,
      }
      if (editingType === 'pct_move') patch.reference_value = currentPrice
      updateMutation.mutate({ id: editingId, patch }, { onSuccess: resetForm })
      return
    }

    const submissions: { type: AlertType; direction: AlertDirection; threshold_value: number; reference_value: number }[] = []

    if (pctThreshold.trim()) {
      const value = parseFloat(pctThreshold)
      if (!Number.isFinite(value) || value <= 0) { setError('Enter a % threshold greater than 0.'); return }
      if (currentPrice == null || currentPrice <= 0) { setError('Live price unavailable — try again once the price loads.'); return }
      submissions.push({ type: 'pct_move', direction: pctDirection, threshold_value: value, reference_value: currentPrice })
    }
    if (priceThreshold.trim()) {
      const value = parseFloat(priceThreshold)
      if (!Number.isFinite(value) || value <= 0) { setError('Enter a price level greater than 0.'); return }
      submissions.push({ type: 'abs_price', direction: priceDirection, threshold_value: value, reference_value: 0 })
    }
    if (submissions.length === 0) {
      setError('Enter at least one threshold — % Move, Price Level, or both.')
      return
    }

    try {
      for (const s of submissions) {
        await createMutation.mutateAsync({ yf_symbol: yfSymbol, symbol, name, portfolio, ...s })
      }
      resetForm()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add alert.')
    }
  }

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[200]" onClick={onClose} />
      <div
        className="fixed inset-x-3 z-[201] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-emerald-100"
        style={{ top: '8dvh', maxHeight: '84dvh', maxWidth: 460, margin: '0 auto' }}
      >
        <div className="px-4 py-2 flex items-center justify-between shrink-0" style={{ background: 'linear-gradient(135deg, #0b3b3a 0%, #0d9488 100%)' }}>
          <span className="text-[13.5px] font-extrabold text-white tracking-[-0.2px]">🔔 Alerts · {symbol}</span>
          <button onClick={onClose} className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[13px] leading-none" style={{ background: 'rgba(255,255,255,0.12)' }}>✕</button>
        </div>

        <div className="flex-1 overflow-y-auto bg-white px-4 py-4 space-y-3">

          {rules.length > 0 && (
            <>
              <p className="text-[10px] text-emerald-700 font-semibold uppercase tracking-widest">Existing Alerts</p>
              <div className="space-y-1.5">
                {rules.map((rule) => (
                  <div key={rule.id} className="bg-emerald-50 rounded-xl border border-emerald-100 p-2 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-[11px] leading-snug ${rule.enabled ? 'text-slate-700' : 'text-slate-400 line-through'}`}>
                        {ruleSummary(rule, cur)}
                      </p>
                      <span className={`shrink-0 text-[9px] font-bold uppercase tracking-wide rounded-full px-1.5 py-0.5 ${rule.triggered ? 'bg-amber-100 text-amber-700' : rule.enabled ? 'bg-teal-100 text-teal-700' : 'bg-slate-200 text-slate-500'}`}>
                        {rule.triggered ? 'Triggered' : rule.enabled ? 'Active' : 'Disabled'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 -ml-2">
                      <button onClick={() => startEdit(rule)} className="px-2 py-1 text-[10.5px] font-semibold text-teal-700 active:opacity-70">Edit</button>
                      {rule.triggered ? (
                        <button
                          onClick={() => updateMutation.mutate({ id: rule.id, patch: { rearm: true, reference_value: rule.type === 'pct_move' ? currentPrice ?? undefined : undefined } })}
                          className="px-2 py-1 text-[10.5px] font-semibold text-teal-700 active:opacity-70"
                        >Re-arm</button>
                      ) : (
                        <button
                          onClick={() => updateMutation.mutate({ id: rule.id, patch: { enabled: !rule.enabled } })}
                          className="px-2 py-1 text-[10.5px] font-semibold text-teal-700 active:opacity-70"
                        >{rule.enabled ? 'Disable' : 'Enable'}</button>
                      )}
                      <button onClick={() => deleteMutation.mutate(rule.id)} className="px-2 py-1 text-[10.5px] font-semibold text-red-500 active:opacity-70">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          <p className="text-[10px] text-emerald-700 font-semibold uppercase tracking-widest pt-1">
            {editingId ? 'Edit Alert' : 'New Alert'}
          </p>
          {!editingId && (
            <p className="text-[10px] text-slate-400 -mt-2">Set either or both — an alert fires the moment any condition is met.</p>
          )}

          <div className="space-y-2">
            {(!editingId || editingType === 'pct_move') && (
              <div className="bg-emerald-50/60 border border-emerald-100 rounded-lg px-2.5 py-[7px] flex items-center justify-between gap-2">
                <span className="text-[12px] font-bold text-[#0b3b3a] shrink-0">% Move</span>
                <div className="flex items-center gap-1.5">
                  <DirToggle direction={pctDirection} onToggle={() => setPctDirection((d) => (d === 'below' ? 'above' : 'below'))} />
                  <input
                    type="number"
                    inputMode="decimal"
                    value={pctThreshold}
                    onChange={(e) => setPctThreshold(e.target.value)}
                    placeholder="e.g. 8"
                    className="w-[64px] px-2 py-1.5 text-[12px] border border-emerald-200 rounded-lg bg-white text-right"
                  />
                  <span className="text-[11px] text-slate-400 shrink-0">%</span>
                </div>
              </div>
            )}

            {(!editingId || editingType === 'abs_price') && (
              <div className="bg-emerald-50/60 border border-emerald-100 rounded-lg px-2.5 py-[7px] flex items-center justify-between gap-2">
                <span className="text-[12px] font-bold text-[#0b3b3a] shrink-0">Price Level</span>
                <div className="flex items-center gap-1.5">
                  <DirToggle direction={priceDirection} onToggle={() => setPriceDirection((d) => (d === 'below' ? 'above' : 'below'))} />
                  <span className="text-[11px] text-slate-400 shrink-0">{cur}</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={priceThreshold}
                    onChange={(e) => setPriceThreshold(e.target.value)}
                    placeholder="e.g. 1850"
                    className="w-[76px] px-2 py-1.5 text-[12px] border border-emerald-200 rounded-lg bg-white text-right"
                  />
                </div>
              </div>
            )}
          </div>

          <p className="text-[10px] text-slate-400">
            Current price: {currentPrice != null ? `${cur}${currentPrice.toFixed(2)}` : 'unavailable'}
          </p>

          {error && <p className="text-[11px] text-red-500">{error}</p>}

          <div className="flex gap-2 pt-1">
            {editingId && (
              <button onClick={resetForm} className="flex-1 py-2 rounded-lg text-[12px] font-semibold text-slate-500 border border-slate-200">
                Cancel
              </button>
            )}
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 py-2 rounded-lg text-[12px] font-semibold text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #0b3b3a 0%, #0d9488 100%)' }}
            >
              {editingId ? 'Save Changes' : 'Add Alert'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
