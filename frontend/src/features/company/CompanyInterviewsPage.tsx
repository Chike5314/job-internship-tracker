import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { INTERVIEW_MODE_LABEL } from '@/api/enums'
import type { CompanyInterview } from '@/api/types'
import { EmptyState } from '@/ui/EmptyState'
import { ErrorState } from '@/ui/ErrorState'
import { Icon } from '@/ui/Icon'
import { PageHeader } from '@/ui/PageHeader'
import { Skeleton } from '@/ui/Skeleton'
import { formatDateTime, formatRelativeTime } from '@/lib/formatDate'
import { useCompanyInterviews } from './useCompany'
import styles from './CompanyInterviewsPage.module.css'

const DAY_HEADING = new Intl.DateTimeFormat('en', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

/**
 * The calendar, grouped by day.
 *
 * It is served off a sparse index: an application carries its next interview
 * only while that interview is still ahead of it, so rows enter and leave by
 * themselves and this page never has to filter out the past.
 */
export function CompanyInterviewsPage() {
  const interviews = useCompanyInterviews()

  const days = useMemo(() => {
    const rows = [...(interviews.data?.interviews ?? [])].sort((a, b) =>
      a.scheduledAt.localeCompare(b.scheduledAt),
    )
    const grouped = new Map<string, CompanyInterview[]>()
    for (const row of rows) {
      const key = row.scheduledAt.slice(0, 10)
      const bucket = grouped.get(key)
      if (bucket) bucket.push(row)
      else grouped.set(key, [row])
    }
    return Array.from(grouped.entries())
  }, [interviews.data])

  return (
    <div className={styles.page}>
      <PageHeader title="Interviews">
        <p className={['t-body', styles.muted].join(' ')}>
          Everything still ahead of you, soonest first. An interview leaves this page by itself once
          its time has passed.
        </p>
      </PageHeader>

      {interviews.isPending ? (
        <Skeleton height={200} />
      ) : interviews.isError ? (
        <ErrorState />
      ) : days.length === 0 ? (
        <EmptyState
          heading="Nothing scheduled"
          body="Propose a time on an application and it appears here, on both sides, with a calendar invitation."
        />
      ) : (
        <div className={styles.days}>
          {days.map(([day, rows]) => (
            <section key={day} className={styles.day}>
              <h2 className={['t-eyebrow', styles.dayHeading].join(' ')}>
                {DAY_HEADING.format(new Date(day))}
              </h2>
              <ul className={styles.rows}>
                {rows.map((row) => (
                  <li key={row.applicationId} className={['glass-dense', styles.row].join(' ')}>
                    <span className={styles.time}>
                      <span className="t-figure">{formatDateTime(row.scheduledAt).split('·').pop()?.trim()}</span>
                      <span className={['t-caption', styles.muted].join(' ')}>
                        {row.durationMinutes} min
                      </span>
                    </span>

                    <span className={styles.who}>
                      {/* Opens the application in its posting's board drawer. The
                          applicant's own route is behind the applicant guard. */}
                      <Link
                        to={`/company/postings/${row.jobId}/pipeline?application=${row.applicationId}`}
                        className="t-body"
                      >
                        {row.applicantName ?? 'Applicant'}
                      </Link>
                      <span className={['t-body-sm', styles.muted].join(' ')}>
                        {row.jobTitle ?? 'Posting'}
                      </span>
                    </span>

                    <span className={styles.where}>
                      <Icon name={row.mode === 'ONLINE' ? 'remote' : 'location'} size={16} />
                      <span className="t-body-sm">
                        {INTERVIEW_MODE_LABEL[row.mode]} · {row.locationOrLink}
                      </span>
                    </span>

                    <span
                      className={[
                        styles.state,
                        row.interviewState === 'CONFIRMED' ? styles.confirmed : styles.proposed,
                      ].join(' ')}
                    >
                      {row.interviewState === 'CONFIRMED' ? 'Confirmed' : 'Awaiting reply'}
                    </span>

                    <span className={['t-caption', styles.muted, styles.when].join(' ')}>
                      {formatRelativeTime(row.scheduledAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
