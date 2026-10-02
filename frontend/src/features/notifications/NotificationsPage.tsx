import { useState } from 'react'
import { PageHeader } from '@/ui/PageHeader'
import { Button } from '@/ui/Button'
import { Checkbox } from '@/ui/Checkbox'
import { EmptyState } from '@/ui/EmptyState'
import { Skeleton } from '@/ui/Skeleton'
import { NotificationRow } from './NotificationRow'
import { useMarkAllNotificationsRead, useNotifications } from './useNotifications'

export function NotificationsPage() {
  const [unreadOnly, setUnreadOnly] = useState(false)
  const { data, isLoading } = useNotifications(unreadOnly)
  const markAllRead = useMarkAllNotificationsRead()

  return (
    <div>
      <PageHeader
        title="Notifications"
        action={
          (data?.unreadCount ?? 0) > 0 && (
            <Button variant="quiet" loading={markAllRead.isPending} onClick={() => markAllRead.mutate()}>
              Mark all as read
            </Button>
          )
        }
      >
        <Checkbox label="Unread only" checked={unreadOnly} onChange={(event) => setUnreadOnly(event.target.checked)} />
      </PageHeader>

      {isLoading && <Skeleton height={200} radius="var(--radius-xl)" />}

      {data && data.notifications.length === 0 && (
        <EmptyState heading="Nothing new" body="Updates on your applications will appear here." />
      )}

      {data && data.notifications.length > 0 && (
        <div className="glass-dense" style={{ padding: 'var(--space-3)', display: 'grid', gap: 'var(--space-1)' }}>
          {data.notifications.map((notification) => (
            <NotificationRow key={notification.notificationId} notification={notification} />
          ))}
        </div>
      )}
    </div>
  )
}
