import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { useNotifications } from '@/features/notifications/useNotifications'
import { initials } from '@/lib/initials'
import { Icon } from '@/ui/Icon'
import { Logo } from './Logo'
import styles from './PhoneHeader.module.css'

/**
 * The top of every signed-in applicant screen on a phone, as the canvas's
 * phone board draws it: the mark rather than the wordmark, since the width is
 * the scarce thing, and the two things worth reaching from anywhere.
 */
export function PhoneHeader() {
  const { identity } = useAuth()
  const { data } = useNotifications()
  const unread = data?.unreadCount ?? 0

  return (
    <header className={styles.bar}>
      <Link to="/dashboard" className={styles.brand} aria-label="Offerline home">
        <Logo variant="mark" height={26} />
      </Link>
      <div className={styles.actions}>
        <Link
          to="/notifications"
          className={['glass-soft', styles.bell].join(' ')}
          aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ''}`}
        >
          <Icon name="bell" size={20} />
          {unread > 0 && <span className={styles.badge}>{unread}</span>}
        </Link>
        <Link to="/profile" className={styles.avatar} aria-label="Your profile">
          <span aria-hidden="true">{initials(identity?.fullName || identity?.email || '')}</span>
        </Link>
      </div>
    </header>
  )
}
