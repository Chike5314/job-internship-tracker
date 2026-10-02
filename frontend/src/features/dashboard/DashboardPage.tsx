import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { useMyApplications } from '@/features/applications/useApplications'
import { usePostingsList } from '@/features/postings/usePostings'
import { useProfile } from '@/features/profile/useProfile'
import { StatusTag } from '@/ui/StatusTag'
import { Skeleton } from '@/ui/Skeleton'
import { EmptyState } from '@/ui/EmptyState'
import { ButtonLink } from '@/ui/ButtonLink'
import { Icon } from '@/ui/Icon'
import { formatRelativeTime } from '@/lib/formatDate'
import { OPPORTUNITY_TYPE_LABEL } from '@/api/enums'
import { StatTile } from './StatTile'
import { NextInterviewPanel } from './NextInterviewPanel'
import { useApplicationCounts, useNextInterview } from './useDashboard'
import styles from './DashboardPage.module.css'

const TODAY = new Intl.DateTimeFormat('en', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

/** How many of the five things the profile asks for are filled in. */
function profileProgress(profile?: {
  fullName: string
  phone?: string
  skills?: string[]
  cvCount: number
  hasTranscript?: boolean
}) {
  if (!profile) return { done: 0, total: 5 }
  const done = [
    Boolean(profile.fullName),
    Boolean(profile.phone),
    Boolean(profile.skills?.length),
    profile.cvCount > 0,
    Boolean(profile.hasTranscript),
  ].filter(Boolean).length
  return { done, total: 5 }
}

export function DashboardPage() {
  const { identity } = useAuth()
  const { data, isLoading } = useMyApplications()
  const { next, isLoading: interviewLoading } = useNextInterview()
  const { data: postings } = usePostingsList({})
  const { data: profile } = useProfile()

  const applications = data?.applications ?? []
  const counts = useApplicationCounts(applications)
  const progress = profileProgress(profile?.profile)

  const firstName = (identity?.fullName ?? '').trim().split(/\s+/)[0]
  const recent = [...applications]
    .sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime())
    .slice(0, 5)
  const openings = (postings?.jobs ?? []).slice(0, 4)

  // The subtitle names what is owed rather than greeting twice.
  const owed: string[] = []
  if (counts.interviews > 0) owed.push(counts.interviews === 1 ? 'an interview' : 'interviews')
  if (counts.offers > 0) owed.push(counts.offers === 1 ? 'an offer' : 'offers')

  return (
    <div className={styles.page}>
      <header className={styles.greeting}>
        <div>
          <h1 className="t-heading-lg">Welcome back{firstName ? `, ${firstName}` : ''}</h1>
          <p className={['t-body', styles.subtitle].join(' ')}>
            {owed.length > 0
              ? `Waiting on your answer: ${owed.join(' and ')}.`
              : 'Nothing is waiting on you right now.'}
          </p>
        </div>
        <p className={['t-body-sm', styles.today].join(' ')}>{TODAY.format(new Date())}</p>
      </header>

      <div className={styles.tiles}>
        <StatTile
          label="Applications"
          value={counts.total}
          icon="document"
          note={counts.thisWeek > 0 ? `${counts.thisWeek} sent this week` : 'Across every posting'}
          to="/applications"
        />
        <StatTile
          label="In progress"
          value={counts.inProgress}
          icon="pending"
          note="Waiting on a company's decision"
        />
        <StatTile
          label="Interviews"
          value={counts.interviews}
          icon="interview"
          note={next ? `Next ${formatRelativeTime(next.interview.scheduledAt)}` : 'None scheduled'}
        />
        <StatTile
          label="Offers"
          value={counts.offers}
          icon="offer"
          note={counts.offers > 0 ? 'Waiting for your answer' : 'None yet'}
          urgent={counts.offers > 0}
          to="/applications"
        />
      </div>

      <div className={styles.split}>
        <div className={styles.column}>
          {interviewLoading && <Skeleton height={190} radius="var(--radius-lg)" />}
          {!interviewLoading && next && <NextInterviewPanel next={next} />}

          <section className={styles.block} aria-labelledby="new-opportunities">
            <header className={styles.blockHead}>
              <h2 id="new-opportunities" className="t-heading-sm">
                New opportunities
              </h2>
              <Link to="/postings" className={styles.more}>
                Browse all
                <Icon name="chevron-right" size={15} />
              </Link>
            </header>

            <div className={['glass-soft', styles.list].join(' ')}>
              {openings.length === 0 ? (
                <EmptyState heading="Nothing open yet" body="New postings will appear here." />
              ) : (
                openings.map((job) => (
                  <Link key={job.jobId} to={`/postings/${job.jobId}`} className={styles.row}>
                    <span className={styles.rowMain}>
                      <span className="t-body-sm">{job.title}</span>
                      <span className={['t-caption', styles.muted].join(' ')}>
                        {job.companyName} · {job.city}
                      </span>
                    </span>
                    <span className={styles.type}>
                      {OPPORTUNITY_TYPE_LABEL[job.opportunityType]}
                    </span>
                  </Link>
                ))
              )}
            </div>
          </section>
        </div>

        <div className={styles.column}>
          <section className={styles.block} aria-labelledby="recent-applications">
            <header className={styles.blockHead}>
              <h2 id="recent-applications" className="t-heading-sm">
                Recent applications
              </h2>
              <Link to="/applications" className={styles.more}>
                View all
                <Icon name="chevron-right" size={15} />
              </Link>
            </header>

            <div className={['glass-soft', styles.list].join(' ')}>
              {isLoading && <Skeleton height={64} radius="var(--radius-sm)" />}
              {!isLoading && recent.length === 0 && (
                <EmptyState
                  heading="No applications yet"
                  body="Browse postings and apply to the ones that fit."
                />
              )}
              {recent.map((application) => (
                <Link
                  key={application.applicationId}
                  to={`/applications/${application.applicationId}`}
                  className={styles.row}
                >
                  <span className={styles.rowMain}>
                    <span className="t-body-sm">{application.jobTitle}</span>
                    <span className={['t-caption', styles.muted].join(' ')}>
                      {application.companyName} · {formatRelativeTime(application.appliedAt)}
                    </span>
                  </span>
                  <StatusTag status={application.status} />
                </Link>
              ))}
            </div>
          </section>

          {progress.done < progress.total && (
            <section className={['glass-soft', styles.profile].join(' ')} aria-labelledby="finish-profile">
              <h2 id="finish-profile" className="t-heading-sm">
                Finish your profile
              </h2>
              <p className={['t-body-sm', styles.muted].join(' ')}>
                A complete profile fills in more of every application you send.
              </p>
              <div className={styles.progressRow}>
                <span className={['t-caption', styles.muted].join(' ')}>Profile complete</span>
                <span className={['t-caption', styles.count].join(' ')}>
                  {progress.done} of {progress.total}
                </span>
              </div>
              <div
                className={styles.track}
                role="progressbar"
                aria-valuenow={progress.done}
                aria-valuemin={0}
                aria-valuemax={progress.total}
                aria-labelledby="finish-profile"
              >
                <span
                  className={styles.bar}
                  style={{ width: `${(progress.done / progress.total) * 100}%` }}
                />
              </div>
              <ButtonLink variant="secondary" to="/profile">
                Update profile
              </ButtonLink>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
