import { getAuthToken, AuthRequiredError } from '../utils/auth'

const BASE = (import.meta.env.VITE_API_URL ?? '') + '/api'

export interface AdminUser {
  email: string
  google_sub: string
  joined_at: number
  last_login?: number
  revoked: boolean
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken()
  if (!token) throw new AuthRequiredError()
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  })
  if (res.status === 401) throw new AuthRequiredError()
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

export function fetchAdminUsers(): Promise<{ users: AdminUser[] }> {
  return req('/admin/users')
}

export function addAdminUser(email: string): Promise<{ user: AdminUser }> {
  return req('/admin/users', { method: 'POST', body: JSON.stringify({ email }) })
}

export function revokeAdminUser(email: string): Promise<{ user: AdminUser }> {
  return req(`/admin/users/${encodeURIComponent(email)}/revoke`, { method: 'POST' })
}

export function restoreAdminUser(email: string): Promise<{ user: AdminUser }> {
  return req(`/admin/users/${encodeURIComponent(email)}/restore`, { method: 'POST' })
}

export function deleteAdminUser(email: string): Promise<{ ok: true }> {
  return req(`/admin/users/${encodeURIComponent(email)}`, { method: 'DELETE' })
}
