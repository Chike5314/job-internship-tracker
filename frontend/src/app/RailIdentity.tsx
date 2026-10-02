import type { ReactNode } from 'react'
import styles from './RailIdentity.module.css'

type Props = {
  /** Shown in the avatar tile. Falls back to a dash when there is no name yet. */
  name: string
  /** A role for a person, a verification line for a company. */
  subtitle: ReactNode
}

/** Initials from a full name: two where there are two words, otherwise one. */
function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '—'
  if (words.length === 1) return words[0]!.charAt(0).toUpperCase()
  return (words[0]!.charAt(0) + words[words.length - 1]!.charAt(0)).toUpperCase()
}

/** The card pinned to the bottom of a rail, naming who is signed in. */
export function RailIdentity({ name, subtitle }: Props) {
  return (
    <div className={['glass-soft', styles.card].join(' ')}>
      <span className={styles.avatar} aria-hidden="true">
        {initials(name)}
      </span>
      <span className={styles.text}>
        <span className={['t-body-sm', styles.name].join(' ')}>{name || '—'}</span>
        <span className={['t-caption', styles.subtitle].join(' ')}>{subtitle}</span>
      </span>
    </div>
  )
}
