import { Link } from 'react-router-dom'
import type { ApplicationSummary } from '@/api/types'
import { OPPORTUNITY_TYPE_LABEL } from '@/api/enums'
import { StatusTag } from '@/ui/StatusTag'
import { Monogram } from '@/ui/Monogram'
import { formatDay } from '@/lib/formatDate'
import styles from './ApplicationRow.module.css'

/** One row of the applications list. Its grid matches the column headings
 *  above it, which share `--application-columns` with it. */
export function ApplicationRow({
  application,
  to,
  selected,
}: {
  application: ApplicationSummary
  to: string
  selected?: boolean
}) {
  return (
    <Link
      to={to}
      aria-current={selected ? 'true' : undefined}
      className={[styles.row, selected ? styles.selected : ''].join(' ')}
    >
      <span className={styles.role}>
        <Monogram name={application.companyName} />
        <span className={styles.text}>
          <span className={styles.title}>{application.jobTitle}</span>
          <span className={styles.meta}>
            {application.companyName} · {OPPORTUNITY_TYPE_LABEL[application.opportunityType]}
          </span>
        </span>
      </span>
      <span className={styles.status}>
        <StatusTag status={application.status} compact />
      </span>
      <span className={styles.date}>{formatDay(application.appliedAt)}</span>
    </Link>
  )
}
