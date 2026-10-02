import { Link } from 'react-router-dom'
import type { Notification } from '@/api/types'
import { formatRelativeTime } from '@/lib/formatDate'
import { useMarkNotificationRead } from './useNotifications'
import styles from './NotificationRow.module.css'

// Notification links are data, written by the backend, not something this
// app controls. Only paths matching a route this app actually knows
// become links; anything else (e.g. a recruiter-facing path, once that
// phase exists) renders as plain text rather than a dead link.
const KNOWN_LINK_PATTERNS = [/^\/postings\/[^/]+$/, /^\/applications\/[^/]+$/]

function isKnownLink(link: string): boolean {
  return KNOWN_LINK_PATTERNS.some((pattern) => pattern.test(link))
}

export function NotificationRow({ notification }: { notification: Notification }) {
  const markRead = useMarkNotificationRead()

  const body = (
    <>
      <p className="t-body-sm">{notification.message}</p>
      <p className="t-caption" style={{ color: 'var(--color-text-subtle)' }}>
        {formatRelativeTime(notification.createdAt)}
      </p>
    </>
  )

  const className = [styles.row, !notification.read && styles.unread].filter(Boolean).join(' ')

  if (notification.link && isKnownLink(notification.link)) {
    return (
      <Link
        to={notification.link}
        className={className}
        onClick={() => {
          if (!notification.read) markRead.mutate(notification.notificationId)
        }}
      >
        {!notification.read && <span className={styles.dot} aria-hidden="true" />}
        {body}
      </Link>
    )
  }

  return (
    <div
      className={className}
      role={notification.read ? undefined : 'button'}
      tabIndex={notification.read ? undefined : 0}
      onClick={() => {
        if (!notification.read) markRead.mutate(notification.notificationId)
      }}
    >
      {!notification.read && <span className={styles.dot} aria-hidden="true" />}
      {body}
    </div>
  )
}
