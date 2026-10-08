import type { ReactNode } from 'react'
import { EmptyIllustration, type EmptyArt } from './illustrations'
import styles from './EmptyState.module.css'

interface EmptyStateProps {
  heading: string
  body?: string
  action?: ReactNode
  /** An illustration above the heading. Omit it for the small in-panel cases
   *  (a dropdown, a drawer) where a picture would crowd the message. */
  art?: EmptyArt
}

// This carries muted body text, and text-muted needs glass-dense beneath it
// per the token's own usage note.
export function EmptyState({ heading, body, action, art }: EmptyStateProps) {
  return (
    <div className={['glass-dense', styles.wrapper].join(' ')}>
      {art && <EmptyIllustration art={art} className={styles.art} />}
      <p className="t-heading-sm">{heading}</p>
      {body && (
        <p className="t-body-sm" style={{ color: 'var(--color-text-muted)' }}>
          {body}
        </p>
      )}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  )
}
