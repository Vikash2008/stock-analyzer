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
        className="fixed z-[201] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-emerald-100 w-[320px] max-w-[calc(100vw-24px)]"
        style={{ top: '3dvh', maxHeight: '80dvh', right: 'max(0.75rem, calc((100vw - 576px) / 2 + 0.75rem))' }}
      >
        <div className="px-4 py-2 flex items-center justify-between shrink-0" style={{ background: 'linear-gradient(135deg, #0b3b3a 0%, #0d9488 100%)' }}>
          <span className="text-[13.5px] font-extrabold text-white tracking-[-0.2px]">Manage Portfolio</span>
          <button onClick={onClose} className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[13px] leading-none" style={{ background: 'rgba(255,255,255,0.12)' }}>✕</button>
        </div>

        <div className="flex-1 overflow-y-auto bg-white px-2.5 py-2 space-y-1.5">
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
                className={`w-full text-left rounded-lg px-2.5 py-1.5 transition-colors bg-emerald-50/60 border border-emerald-100 ${
                  disabled ? 'opacity-60 cursor-not-allowed' : 'active:bg-emerald-100'
                }`}
              >
                <p className={`text-[12px] font-semibold ${disabled ? 'text-slate-400' : 'text-[#0b3b3a]'}`}>{o.label}</p>
                <p className={`text-[10px] mt-0.5 ${disabled ? 'text-slate-400' : 'text-slate-500'}`}>{o.desc}</p>
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}
