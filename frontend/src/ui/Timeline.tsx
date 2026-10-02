import type { ReactNode } from 'react'
import styles from './Timeline.module.css'

export interface TimelineEntry {
  key: string
  heading: ReactNode
  timestamp: ReactNode
  detail?: ReactNode
}

export function Timeline({ entries }: { entries: TimelineEntry[] }) {
  return (
    <ol className={styles.timeline}>
      {entries.map((entry) => (
        <li key={entry.key} className={styles.entry}>
          <span className={styles.dot} aria-hidden="true" />
          <div>
            <p className="t-body-sm" style={{ fontWeight: 600 }}>
              {entry.heading}
            </p>
            <p className="t-caption" style={{ color: 'var(--color-text-subtle)' }}>
              {entry.timestamp}
            </p>
            {entry.detail && (
              <p className="t-body-sm" style={{ color: 'var(--color-text-muted)' }}>
                {entry.detail}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}
