import { Link } from 'react-router-dom'
import type { ApplicationSummary } from '@/api/types'
import { formatAgo } from '@/lib/formatDate'
import { EmptyState } from '@/ui/EmptyState'
import { Icon } from '@/ui/Icon'
import { Skeleton } from '@/ui/Skeleton'
import { StatusTag } from '@/ui/StatusTag'
import { Monogram } from '@/ui/Monogram'
import card from './DashboardCard.module.css'
import styles from './RecentApplications.module.css'

export function RecentApplications({
  applications,
  isLoading,
}: {
  applications: ApplicationSummary[]
  isLoading: boolean
}) {
  return (
    <section className={['glass-soft', card.card].join(' ')} aria-labelledby="recent-applications">
      <header className={card.head}>
        <h2 id="recent-applications" className={card.title}>
          Recent applications
        </h2>
        <Link to="/applications" className={card.more}>
          View all
          <Icon name="chevron-right" size={14} />
        </Link>
      </header>

      {isLoading ? (
        <div className={styles.loading}>
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} height={44} radius="var(--radius-sm)" />
          ))}
        </div>
      ) : applications.length === 0 ? (
        <EmptyState
          heading="No applications yet"
          body="Browse postings and apply to the ones that fit."
        />
      ) : (
        <ul className={styles.list}>
          {applications.map((application) => (
            <li key={application.applicationId}>
              <Link to={`/applications/${application.applicationId}`} className={styles.row}>
                <Monogram name={application.companyName} size="sm" />
                <span className={styles.main}>
                  <span className={styles.role}>{application.jobTitle}</span>
                  <span className={styles.company}>
                    {application.companyName} · {formatAgo(application.appliedAt)}
                  </span>
                </span>
                <StatusTag status={application.status} compact />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
