import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Identity } from '@/auth/authApi'
import { useAuth } from '@/auth/AuthProvider'
import { Flyout } from '@/ui/Flyout'
import { Icon } from '@/ui/Icon'
import { initials } from '@/lib/initials'
import { useTheme, type ThemePreference } from './ThemeProvider'
import styles from './AccountMenu.module.css'

const THEME_ORDER: ThemePreference[] = ['paper', 'ink', 'system']

const THEME_LABEL: Record<ThemePreference, string> = {
  paper: 'Paper',
  ink: 'Ink',
  system: 'Match system',
}

export function AccountMenu({ identity }: { identity: Identity }) {
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLDivElement>(null)
  const { signOut } = useAuth()
  const { preference, setPreference } = useTheme()
  const company = identity.groups.includes('Recruiters')
  const navigate = useNavigate()
  // The CV library belongs to an applicant; anyone else following the link
  // would only be sent back to their own home.
  const applicant = identity.groups.includes('Applicants')

  function cycleTheme() {
    setPreference(THEME_ORDER[(THEME_ORDER.indexOf(preference) + 1) % THEME_ORDER.length]!)
  }

  return (
    <div className={styles.wrapper} ref={anchorRef}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((v) => !v)}
        aria-label={`Account: ${identity.fullName || identity.email}`}
      >
        <span
          className={[styles.avatar, company ? styles.square : ''].join(' ')}
          aria-hidden="true"
        >
          {company
            ? (identity.fullName || identity.email).trim().charAt(0).toUpperCase()
            : initials(identity.fullName || identity.email)}
        </span>
        <Icon name="chevron-down" size={16} className={styles.chevron} />
      </button>
      <Flyout open={open} onClose={() => setOpen(false)} anchorRef={anchorRef} title="Account">
        <nav className={styles.menu}>
          {applicant && (
            <Link to="/profile/cvs" onClick={() => setOpen(false)} className="t-body-sm">
              CVs
            </Link>
          )}
          <button
            type="button"
            className={['t-body-sm', styles.theme].join(' ')}
            onClick={cycleTheme}
            aria-label={`Theme: ${THEME_LABEL[preference]}. Activate to switch.`}
          >
            <span>Theme</span>
            <span className={styles.themeValue}>{THEME_LABEL[preference]}</span>
          </button>
          <button
            type="button"
            className="t-body-sm"
            onClick={async () => {
              setOpen(false)
              await signOut()
              navigate('/')
            }}
          >
            Sign out
          </button>
        </nav>
      </Flyout>
    </div>
  )
}
