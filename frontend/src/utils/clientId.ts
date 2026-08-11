// Stable per-browser identity for the alerts feature. This app has no login
// system, so a random UUID generated once and kept in localStorage is what
// scopes one person's alert rules/notifications/push subscriptions apart
// from anyone else sharing this deployment. If a real login system is added
// later, swap this for the authenticated user's ID — backend/alerts_store.py
// only ever treats it as an opaque string key, so nothing else has to change.
const KEY = 'alerts:client_id'

export function getClientId(): string {
  let id = localStorage.getItem(KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(KEY, id)
  }
  return id
}
