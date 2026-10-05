import { Link, useLocation } from 'react-router-dom'
import { useNotifications } from '@/features/notifications/useNotifications'
import { Icon, type IconName } from '@/ui/Icon'
import styles from './PhoneTabBar.module.css'

type Tab = { to: string; label: string; icon: IconName; matches: (path: string) => boolean }

// Four places, which is what a thumb can reach along the bottom. Jobs and
// internships are a chip away on Home, and the CV library sits under Profile.
const TABS: Tab[] = [
  { to: '/dashboard', label: 'Home', icon: 'home', matches: (path) => path === '/dashboard' },
  { to: '/applications', label: 'Applications', icon: 'applications', matches: (path) => path.startsWith('/applications') },
  { to: '/notifications', label: 'Alerts', icon: 'bell', matches: (path) => path.startsWith('/notifications') },
  { to: '/profile', label: 'Profile', icon: 'person', matches: (path) => path.startsWith('/profile') },
]

/** The phone's main navigation, pinned to the bottom of the screen. */
export function PhoneTabBar() {
  const { pathname } = useLocation()
  const { data } = useNotifications(true)
  const unread = data?.count ?? 0

  return (
    <nav className={styles.bar} aria-label="Main">
      {TABS.map((tab) => {
        const active = tab.matches(pathname)
        const alerting = tab.to === '/notifications' && unread > 0
        return (
          <Link
            key={tab.to}
            to={tab.to}
            className={[styles.tab, active ? styles.active : ''].join(' ')}
            aria-current={active ? 'page' : undefined}
            aria-label={alerting ? `${tab.label}, ${unread} unread` : undefined}
          >
            <span className={styles.icon}>
              <Icon name={tab.icon} size={22} />
              {alerting && <span className={styles.dot} aria-hidden="true" />}
            </span>
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
