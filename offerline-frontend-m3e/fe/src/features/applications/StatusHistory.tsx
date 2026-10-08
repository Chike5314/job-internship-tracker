import type { StatusHistoryEntry } from '@/api/types'
import { APPLICATION_STATUS_LABEL } from '@/api/enums'
import { formatDay } from '@/lib/formatDate'
import styles from './StatusHistory.module.css'

/**
 * Who moved the application, in words rather than as an identifier.
 *
 * `changedBy` holds a Cognito id, which means nothing to the person reading
 * it. Only two parties can appear in an applicant's own history, the applicant
 * and the company, so the id only has to be matched against their own.
 */
function actorLine(entry: StatusHistoryEntry, viewerId: string | undefined, company: string) {
  if (viewerId && entry.changedBy === viewerId) return 'by you'
  // Opening an application is what moves it to Under review, so the status
  // itself says what the company did.
  if (entry.status === 'UNDER_REVIEW') return `by ${company}, on opening it`
  return `by ${company}`
}

/**
 * The history reads downward in the order it happened, which is how somebody
 * retells what has gone on. The last entry carries the live mark: vermilion
 * while the application is still moving, neutral once it has closed.
 */
export function StatusHistory({
  history,
  isFinal,
  viewerId,
  company,
}: {
  history: StatusHistoryEntry[]
  isFinal: boolean
  viewerId?: string
  company: string
}) {
  return (
    <ol className={styles.history}>
      {history.map((entry, index) => {
        const last = index === history.length - 1
        const mark = last ? (isFinal ? styles.closed : styles.live) : styles.past
        return (
          <li key={`${entry.status}-${entry.timestamp}`} className={styles.entry}>
            <span className={styles.rail} aria-hidden="true">
              <span className={[styles.dot, mark].join(' ')} />
              {!last && <span className={styles.line} />}
            </span>
            <span className={styles.body}>
              <span className={styles.head}>
                <span className={styles.label}>{APPLICATION_STATUS_LABEL[entry.status]}</span>
                <span className={styles.date}>{formatDay(entry.timestamp)}</span>
              </span>
              <span className={styles.actor}>{actorLine(entry, viewerId, company)}</span>
              {entry.note && <q className={styles.note}>{entry.note}</q>}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
