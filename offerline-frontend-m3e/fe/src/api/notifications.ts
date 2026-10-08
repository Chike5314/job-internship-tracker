import { http } from './http'
import type { Notification } from './types'

export function listNotifications(
  unreadOnly = false,
): Promise<{ unreadCount: number; count: number; notifications: Notification[] }> {
  return http.get('/notifications', { query: unreadOnly ? { unread: 'true' } : {} })
}

export function markNotificationRead(notificationId: string): Promise<{ notificationId: string; read: boolean }> {
  return http.patch(`/notifications/${notificationId}/read`)
}

export function markAllNotificationsRead(): Promise<{ marked: number; unreadCount: number }> {
  return http.patch('/notifications/read-all')
}
