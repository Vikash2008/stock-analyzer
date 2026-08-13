// Real per-person identity (2026-08-13), replacing the anonymous per-browser
// client_id UUID this file's sibling `clientId.ts` used to provide. Session
// token is a JWT issued by backend/routers/auth.py after verifying a Google
// ID token server-side; stored via idbStore.ts so it survives app restarts
// the same way every other persisted cache in this app does.

import { idbGet, idbSet, idbDelete } from './idbStore'

const TOKEN_KEY = 'auth:token'
const EMAIL_KEY = 'auth:email'

export function getAuthToken(): string | undefined {
  return idbGet<string>(TOKEN_KEY)
}

export function getUserEmail(): string | undefined {
  return idbGet<string>(EMAIL_KEY)
}

export function isSignedIn(): boolean {
  return !!getAuthToken()
}

export function setSession(token: string, email: string): void {
  idbSet(TOKEN_KEY, token)
  idbSet(EMAIL_KEY, email)
}

export function clearSession(): void {
  idbDelete(TOKEN_KEY)
  idbDelete(EMAIL_KEY)
}

// Thrown by api/* helpers when an action needs a signed-in identity and
// there's no token (or the backend rejected it as revoked/expired) — callers
// catch this specifically to show a sign-in prompt instead of a raw error.
export class AuthRequiredError extends Error {
  constructor() {
    super('sign-in required')
    this.name = 'AuthRequiredError'
  }
}

// Exchanges a Google ID token (from Google Identity Services) for our own
// session JWT. Access control is entirely email-based (2026-08-13) — the
// backend only accepts this if the email was already pre-approved via the
// Admin panel (or is a static admin, for bootstrapping the very first
// account) — see backend/routers/auth.py.
export async function loginWithGoogle(googleIdToken: string): Promise<string> {
  const BASE = (import.meta.env.VITE_API_URL ?? '') + '/api'
  const res = await fetch(`${BASE}/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id_token: googleIdToken }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    // FastAPI's HTTPException responses are {"detail": "message"} — surface that
    // message cleanly (e.g. "contact the admin for access") instead of dumping
    // the raw status code + JSON body at the user.
    let message = text
    try { message = JSON.parse(text).detail ?? text } catch { /* not JSON — use raw text as-is */ }
    throw new Error(message || `Sign-in failed (${res.status})`)
  }
  const { token, email } = await res.json() as { token: string; email: string }
  setSession(token, email)
  return email
}
