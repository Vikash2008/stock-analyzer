interface Props {
  open:     boolean
  onClose:  () => void
  onSelect: (action: 'add' | 'delete' | 'copy') => void
  disableAdd?:  boolean   // true on a Bucket/Label page — no new transactions from a pseudo-portfolio
  disableCopy?: boolean   // true on a broker's own Holdings page — no tag changes from there
}

const OPTIONS: { action: 'add' | 'delete' | 'copy'; label: string; desc: string }[] = [
  { action: 'add',    label: 'Add Holding',    desc: 'Record a new BUY/SELL transaction' },
  { action: 'delete', label: 'Delete Holding', desc: 'Remove a holding and its transaction history' },
  { action: 'copy',   label: 'Copy Holdings',  desc: 'Apply a Bucket/Label to holdings from a broker' },
]

export function ManagePortfolioModal({ open, onClose, onSelect, disableAdd = false, disableCopy = false }: Props) {
  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[200]" onClick={onClose} />
      <div
        className="fixed inset-x-3 z-[201] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-emerald-100"
        style={{ top: '5dvh', maxHeight: '90dvh', maxWidth: 460, margin: '0 auto' }}
      >
        <div className="bg-gradient-to-r from-emerald-600 to-teal-500 px-4 py-3 flex items-center justify-between shrink-0">
          <span className="text-sm font-semibold text-white tracking-tight">Manage Portfolio</span>
          <button onClick={onClose} className="text-emerald-200 active:text-white text-xl leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto bg-white px-4 py-4 space-y-2">
          {OPTIONS.map(o => {
            const disabled =
              (o.action === 'add'  && disableAdd) ||
              (o.action === 'copy' && disableCopy)
            return (
              <button
                key={o.action}
                onClick={() => { if (!disabled) onSelect(o.action) }}
                disabled={disabled}
                title={disabled ? 'Not available here' : undefined}
                className={`w-full text-left rounded-xl px-3 py-2.5 transition-colors bg-emerald-50 border border-emerald-100 ${
                  disabled ? 'opacity-60 cursor-not-allowed' : 'active:bg-emerald-100'
                }`}
              >
                <p className={`text-[13px] font-semibold ${disabled ? 'text-slate-400' : 'text-slate-800'}`}>{o.label}</p>
                <p className={`text-[11px] mt-0.5 ${disabled ? 'text-slate-400' : 'text-slate-500'}`}>{o.desc}</p>
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}
