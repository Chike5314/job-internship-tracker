import { NavLink } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { ButtonLink } from '@/ui/ButtonLink'
import { NotificationBell } from '@/features/notifications/NotificationBell'
import { Logo } from './Logo'
import { ThemeToggle } from './ThemeToggle'
import { AccountMenu } from './AccountMenu'
import styles from './TopBar.module.css'

export function TopBar() {
  const { status, identity } = useAuth()

  return (
    <header className={[styles.bar, 'glass-soft'].join(' ')}>
      <NavLink to="/" className={styles.brand} aria-label="Offerline home">
        <Logo />
      </NavLink>

      {/* Two navigations, because a visitor and an account holder are not
          looking for the same things. A visitor is being sold the product and
          gets the marketing destinations; once signed in the bar becomes the
          app's own, which is how the canvas draws both boards. */}
      <nav className={styles.nav} aria-label="Primary">
        {status === 'signedIn' ? (
          <>
            <NavLink to="/postings" className={({ isActive }) => (isActive ? styles.active : undefined)}>
              Postings
            </NavLink>
            <NavLink to="/applications" className={({ isActive }) => (isActive ? styles.active : undefined)}>
              Applications
            </NavLink>
            <NavLink to="/profile" className={({ isActive }) => (isActive ? styles.active : undefined)}>
              Profile
            </NavLink>
          </>
        ) : (
          <>
            <NavLink to="/postings?type=FULL_TIME_JOB" className={styles.marketing}>
              Jobs
            </NavLink>
            <NavLink to="/postings?type=PROFESSIONAL_INTERNSHIP" className={styles.marketing}>
              Internships
            </NavLink>
            <a href="/#how" className={styles.marketing}>
              How it works
            </a>
            <a href="/#companies" className={styles.marketing}>
              For companies
            </a>
          </>
        )}
      </nav>

      <div className={styles.actions}>
        <ThemeToggle />
        {status === 'signedIn' && identity ? (
          <>
            <NotificationBell />
            <AccountMenu identity={identity} />
          </>
        ) : status === 'anonymous' ? (
          <>
            <NavLink to="/sign-in" className="t-body-sm">
              Sign in
            </NavLink>
            <ButtonLink variant="primary" to="/sign-up">
              Get started
            </ButtonLink>
          </>
        ) : null}
      </div>
    </header>
  )
}
