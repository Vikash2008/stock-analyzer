import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { AlertNotification, AlertRule } from '../api/alerts'
import { useAlertNotifications, useAlertRules, useDismissAlertNotification, useReadAlertNotification } from '../hooks/useAlerts'
import { CUR, ruleSummary } from './ManageAlertsModal'

function fmtTime(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const mon = d.toLocaleString('en-US', { month: 'short' })
  return `${hh}:${mm} · ${dd} ${mon}`
}

interface RowProps {
  notification: AlertNotification
  onOpen: (n: AlertNotification) => void
  onDismiss: (id: string) => void
}

function NotificationRow({ notification, onOpen, onDismiss }: RowProps) {
  return (
    <div
      onClick={() => onOpen(notification)}
      className={`flex items-start gap-2 px-3 py-2.5 rounded-lg cursor-pointer active:opacity-80 ${
        notification.read
          ? 'bg-white border border-slate-100'
          : 'bg-teal-50 border-l-4 border-teal-500'
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className={`text-[12.5px] leading-snug ${notification.read ? 'font-medium text-slate-600' : 'font-bold text-slate-800'}`}>
          {notification.message}
        </p>
        <p className="text-[10px] text-slate-400 mt-0.5">{fmtTime(notification.triggered_at)}</p>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onDismiss(notification.id) }}
        className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-slate-400 active:text-slate-600 text-[13px] leading-none"
        aria-label="Dismiss alert"
      >
        ✕
      </button>
    </div>
  )
}

interface RuleRowProps {
  rule: AlertRule
  onOpen: (rule: AlertRule) => void
}

function RuleRow({ rule, onOpen }: RuleRowProps) {
  return (
    <button
      onClick={() => onOpen(rule)}
      className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-white border border-slate-100 active:opacity-70 text-left"
    >
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-bold text-slate-800 truncate">{rule.name || rule.symbol}</p>
        <p className="text-[10.5px] text-slate-500 truncate mt-0.5">{ruleSummary(rule, CUR(rule.yf_symbol))}</p>
      </div>
      <span className={`shrink-0 text-[9px] font-bold uppercase tracking-wide rounded-full px-1.5 py-0.5 ${
        rule.triggered ? 'bg-amber-100 text-amber-700' : rule.enabled ? 'bg-teal-100 text-teal-700' : 'bg-slate-200 text-slate-500'
      }`}>
        {rule.triggered ? 'Triggered' : rule.enabled ? 'Active' : 'Disabled'}
      </span>
    </button>
  )
}

interface Props {
  isOpen: boolean
  onClose: () => void
}

export function NotificationsPanel({ isOpen, onClose }: Props) {
  const navigate = useNavigate()
  const { notifications } = useAlertNotifications()
  const { rules } = useAlertRules()
  const readMutation = useReadAlertNotification()
  const dismissMutation = useDismissAlertNotification()
  const [showAllRules, setShowAllRules] = useState(false)

  const handleOpen = (n: AlertNotification) => {
    if (!n.read) readMutation.mutate(n.id)
    onClose()
    navigate(`/transactions/${encodeURIComponent(n.portfolio)}/${encodeURIComponent(n.symbol)}`)
  }

  const handleOpenRule = (rule: AlertRule) => {
    setShowAllRules(false)
    onClose()
    // Deep-links straight into that holding's alert modal (via TransactionsPage's
    // openAlerts nav-state flag) so the user can reconfigure it right away.
    navigate(`/transactions/${encodeURIComponent(rule.portfolio)}/${encodeURIComponent(rule.symbol)}`, { state: { openAlerts: true } })
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-end justify-center pointer-events-none">
        <div
          className={`w-full max-w-xl pointer-events-auto bg-white rounded-t-2xl flex flex-col transition-transform duration-300 ease-out ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}
          style={{ height: '75dvh' }}
        >
          <div className="flex justify-center pt-2.5 pb-1 shrink-0">
            <div className="w-10 h-1 bg-slate-200 rounded-full" />
          </div>

          <div className="flex items-center justify-between px-4 pb-3 shrink-0 border-b border-slate-100">
            {showAllRules ? (
              <button onClick={() => setShowAllRules(false)} className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-800 active:opacity-70 -ml-1 py-2 pr-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                All Set Alerts
              </button>
            ) : (
              <span className="text-[13px] font-semibold text-slate-800">🔔 Alerts</span>
            )}
            <button onClick={onClose} className="text-slate-400 active:text-slate-600 text-[18px] leading-none p-2 -mr-1">
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
            {showAllRules ? (
              rules.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center gap-2 pb-8">
                  <span className="text-3xl">🔔</span>
                  <span className="text-[12px] text-slate-500 leading-snug">No alerts configured yet.</span>
                </div>
              ) : (
                rules.map((rule) => <RuleRow key={rule.id} rule={rule} onOpen={handleOpenRule} />)
              )
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center gap-2 pb-8">
                <span className="text-3xl">🔔</span>
                <span className="text-[12px] text-slate-500 leading-snug">No alerts yet.</span>
              </div>
            ) : (
              notifications.map((n) => (
                <NotificationRow
                  key={n.id}
                  notification={n}
                  onOpen={handleOpen}
                  onDismiss={(id) => dismissMutation.mutate(id)}
                />
              ))
            )}
          </div>

          {!showAllRules && (
            <div className="shrink-0 border-t border-slate-100 p-3">
              <button
                onClick={() => setShowAllRules(true)}
                className="w-full py-2.5 rounded-lg text-[12px] font-semibold text-teal-700 bg-teal-50 border border-teal-100 active:opacity-70"
              >
                Show all set alerts
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
