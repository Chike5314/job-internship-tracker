import type { ReactNode } from 'react'
import styles from './EmptyState.module.css'

interface ErrorStateProps {
  heading?: string
  body?: string
  action?: ReactNode
}

export function ErrorState({
  heading = 'Something went wrong',
  body = 'Try again in a moment.',
  action,
}: ErrorStateProps) {
  return (
    <div className={['glass-dense', styles.wrapper].join(' ')} role="alert">
      <p className="t-heading-sm">{heading}</p>
      <p className="t-body-sm" style={{ color: 'var(--color-text-muted)' }}>
        {body}
      </p>
      {action && <div className={styles.action}>{action}</div>}
    </div>
  )
}
