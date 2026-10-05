import type { ReactNode } from 'react'
import { initials } from '@/lib/initials'
import { Icon } from '@/ui/Icon'
import styles from './RailIdentity.module.css'

type Props = {
  /** Shown in the avatar tile. Falls back to a dot when there is no name yet. */
  name: string
  /** A role for a person, a verification line for a company. */
  subtitle: ReactNode
  /** A company: a square tile with its first letter, and no chevron. */
  organisation?: boolean
}

/** The card pinned to the bottom of a rail, naming who is signed in. The
 * trailing chevron matches the account menu's own trigger in the app bar,
 * both being the same affordance for "there is more here". */
export function RailIdentity({ name, subtitle, organisation }: Props) {
  return (
    <div className={['glass-soft', styles.card].join(' ')}>
      <span className={[styles.avatar, organisation ? styles.square : ''].join(' ')} aria-hidden="true">
        {organisation ? name.trim().charAt(0).toUpperCase() || '·' : initials(name)}
      </span>
      <span className={styles.text}>
        <span className={styles.name}>{name || '·'}</span>
        <span className={['t-caption', styles.subtitle].join(' ')}>{subtitle}</span>
      </span>
      {!organisation && <Icon name="chevron-down" size={16} className={styles.chevron} />}
    </div>
  )
}
