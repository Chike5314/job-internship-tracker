import { useAuth } from '@/auth/AuthProvider'
import type { ApplicationSummary } from '@/api/types'
import { useMyApplications } from '@/features/applications/useApplications'
import { usePostingsList } from '@/features/postings/usePostings'
import { useProfile } from '@/features/profile/useProfile'
import { Skeleton } from '@/ui/Skeleton'
import { formatInterviewMoment, formatLongDate } from '@/lib/formatDate'
import { PHONE_QUERY, useMediaQuery } from '@/lib/useMediaQuery'
import { StatTile } from './StatTile'
import { NextInterviewPanel } from './NextInterviewPanel'
import { NewOpportunities } from './NewOpportunities'
import { RecentApplications } from './RecentApplications'
import { ProfileNudge } from './ProfileNudge'
import { PhoneHome } from './PhoneHome'
import { useApplicationCounts, useUpcomingInterviews, type UpcomingInterview } from './useDashboard'
import styles from './DashboardPage.module.css'

const NUMBER_WORD = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten']

function count(n: number): string {
  return NUMBER_WORD[n] ?? String(n)
}

function several(n: number, noun: string): string {
  return n === 1 ? `an ${noun}` : `${count(n).toLowerCase()} ${noun}s`
}

/**
 * The line under the greeting names what is owed rather than greeting twice.
 * Only a time still waiting for a reply counts: a confirmed interview is on the
 * calendar, not on the viewer.
 */
function headline(interviews: UpcomingInterview[], offers: ApplicationSummary[]): string {
  const total = interviews.length + offers.length
  if (total === 0) return 'Nothing is waiting on your answer right now.'
  if (total === 1) {
    return offers[0]
      ? `One thing is waiting on your answer: the offer from ${offers[0].companyName}.`
      : `One thing is waiting on your answer: the interview with ${interviews[0]!.application.companyName}.`
  }
  const owed: string[] = []
  if (interviews.length > 0) owed.push(several(interviews.length, 'interview'))
  if (offers.length > 0) owed.push(several(offers.length, 'offer'))
  return `${count(total)} things are waiting on your answer: ${owed.join(' and ')}.`
}

/** The same count, said in the phone board's shorter line. */
function owedShort(total: number): string {
  if (total === 0) return 'nothing needs your answer right now'
  if (total === 1) return 'one thing needs your answer'
  return `${count(total).toLowerCase()} things need your answer`
}

export function DashboardPage() {
  const { identity } = useAuth()
  const { data, isLoading } = useMyApplications()
  const { upcoming, next, isLoading: interviewsLoading } = useUpcomingInterviews()
  const { data: postings, isLoading: postingsLoading } = usePostingsList({})
  const { data: profile } = useProfile()
  const phone = useMediaQuery(PHONE_QUERY)

  const applications = data?.applications ?? []
  const counts = useApplicationCounts(applications)
  const offers = applications.filter((application) => application.status === 'OFFER_EXTENDED')
  const offer = offers[0]
  const awaitingReply = upcoming.filter((item) => item.interview.state === 'PROPOSED')

  const firstName = (identity?.fullName ?? '').trim().split(/\s+/)[0]
  const recent = [...applications]
    .sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime())
    .slice(0, 5)

  // Newest first, and only what is still open to this applicant: a posting they
  // have already applied to is not an opportunity any more.
  const appliedTo = new Set(applications.map((application) => application.jobId))
  const allOpenings = (postings?.jobs ?? [])
    .filter((job) => job.isOpen && !appliedTo.has(job.jobId))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  const openings = allOpenings.slice(0, 4)
  const settled = !isLoading && !interviewsLoading

  if (phone) {
    return (
      <PhoneHome
        firstName={firstName ?? ''}
        owed={settled ? owedShort(awaitingReply.length + offers.length) : ''}
        next={interviewsLoading ? undefined : next}
        openings={allOpenings}
      />
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.greeting}>
        <div className={styles.welcome}>
          <h1 className={styles.title}>Welcome back{firstName ? `, ${firstName}` : ''}</h1>
          <p className={styles.subtitle}>
            {settled ? headline(awaitingReply, offers) : ' '}
          </p>
        </div>
        <p className={styles.today}>{formatLongDate(new Date())}</p>
      </header>

      <div className={styles.tiles}>
        <StatTile
          label="Applications"
          value={counts.total}
          icon="file"
          note={`${counts.thisWeek} sent this week`}
          to="/applications"
        />
        <StatTile
          label="In progress"
          value={counts.inProgress}
          icon="deadline"
          note="Waiting on a company's decision"
        />
        <StatTile
          label="Interviews"
          value={counts.interviews}
          icon="date"
          note={next ? `Next: ${formatInterviewMoment(next.interview.scheduledAt)}` : 'None scheduled'}
        />
        <StatTile
          label="Offers"
          value={counts.offers}
          icon="star"
          note={offer ? `${offer.companyName} is waiting for your answer →` : 'None yet'}
          urgent={Boolean(offer)}
          to={offer ? `/applications/${offer.applicationId}` : undefined}
        />
      </div>

      <div className={styles.split}>
        <div className={styles.column}>
          {interviewsLoading && counts.interviews > 0 && (
            <Skeleton height={214} radius="var(--radius-lg)" />
          )}
          {!interviewsLoading && next && <NextInterviewPanel next={next} />}
          <NewOpportunities jobs={openings} isLoading={postingsLoading} />
        </div>

        <div className={styles.column}>
          <RecentApplications applications={recent} isLoading={isLoading} />
          {profile && <ProfileNudge profile={profile.profile} />}
        </div>
      </div>
    </div>
  )
}
