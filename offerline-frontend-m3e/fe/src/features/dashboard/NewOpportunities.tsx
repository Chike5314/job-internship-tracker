import { Link } from 'react-router-dom'
import type { JobSummary } from '@/api/types'
import type { OpportunityType } from '@/api/enums'
import { OPPORTUNITY_TYPE_LABEL } from '@/api/enums'
import { formatSalary } from '@/lib/formatSalary'
import { formatDateShort } from '@/lib/formatDate'
import { EmptyState } from '@/ui/EmptyState'
import { Icon } from '@/ui/Icon'
import { Skeleton } from '@/ui/Skeleton'
import { Monogram } from '@/ui/Monogram'
import card from './DashboardCard.module.css'
import styles from './NewOpportunities.module.css'

const TYPE_TONE: Record<OpportunityType, string> = {
  FULL_TIME_JOB: styles.job!,
  PROFESSIONAL_INTERNSHIP: styles.professional!,
  ACADEMIC_INTERNSHIP: styles.academic!,
}

function place(job: JobSummary): string {
  if (job.workModality === 'REMOTE') return 'Remote'
  return job.city ?? job.country ?? ''
}

export function NewOpportunities({ jobs, isLoading }: { jobs: JobSummary[]; isLoading: boolean }) {
  return (
    <section className={['glass-soft', card.card, styles.fill].join(' ')} aria-labelledby="new-opportunities">
      <header className={card.head}>
        <h2 id="new-opportunities" className={card.title}>
          New opportunities
        </h2>
        <Link to="/postings" className={card.more}>
          Browse all
          <Icon name="chevron-right" size={14} />
        </Link>
      </header>

      {isLoading ? (
        <div className={styles.list}>
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} height={60} radius="var(--radius-md)" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <EmptyState heading="Nothing new right now" body="New postings will appear here as companies publish them." />
      ) : (
        <ul className={styles.list}>
          {jobs.map((job) => {
            const salary = job.salary?.disclosed
              ? formatSalary(job.salary, { compact: true, shortPeriod: true })
              : ''
            const where = place(job)
            return (
              <li key={job.jobId}>
                <Link to={`/postings/${job.jobId}`} className={styles.row}>
                  <Monogram name={job.companyName} />
                  <span className={styles.main}>
                    <span className={styles.role}>{job.title}</span>
                    <span className={styles.company}>
                      {job.companyName}
                      {where ? ` · ${where}` : ''}
                    </span>
                  </span>
                  <span className={[styles.type, TYPE_TONE[job.opportunityType]].join(' ')}>
                    {OPPORTUNITY_TYPE_LABEL[job.opportunityType]}
                  </span>
                  <span className={styles.terms}>
                    <span className={salary ? styles.salary : styles.undisclosed}>
                      {salary || 'Not disclosed'}
                    </span>
                    <span className={styles.closes}>
                      {job.applicationDeadline
                        ? `Closes ${formatDateShort(job.applicationDeadline)}`
                        : 'Open until filled'}
                    </span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
