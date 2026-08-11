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

export function ManageAlertsModal({ open, onClose, yfSymbol, symbol, name, portfolio, currentPrice }: Props) {
  const { rules } = useAlertRules(symbol)
  const createMutation = useCreateAlertRule()
  const updateMutation = useUpdateAlertRule()
  const deleteMutation = useDeleteAlertRule()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [type, setType] = useState<AlertType>('pct_move')
  const [direction, setDirection] = useState<AlertDirection>('below')
  const [threshold, setThreshold] = useState('')
  const [error, setError] = useState('')

  const cur = CUR(yfSymbol)

  function resetForm() {
    setEditingId(null)
    setType('pct_move')
    setDirection('below')
    setThreshold('')
    setError('')
  }

  function startEdit(rule: AlertRule) {
    setEditingId(rule.id)
    setType(rule.type)
    setDirection(rule.direction)
    setThreshold(String(rule.threshold_value))
    setError('')
  }

  function handleSubmit() {
    const value = parseFloat(threshold)
    if (!Number.isFinite(value) || value <= 0) {
      setError('Enter a threshold greater than 0.')
      return
    }
    if (type === 'pct_move' && (currentPrice == null || currentPrice <= 0)) {
      setError('Live price unavailable — try again once the price loads.')
      return
    }
    setError('')

    if (editingId) {
      const patch: Record<string, unknown> = { type, direction, threshold_value: value }
      if (type === 'pct_move') patch.reference_value = currentPrice
      updateMutation.mutate({ id: editingId, patch }, { onSuccess: resetForm })
      return
    }

    createMutation.mutate(
      {
        yf_symbol: yfSymbol,
        symbol,
        name,
        portfolio,
        type,
        direction,
        reference_value: type === 'pct_move' ? currentPrice ?? 0 : 0,
        threshold_value: value,
      },
      { onSuccess: resetForm },
    )
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
              <div className="space-y-2">
                {rules.map((rule) => (
                  <div key={rule.id} className="bg-emerald-50 rounded-xl border border-emerald-100 p-3 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-[11.5px] leading-snug ${rule.enabled ? 'text-slate-700' : 'text-slate-400 line-through'}`}>
                        {ruleSummary(rule, cur)}
                      </p>
                      <span className={`shrink-0 text-[9px] font-bold uppercase tracking-wide rounded-full px-1.5 py-0.5 ${rule.triggered ? 'bg-amber-100 text-amber-700' : rule.enabled ? 'bg-teal-100 text-teal-700' : 'bg-slate-200 text-slate-500'}`}>
                        {rule.triggered ? 'Triggered' : rule.enabled ? 'Active' : 'Disabled'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 pt-0.5 -ml-2">
                      <button onClick={() => startEdit(rule)} className="px-2 py-1.5 text-[10.5px] font-semibold text-teal-700 active:opacity-70">Edit</button>
                      {rule.triggered ? (
                        <button
                          onClick={() => updateMutation.mutate({ id: rule.id, patch: { rearm: true, reference_value: rule.type === 'pct_move' ? currentPrice ?? undefined : undefined } })}
                          className="px-2 py-1.5 text-[10.5px] font-semibold text-teal-700 active:opacity-70"
                        >Re-arm</button>
                      ) : (
                        <button
                          onClick={() => updateMutation.mutate({ id: rule.id, patch: { enabled: !rule.enabled } })}
                          className="px-2 py-1.5 text-[10.5px] font-semibold text-teal-700 active:opacity-70"
                        >{rule.enabled ? 'Disable' : 'Enable'}</button>
                      )}
                      <button onClick={() => deleteMutation.mutate(rule.id)} className="px-2 py-1.5 text-[10.5px] font-semibold text-red-500 active:opacity-70">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          <p className="text-[10px] text-emerald-700 font-semibold uppercase tracking-widest pt-1">
            {editingId ? 'Edit Alert' : 'New Alert'}
          </p>

          <div className="flex gap-2">
            {(['pct_move', 'abs_price'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`flex-1 text-[11px] font-semibold py-1.5 rounded-lg border ${type === t ? 'bg-teal-500 text-white border-teal-500' : 'bg-white border-emerald-200 text-slate-600'}`}
              >
                {t === 'pct_move' ? '% Move' : 'Price Level'}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            {(['below', 'above'] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDirection(d)}
                className={`flex-1 text-[11px] font-semibold py-1.5 rounded-lg border ${direction === d ? 'bg-teal-500 text-white border-teal-500' : 'bg-white border-emerald-200 text-slate-600'}`}
              >
                {d === 'below' ? '↓ Below' : '↑ Above'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[12px] text-slate-500 shrink-0">
              {type === 'pct_move' ? 'Threshold %' : `Price (${cur})`}
            </span>
            <input
              type="number"
              inputMode="decimal"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              placeholder={type === 'pct_move' ? 'e.g. 8' : 'e.g. 1850'}
              className="flex-1 px-2 py-2 text-[12px] border border-emerald-200 rounded-lg bg-white"
            />
          </div>

          {type === 'pct_move' && (
            <p className="text-[10px] text-slate-400">
              Reference price: {currentPrice != null ? `${cur}${currentPrice.toFixed(2)} (current)` : 'unavailable'}
            </p>
          )}

          {error && <p className="text-[11px] text-red-500">{error}</p>}

          <div className="flex gap-2 pt-1">
            {editingId && (
              <button onClick={resetForm} className="flex-1 py-2 rounded-lg text-[12px] font-semibold text-slate-500 border border-slate-200">
                Cancel
              </button>
            )}
            <button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
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
