import { getClientId } from '../utils/clientId'

const BASE = (import.meta.env.VITE_API_URL ?? '') + '/api'

export type AlertType = 'pct_move' | 'abs_price'
export type AlertDirection = 'above' | 'below'
export type DeliveryMode = 'in_app' | 'in_app_push'

export interface AlertRule {
  id: string
  yf_symbol: string
  symbol: string
  name: string
  portfolio: string
  type: AlertType
  direction: AlertDirection
  reference_value: number
  threshold_value: number
  enabled: boolean
  triggered: boolean
  created_at: number
}

export interface AlertNotification {
  id: string
  rule_id: string
  yf_symbol: string
  symbol: string
  name: string
  portfolio: string
  message: string
  triggered_at: number
  read: boolean
}

export interface AlertSettings {
  delivery_mode: DeliveryMode
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const sep = path.includes('?') ? '&' : '?'
  const url = `${BASE}${path}${sep}client_id=${encodeURIComponent(getClientId())}`
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

export function fetchAlertRules(): Promise<{ rules: AlertRule[] }> {
  return req('/alerts/rules')
}

export function createAlertRule(body: {
  yf_symbol: string
  symbol: string
  name?: string
  portfolio?: string
  type: AlertType
  direction: AlertDirection
  reference_value?: number
  threshold_value: number
}): Promise<{ rule: AlertRule }> {
  return req('/alerts/rules', { method: 'POST', body: JSON.stringify(body) })
}

export function updateAlertRule(
  id: string,
  patch: Partial<{
    type: AlertType
    direction: AlertDirection
    reference_value: number
    threshold_value: number
    enabled: boolean
    rearm: boolean
  }>,
): Promise<{ rule: AlertRule }> {
  return req(`/alerts/rules/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
}

export function deleteAlertRule(id: string): Promise<{ ok: true }> {
  return req(`/alerts/rules/${id}`, { method: 'DELETE' })
}

export function fetchAlertNotifications(): Promise<{ notifications: AlertNotification[] }> {
  return req('/alerts/notifications')
}

export function readAlertNotification(id: string): Promise<{ notification: AlertNotification }> {
  return req(`/alerts/notifications/${id}/read`, { method: 'POST' })
}

export function dismissAlertNotification(id: string): Promise<{ ok: true }> {
  return req(`/alerts/notifications/${id}/dismiss`, { method: 'POST' })
}

export function fetchAlertSettings(): Promise<AlertSettings> {
  return req('/alerts/settings')
}

export function updateAlertSettings(delivery_mode: DeliveryMode): Promise<AlertSettings> {
  return req('/alerts/settings', { method: 'POST', body: JSON.stringify({ delivery_mode }) })
}

export function fetchVapidPublicKey(): Promise<{ key: string }> {
  return req('/alerts/vapid-public-key')
}

export function subscribePush(subscription: PushSubscriptionJSON): Promise<{ subscription: unknown }> {
  return req('/alerts/subscribe', { method: 'POST', body: JSON.stringify(subscription) })
}

export function unsubscribePush(endpoint: string): Promise<{ ok: true }> {
  return req('/alerts/unsubscribe', { method: 'POST', body: JSON.stringify({ endpoint }) })
}
