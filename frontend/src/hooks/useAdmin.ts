import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addAdminUser,
  deleteAdminUser,
  fetchAdminUsers,
  restoreAdminUser,
  revokeAdminUser,
} from '../api/admin'
import { isSignedIn } from '../utils/auth'

// A 403 here just means "not an admin" — no retry, and the UI treats
// isSuccess as the signal to show the admin panel at all (see
// PortfoliosPage.tsx's Settings popover), so a non-admin never even sees it.
export function useAdminUsers() {
  const query = useQuery({
    queryKey: ['admin-users'],
    queryFn: fetchAdminUsers,
    enabled: isSignedIn(),
    retry: false,
    staleTime: 30_000,
  })
  return { ...query, users: query.data?.users ?? [], isAdmin: query.isSuccess }
}

export function useAddAdminUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (email: string) => addAdminUser(email),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  })
}

export function useRevokeAdminUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (email: string) => revokeAdminUser(email),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  })
}

export function useRestoreAdminUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (email: string) => restoreAdminUser(email),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  })
}

export function useDeleteAdminUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (email: string) => deleteAdminUser(email),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  })
}
