import { useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { initials } from '@/lib/initials'
import { Flyout } from '@/ui/Flyout'
import { Icon } from '@/ui/Icon'
import styles from './RailIdentity.module.css'

type Props = {
  /** Shown in the avatar tile. Falls back to a dot when there is no name yet. */
  name: string
  /** A role for a person, a verification line for a company. */
  subtitle: ReactNode
  /** A company: a square tile with its first letter. */
  organisation?: boolean
  /** Where "Update profile" goes. Left out for an account with no profile
   *  page of its own, which then gets only "Sign out". */
  profileTo?: string
  profileLabel?: string
}

/** The card pinned to the bottom of a rail, naming who is signed in. It opens
 * the same two things the account menu in the bar offers for the account
 * itself, so the place the eye lands on "who am I" is also where to change it
 * or leave. The menu opens upward, since the card sits at the foot of the
 * screen. */
export function RailIdentity({ name, subtitle, organisation, profileTo, profileLabel = 'Update profile' }: Props) {
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLDivElement>(null)
  const { signOut } = useAuth()
  const navigate = useNavigate()

  return (
    <div className={styles.wrapper} ref={anchorRef}>
      <button
        type="button"
        className={['glass-soft', styles.card].join(' ')}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`Account: ${name || 'signed in'}`}
      >
        <span className={[styles.avatar, organisation ? styles.square : ''].join(' ')} aria-hidden="true">
          {organisation ? name.trim().charAt(0).toUpperCase() || '·' : initials(name)}
        </span>
        <span className={styles.text}>
          <span className={styles.name}>{name || '·'}</span>
          <span className={['t-caption', styles.subtitle].join(' ')}>{subtitle}</span>
        </span>
        <Icon name="chevron-down" size={16} className={[styles.chevron, open ? styles.chevronOpen : ''].join(' ')} />
      </button>
      <Flyout open={open} onClose={() => setOpen(false)} anchorRef={anchorRef} title="Account" placement="above">
        <nav className={styles.menu}>
          {profileTo && (
            <Link to={profileTo} onClick={() => setOpen(false)} className={styles.item}>
              <Icon name="person" size={18} />
              {profileLabel}
            </Link>
          )}
          <button
            type="button"
            className={styles.item}
            onClick={async () => {
              setOpen(false)
              await signOut()
              navigate('/')
            }}
          >
            <Icon name="sign-out" size={18} />
            Sign out
          </button>
        </nav>
      </Flyout>
    </div>
  )
}
