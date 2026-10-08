import { useEffect, useId, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { Icon } from '@/ui/Icon'
import { ButtonLink } from '@/ui/ButtonLink'
import { NotificationBell } from '@/features/notifications/NotificationBell'
import { Logo } from './Logo'
import { ThemeToggle } from './ThemeToggle'
import { AccountMenu } from './AccountMenu'
import styles from './TopBar.module.css'

export function TopBar() {
  const { status, identity } = useAuth()
  const location = useLocation()
  const navId = useId()
  // On a phone the links fold behind a menu button, as the side rail's do.
  // Open only on the page it was opened from, so any navigation, the landing
  // page's own section links included, reads as closed afterwards.
  const here = location.pathname + location.search + location.hash
  const [openedOn, setOpenedOn] = useState<string | null>(null)
  const open = openedOn === here
  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpenedOn(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  return (
    <header className={[styles.bar, 'glass-soft'].join(' ')}>
      <NavLink to="/" className={styles.brand} aria-label="Offerline home">
        <Logo />
      </NavLink>

      {/* Two navigations, because a visitor and an account holder are not
          looking for the same things. A visitor is being sold the product and
          gets the marketing destinations; once signed in the bar becomes the
          app's own, which is how the canvas draws both boards. */}
      <nav id={navId} className={styles.nav} data-open={open} aria-label="Primary">
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
            {status === 'anonymous' && (
              <NavLink to="/sign-in" className={[styles.marketing, styles.phoneOnly].join(' ')}>
                Sign in
              </NavLink>
            )}
          </>
        )}
        {/* On a phone the bar has room for the brand and one action, so the
            theme switch moves into the menu with the links. */}
        <span className={[styles.themeRow, styles.phoneOnly].join(' ')}>
          <ThemeToggle />
          Theme
        </span>
      </nav>

      <div className={styles.actions}>
        <span className={styles.wideOnly}>
          <ThemeToggle />
        </span>
        {status === 'signedIn' && identity ? (
          <>
            <NotificationBell />
            <AccountMenu identity={identity} />
          </>
        ) : status === 'anonymous' ? (
          <>
            <NavLink to="/sign-in" className={['t-body-sm', styles.wideOnly].join(' ')}>
              Sign in
            </NavLink>
            <ButtonLink variant="primary" to="/sign-up">
              Get started
            </ButtonLink>
          </>
        ) : null}
        <button
          type="button"
          className={styles.menuButton}
          aria-expanded={open}
          aria-controls={navId}
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpenedOn(open ? null : here)}
        >
          <Icon name={open ? 'close' : 'menu'} size={22} />
        </button>
      </div>
    </header>
  )
}
