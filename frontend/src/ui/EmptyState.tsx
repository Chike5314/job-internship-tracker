import type { ReactNode } from 'react'
import styles from './EmptyState.module.css'

interface EmptyStateProps {
  heading: string
  body?: string
  action?: ReactNode
}

// This carries muted body text, and text-muted needs glass-dense beneath it
// per the token's own usage note.
export function EmptyState({ heading, body, action }: EmptyStateProps) {
  return (
    <div className={['glass-dense', styles.wrapper].join(' ')}>
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
