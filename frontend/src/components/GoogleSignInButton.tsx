import { useEffect, useRef, useState } from 'react'
import { loginWithGoogle } from '../utils/auth'

export default function GoogleSignInButton({
  onSuccess,
  onError,
}: {
  onSuccess: (email: string) => void
  onError?: (message: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

  useEffect(() => {
    if (!clientId || !ref.current) return
    let cancelled = false

    const init = () => {
      if (cancelled || !window.google || !ref.current) return
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response) => {
          setBusy(true)
          try {
            const email = await loginWithGoogle(response.credential)
            onSuccess(email)
          } catch (e) {
            onError?.(e instanceof Error ? e.message : 'Sign-in failed')
          } finally {
            setBusy(false)
          }
        },
      })
      window.google.accounts.id.renderButton(ref.current, { theme: 'outline', size: 'large', width: 280 })
    }

    if (window.google) {
      init()
      return
    }
    // GSI script (loaded in index.html) may not have finished loading yet on a cold page load.
    const check = setInterval(() => {
      if (window.google) { clearInterval(check); init() }
    }, 100)
    return () => { cancelled = true; clearInterval(check) }
  }, [clientId, onSuccess, onError])

  if (!clientId) {
    return <p className="text-[12px] text-slate-400">Sign-in not configured yet.</p>
  }

  return (
    <div>
      <div ref={ref} />
      {busy && <p className="text-[11px] text-slate-400 mt-1">Signing in…</p>}
    </div>
  )
}
