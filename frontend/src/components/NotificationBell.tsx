import { useState } from 'react'
import { useAlertNotifications } from '../hooks/useAlerts'
import { NotificationsPanel } from './NotificationsPanel'

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const { unreadCount } = useAlertNotifications()

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative w-[30px] h-[30px] rounded-full flex items-center justify-center active:opacity-70 text-[#0b3b3a]"
        aria-label="Alerts"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
          <path fillRule="evenodd" d="M5.25 9a6.75 6.75 0 0 1 13.5 0v.75c0 2.123.8 4.057 2.118 5.52a.75.75 0 0 1-.297 1.206c-1.544.57-3.16.99-4.831 1.243a3.75 3.75 0 1 1-7.48 0 24.585 24.585 0 0 1-4.831-1.244.75.75 0 0 1-.298-1.205A8.217 8.217 0 0 0 5.25 9.75V9Zm4.502 8.9a2.25 2.25 0 1 0 4.496 0 25.057 25.057 0 0 1-4.496 0Z" clipRule="evenodd" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-[3px] rounded-full bg-rose-500 text-white text-[9px] font-bold leading-[15px] text-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      <NotificationsPanel isOpen={open} onClose={() => setOpen(false)} />
    </>
  )
}
