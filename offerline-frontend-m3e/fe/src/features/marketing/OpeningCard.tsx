import { Link } from 'react-router-dom'
import type { JobSummary } from '@/api/types'
import {
  EXPERIENCE_LEVEL_LABEL,
  OPPORTUNITY_TYPE_LABEL,
  WORK_MODALITY_LABEL,
} from '@/api/enums'
import { Icon } from '@/ui/Icon'
import { formatDate } from '@/lib/formatDate'
import { formatSalary } from '@/lib/formatSalary'
import styles from './OpeningCard.module.css'

/**
 * The landing page's own posting card, not the applicant side's.
 *
 * It leads with the company rather than the role, because a visitor who is not
 * signed in is still deciding whether this platform is worth an account, and the
 * verified company beside each opening is the argument. The applicant side's
 * card leads with the role, which is the right answer once they are browsing.
 */
export function OpeningCard({ job }: { job: JobSummary }) {
  const initial = (job.companyName || '?').trim().charAt(0).toUpperCase()
  const meta = [
    job.city,
    WORK_MODALITY_LABEL[job.workModality],
    job.experienceLevel ? EXPERIENCE_LEVEL_LABEL[job.experienceLevel] : null,
  ].filter(Boolean)
  const salary = job.salary?.disclosed ? formatSalary(job.salary, { compact: true }) : null

  return (
    <article className={['glass-dense', styles.card].join(' ')}>
      <header className={styles.head}>
        <span className={styles.company}>
          <span className={styles.avatar} aria-hidden="true">
            {initial}
          </span>
          <span className="t-body-sm">{job.companyName}</span>
          <Icon name="verified" size={14} label="Verified company" />
        </span>
        <span className={styles.type}>{OPPORTUNITY_TYPE_LABEL[job.opportunityType]}</span>
      </header>

      <h3 className="t-heading-sm">{job.title}</h3>

      <p className={['t-caption', styles.meta].join(' ')}>{meta.join(' · ')}</p>

      <p className={['t-figure', styles.salary, salary ? '' : styles.undisclosed].join(' ')}>
        <Icon name="salary" size={15} />
        {salary ?? 'Salary not disclosed'}
      </p>

      <footer className={styles.foot}>
        <span className={['t-caption', styles.muted].join(' ')}>
          {job.applicationDeadline ? `Closes ${formatDate(job.applicationDeadline)}` : 'No deadline'}
        </span>
        <Link to={`/postings/${job.jobId}`} className={styles.view}>
          View role
          <Icon name="forward" size={15} />
        </Link>
      </footer>
    </article>
  )
}
