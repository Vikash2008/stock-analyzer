import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createAlertRule,
  deleteAlertRule,
  dismissAlertNotification,
  fetchAlertNotifications,
  fetchAlertRules,
  fetchAlertSettings,
  readAlertNotification,
  updateAlertRule,
  updateAlertSettings,
  type AlertDirection,
  type AlertType,
  type DeliveryMode,
} from '../api/alerts'
import { enablePushNotifications, disablePushNotifications } from '../utils/pushSubscribe'
import { REFRESH_MS } from './useHistory'

export function useAlertRules(symbol?: string) {
  const query = useQuery({
    queryKey: ['alert-rules'],
    queryFn: fetchAlertRules,
    staleTime: REFRESH_MS,
    refetchInterval: REFRESH_MS,
    refetchIntervalInBackground: false,
  })
  const rules = query.data?.rules ?? []
  return { ...query, rules: symbol ? rules.filter((r) => r.symbol === symbol) : rules }
}

export function useAlertNotifications() {
  const query = useQuery({
    queryKey: ['alert-notifications'],
    queryFn: fetchAlertNotifications,
    staleTime: REFRESH_MS,
    refetchInterval: REFRESH_MS,
    refetchIntervalInBackground: false,
  })
  const notifications = query.data?.notifications ?? []
  return { ...query, notifications, unreadCount: notifications.filter((n) => !n.read).length }
}

export function useAlertSettings() {
  return useQuery({
    queryKey: ['alert-settings'],
    queryFn: fetchAlertSettings,
    staleTime: Infinity,
  })
}

export function useCreateAlertRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      yf_symbol: string
      symbol: string
      name?: string
      portfolio?: string
      type: AlertType
      direction: AlertDirection
      reference_value?: number
      threshold_value: number
    }) => createAlertRule(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alert-rules'] }),
  })
}

export function useUpdateAlertRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string
      patch: Partial<{
        type: AlertType
        direction: AlertDirection
        reference_value: number
        threshold_value: number
        enabled: boolean
        rearm: boolean
      }>
    }) => updateAlertRule(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alert-rules'] }),
  })
}

export function useDeleteAlertRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteAlertRule(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alert-rules'] }),
  })
}

export function useReadAlertNotification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => readAlertNotification(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alert-notifications'] }),
  })
}

export function useDismissAlertNotification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => dismissAlertNotification(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alert-notifications'] }),
  })
}

export function useSetDeliveryMode() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (mode: DeliveryMode) => {
      if (mode === 'in_app_push') {
        await enablePushNotifications()
      } else {
        await disablePushNotifications()
      }
      return updateAlertSettings(mode)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alert-settings'] }),
  })
}
