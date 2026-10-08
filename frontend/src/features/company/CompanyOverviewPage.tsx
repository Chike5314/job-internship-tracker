import { Link } from 'react-router-dom'
import { APPLICATION_STATUS_LABEL } from '@/api/enums'
import { ButtonLink } from '@/ui/ButtonLink'
import { EmptyState } from '@/ui/EmptyState'
import { Icon } from '@/ui/Icon'
import { PageHeader } from '@/ui/PageHeader'
import { Skeleton } from '@/ui/Skeleton'
import { formatDateTime } from '@/lib/formatDate'
import { useCompanyAnalytics, useCompanyInterviews, useMyCompany, useMyPostings } from './useCompany'
import styles from './CompanyOverviewPage.module.css'

export function CompanyOverviewPage() {
  const { data: company, isPending: companyPending } = useMyCompany()
  const postings = useMyPostings()
  const analytics = useCompanyAnalytics()
  const interviews = useCompanyInterviews()

  const jobs = postings.data?.jobs ?? []
  const published = jobs.filter((job) => job.postingStatus === 'PUBLISHED')
  const drafts = jobs.filter((job) => job.postingStatus === 'DRAFT')
  const funnel = analytics.data?.funnel
  const waiting = (funnel?.SUBMITTED ?? 0) + (funnel?.INTERVIEW_SCHEDULED ?? 0)
  const upcoming = (interviews.data?.interviews ?? []).slice(0, 4)
  // Interviews that have happened with nothing recorded since. They are part of
  // the count in the line above, so leaving them off this block was what made
  // that count look invented.
  const overdue = interviews.data?.awaitingOutcome ?? []

  const verified = company?.company.verificationStatus === 'VERIFIED'

  return (
    <div className={styles.page}>
      <PageHeader title={`Welcome back, ${company?.company.companyName ?? 'there'}`}>
        <p className={['t-body', styles.muted].join(' ')}>
          {waiting > 0
            ? `${waiting} application${waiting === 1 ? '' : 's'} are waiting on you.`
            : 'Nothing is waiting on you right now.'}
        </p>
      </PageHeader>

      {!companyPending && company && !verified && (
        <div className={['glass-dense', styles.banner].join(' ')}>
          <Icon name="pending" size={20} />
          <div>
            <p className="t-heading-sm">Your company is waiting for verification</p>
            <p className={['t-body-sm', styles.muted].join(' ')}>
              You can write postings now. They stay drafts and reach nobody until an admin approves
              the account.
            </p>
          </div>
        </div>
      )}

      <section className={styles.tiles}>
        <Tile
          label="Published postings"
          value={published.length}
          foot={drafts.length > 0 ? `${drafts.length} in draft` : 'No drafts'}
          pending={postings.isPending}
        />
        <Tile
          label="Applications"
          value={analytics.data?.totalApplications ?? 0}
          foot="Across every posting"
          pending={analytics.isPending}
        />
        <Tile
          label="In review"
          value={funnel?.UNDER_REVIEW ?? 0}
          foot="Opened, not yet decided"
          pending={analytics.isPending}
        />
        <Tile
          label="Offers out"
          value={funnel?.OFFER_EXTENDED ?? 0}
          foot="Waiting on an answer"
          pending={analytics.isPending}
          attention={(funnel?.OFFER_EXTENDED ?? 0) > 0}
        />
      </section>

      <div className={styles.columns}>
        <section className={styles.block}>
          <header className={styles.blockHead}>
            <h2 className="t-heading-lg">Next interviews</h2>
            <Link to="/company/interviews" className={styles.more}>
              All interviews
            </Link>
          </header>
          {overdue.length > 0 && (
            <Link to="/company/interviews" className={styles.overdue}>
              <span className={styles.overdueDot} aria-hidden="true" />
              <span className="t-body-sm">
                {overdue.length === 1
                  ? 'One interview has happened with nothing recorded since.'
                  : `${overdue.length} interviews have happened with nothing recorded since.`}
              </span>
            </Link>
          )}
          {interviews.isPending ? (
            <Skeleton height={120} />
          ) : upcoming.length === 0 ? (
            overdue.length > 0 ? (
              <p className={['t-body-sm', styles.muted].join(' ')}>Nothing else is coming up.</p>
            ) : (
              <EmptyState
                heading="No interviews scheduled"
                body="One appears here as soon as you propose a time on an application."
              />
            )
          ) : (
            <ul className={styles.list}>
              {upcoming.map((row) => (
                <li key={row.applicationId} className={['glass-dense', styles.item].join(' ')}>
                  <div className={styles.itemText}>
                    <p className="t-body">{row.applicantName ?? 'Applicant'}</p>
                    <p className={['t-body-sm', styles.muted].join(' ')}>
                      {row.jobTitle ?? 'Posting'} · {formatDateTime(row.scheduledAt)}
                    </p>
                  </div>
                  <span
                    className={[
                      styles.chip,
                      row.interviewState === 'CONFIRMED' ? styles.ok : styles.pendingChip,
                    ].join(' ')}
                  >
                    {row.interviewState === 'CONFIRMED' ? 'Confirmed' : 'Awaiting reply'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={styles.block}>
          <header className={styles.blockHead}>
            <h2 className="t-heading-lg">Your postings</h2>
            <Link to="/company/postings" className={styles.more}>
              All postings
            </Link>
          </header>
          {postings.isPending ? (
            <Skeleton height={120} />
          ) : jobs.length === 0 ? (
            <EmptyState
              heading="No postings yet"
              body="A posting starts as a draft and reaches applicants only once you publish it."
              action={
                <ButtonLink variant="primary" to="/company/postings/new">
                  New posting
                </ButtonLink>
              }
            />
          ) : (
            <ul className={styles.list}>
              {(analytics.data?.perPosting ?? []).slice(0, 4).map((row) => (
                <li key={row.jobId} className={['glass-dense', styles.item].join(' ')}>
                  <div className={styles.itemText}>
                    <Link to={`/company/postings/${row.jobId}/pipeline`} className="t-body">
                      {row.title}
                    </Link>
                    <p className={['t-body-sm', styles.muted].join(' ')}>
                      {row.applications} application{row.applications === 1 ? '' : 's'}
                    </p>
                  </div>
                  <Icon name="chevron-right" size={18} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {funnel && analytics.data && analytics.data.totalApplications > 0 && (
        <section className={styles.block}>
          <h2 className="t-heading-lg">Where everyone stands</h2>
          <ul className={styles.spread}>
            {(Object.keys(APPLICATION_STATUS_LABEL) as (keyof typeof APPLICATION_STATUS_LABEL)[])
              .filter((status) => funnel[status] > 0)
              .map((status) => (
                <li key={status} className={styles.spreadItem}>
                  <span className={['t-figure', styles.spreadValue].join(' ')}>{funnel[status]}</span>
                  <span className={['t-body-sm', styles.muted].join(' ')}>
                    {APPLICATION_STATUS_LABEL[status]}
                  </span>
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function Tile({
  label,
  value,
  foot,
  pending,
  attention = false,
}: {
  label: string
  value: number
  foot: string
  pending: boolean
  attention?: boolean
}) {
  return (
    <div className={['glass-dense', styles.tile].join(' ')}>
      <p className={['t-eyebrow', styles.tileLabel].join(' ')}>{label}</p>
      {pending ? (
        <Skeleton width={64} height={34} />
      ) : (
        <p className={['t-figure-xl', attention ? styles.attention : ''].join(' ')}>{value}</p>
      )}
      <p className={['t-caption', styles.muted].join(' ')}>{foot}</p>
    </div>
  )
}
