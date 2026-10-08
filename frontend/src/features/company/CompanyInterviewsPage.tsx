import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { INTERVIEW_MODE_LABEL } from '@/api/enums'
import type { CompanyInterview } from '@/api/types'
import { EmptyState } from '@/ui/EmptyState'
import { ErrorState } from '@/ui/ErrorState'
import { Icon } from '@/ui/Icon'
import { PageHeader } from '@/ui/PageHeader'
import { Skeleton } from '@/ui/Skeleton'
import { formatDateShort, formatDateTime, formatRelativeTime } from '@/lib/formatDate'
import { useCompanyInterviews } from './useCompany'
import styles from './CompanyInterviewsPage.module.css'

/** How overdue, in whole days. formatAgo is no use here: past yesterday it
 *  falls back to the date, which this row is already showing. */
function daysSince(iso: string, now: number = Date.now()): string {
  const day = 24 * 60 * 60 * 1000
  const days = Math.floor((now - new Date(iso).getTime()) / day)
  if (days < 1) return 'earlier today'
  return days === 1 ? '1 day ago' : `${days} days ago`
}

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
  const overdue = interviews.data?.awaitingOutcome ?? []

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
          Everything still ahead of you, soonest first. One that has already happened moves to the
          top of this page until you record what came of it.
        </p>
      </PageHeader>

      {/* Above the calendar rather than in it. These are not appointments any
          more, they are applications sitting where only a recruiter can move
          them, and until now they appeared on no screen at all while the
          account went on counting them. */}
      {overdue.length > 0 && (
        <section className={styles.overdue} aria-labelledby="awaiting-outcome">
          <h2 id="awaiting-outcome" className={['t-heading-sm', styles.overdueHead].join(' ')}>
            <span className={styles.overdueDot} aria-hidden="true" />
            {overdue.length === 1
              ? 'One interview has happened with nothing recorded since'
              : `${overdue.length} interviews have happened with nothing recorded since`}
          </h2>
          <p className={['t-body-sm', styles.muted].join(' ')}>
            Each of these is still counted as an interview scheduled. Open it and move it on, or
            close it, and it leaves this list.
          </p>
          <ul className={styles.rows}>
            {overdue.map((row) => (
              <li key={row.applicationId} className={['glass-dense', styles.row].join(' ')}>
                <span className={styles.time}>
                  <span className="t-figure">{formatDateShort(row.scheduledAt)}</span>
                  <span className={['t-caption', styles.muted].join(' ')}>
                    {daysSince(row.scheduledAt)}
                  </span>
                </span>

                <span className={styles.who}>
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

                <span className={[styles.state, styles.needsOutcome].join(' ')}>
                  Needs an outcome
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {interviews.isPending ? (
        <Skeleton height={200} />
      ) : interviews.isError ? (
        <ErrorState />
      ) : days.length === 0 ? (
        overdue.length > 0 ? (
          <p className={['t-body-sm', styles.muted, styles.nothingAhead].join(' ')}>
            Nothing is coming up. The list above is what is left to settle.
          </p>
        ) : (
          <EmptyState
            heading="Nothing scheduled"
            body="Propose a time on an application and it appears here, on both sides, with a calendar invitation."
          />
        )
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
