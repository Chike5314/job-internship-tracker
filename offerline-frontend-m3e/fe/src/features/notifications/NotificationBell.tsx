import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Flyout } from '@/ui/Flyout'
import { EmptyState } from '@/ui/EmptyState'
import { Icon } from '@/ui/Icon'
import { NotificationRow } from './NotificationRow'
import { useNotifications } from './useNotifications'
import styles from './NotificationBell.module.css'

/** Each side of the product keeps its own notifications route, so the bell is
 *  told where "See all" goes rather than assuming the applicant's. */
export function NotificationBell({ to = '/notifications' }: { to?: string }) {
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLDivElement>(null)
  const { data } = useNotifications()
  const unreadCount = data?.unreadCount ?? 0
  const recent = (data?.notifications ?? []).slice(0, 5)

  return (
    <div className={styles.wrapper} ref={anchorRef}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
      >
        <Icon name="bell" size={20} />
        {unreadCount > 0 && <span className={styles.badge}>{unreadCount}</span>}
      </button>

      <Flyout open={open} onClose={() => setOpen(false)} anchorRef={anchorRef} title="Notifications">
        <div className={styles.list}>
          {recent.length === 0 ? (
            <EmptyState heading="Nothing new" body="Updates on your applications will appear here." />
          ) : (
            recent.map((notification) => (
              <NotificationRow key={notification.notificationId} notification={notification} />
            ))
          )}
          <Link to={to} onClick={() => setOpen(false)} className={['t-body-sm', styles.seeAll].join(' ')}>
            See all
          </Link>
        </div>
      </Flyout>
    </div>
  )
}
