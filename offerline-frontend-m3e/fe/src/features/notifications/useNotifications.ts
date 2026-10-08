import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listNotifications, markAllNotificationsRead, markNotificationRead } from '@/api/notifications'
import { queryKeys } from '@/api/queryKeys'
import { useAuth } from '@/auth/AuthProvider'

// Notifications are written by an asynchronous DynamoDB stream consumer
// with no push mechanism the frontend can subscribe to, so polling is the
// available option.
export function useNotifications(unreadOnly = false) {
  const { status } = useAuth()
  return useQuery({
    queryKey: queryKeys.notifications.list(unreadOnly),
    queryFn: () => listNotifications(unreadOnly),
    staleTime: 30_000,
    refetchInterval: 60_000,
    enabled: status === 'signedIn',
  })
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (notificationId: string) => markNotificationRead(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}
