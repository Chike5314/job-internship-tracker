import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { JobSummary } from '@/api/types'
import { ApiError } from '@/api/errors'
import { INTERVIEW_MODE_LABEL, OPPORTUNITY_TYPE_LABEL, WORK_MODALITY_LABEL, type OpportunityType } from '@/api/enums'
import { useRespondToInterview } from '@/features/applications/useApplications'
import { formatDateShort, formatWeekdayDate } from '@/lib/formatDate'
import { formatSalary } from '@/lib/formatSalary'
import { roundTitle } from '@/lib/interviews'
import { Button } from '@/ui/Button'
import { Icon } from '@/ui/Icon'
import { Monogram } from '@/ui/Monogram'
import { useToast } from '@/ui/ToastProvider'
import type { UpcomingInterview } from './useDashboard'
import styles from './PhoneHome.module.css'

type Filter = 'all' | 'jobs' | 'internships'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'jobs', label: 'Jobs' },
  { key: 'internships', label: 'Internships' },
]

const TYPE_TONE: Record<OpportunityType, string> = {
  FULL_TIME_JOB: styles.job!,
  PROFESSIONAL_INTERNSHIP: styles.professional!,
  ACADEMIC_INTERNSHIP: styles.academic!,
}

const WEEKDAY = new Intl.DateTimeFormat('en-GB', { weekday: 'short' })
const MONTH = new Intl.DateTimeFormat('en-GB', { month: 'short' })
const TIME = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })

function greeting(now: Date): string {
  const hour = now.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function place(job: JobSummary): string {
  return job.workModality === 'REMOTE' ? WORK_MODALITY_LABEL.REMOTE : (job.city ?? job.country ?? '')
}

/**
 * The dashboard as the canvas's phone board draws it: the greeting, a search,
 * the one interview waiting and the newest openings. The counts, the recent
 * list and the profile nudge stay on the wider screens, since the tab bar
 * already reaches Applications and Profile from here.
 */
export function PhoneHome({
  firstName,
  owed,
  next,
  openings,
}: {
  firstName: string
  /** "two things need your answer", already worded for the count. */
  owed: string
  next?: UpcomingInterview
  openings: JobSummary[]
}) {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  // Read once on arrival, so the greeting does not change under the reader.
  const [now] = useState(() => new Date())

  const term = query.trim().toLowerCase()
  const shown = openings
    .filter((job) =>
      filter === 'all' ? true : filter === 'jobs' ? job.opportunityType === 'FULL_TIME_JOB' : job.opportunityType !== 'FULL_TIME_JOB',
    )
    .filter((job) => (term ? `${job.title} ${job.companyName}`.toLowerCase().includes(term) : true))
    .slice(0, 4)

  // Enter takes the search to the full listing, which holds every posting
  // rather than the newest few shown here.
  function onSearch(event: FormEvent) {
    event.preventDefault()
    navigate(term ? `/postings?q=${encodeURIComponent(query.trim())}` : '/postings')
  }

  return (
    <div className={styles.page}>
      <div className={styles.greeting}>
        <h1 className={styles.title}>
          {greeting(now)}
          {firstName ? `, ${firstName}` : ''}
        </h1>
        <p className={styles.subtitle}>
          {formatWeekdayDate(now)}
          {owed ? ` · ${owed}` : ''}
        </p>
      </div>

      <form className={['glass-soft', styles.search].join(' ')} role="search" onSubmit={onSearch}>
        <Icon name="search" size={18} />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search roles or companies"
          aria-label="Search roles or companies"
          className={styles.field}
        />
      </form>

      <div className={styles.filters} role="group" aria-label="Opportunity type">
        {FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            aria-pressed={filter === item.key}
            className={[styles.filter, filter === item.key ? styles.filterOn : ''].join(' ')}
            onClick={() => setFilter(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {next && <PhoneInterviewCard next={next} />}

      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>New opportunities</h2>
        <Link to={term ? `/postings?q=${encodeURIComponent(query.trim())}` : '/postings'} className={styles.more}>
          See all
        </Link>
      </div>

      {shown.length === 0 ? (
        <p className={styles.empty}>No openings match. Try another word or type.</p>
      ) : (
        <ul className={styles.cards}>
          {shown.map((job) => {
            const salary = job.salary?.disclosed ? formatSalary(job.salary, { compact: true }) : ''
            const where = place(job)
            return (
              <li key={job.jobId}>
                <Link to={`/postings/${job.jobId}`} className={['glass-soft', styles.card].join(' ')}>
                  <span className={styles.cardHead}>
                    <Monogram name={job.companyName} />
                    <span className={styles.cardText}>
                      <span className={styles.role}>{job.title}</span>
                      <span className={styles.company}>{job.companyName}</span>
                    </span>
                  </span>
                  <span className={styles.tags}>
                    <span className={[styles.tag, TYPE_TONE[job.opportunityType]].join(' ')}>
                      {OPPORTUNITY_TYPE_LABEL[job.opportunityType]}
                    </span>
                    {where && <span className={[styles.tag, styles.place].join(' ')}>{where}</span>}
                  </span>
                  <span className={styles.terms}>
                    <span className={salary ? styles.salary : styles.undisclosed}>
                      {salary || 'Salary not disclosed'}
                    </span>
                    <span className={styles.closes}>
                      {job.applicationDeadline ? `Closes ${formatDateShort(job.applicationDeadline)}` : 'Open until filled'}
                    </span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/** The next interview, cut down to what fits a phone: when, who, and the reply. */
function PhoneInterviewCard({ next }: { next: UpcomingInterview }) {
  const { application, interview, round } = next
  const respond = useRespondToInterview(application.applicationId)
  const { showToast } = useToast()
  const start = new Date(interview.scheduledAt)
  const waiting = interview.state === 'PROPOSED'

  function reply(action: 'CONFIRM' | 'DECLINE') {
    respond.mutate(action, {
      onSuccess: () => {
        if (action === 'DECLINE') {
          showToast(`Declined. ${application.companyName} can propose a new time.`)
        }
      },
      onError: (error) =>
        showToast(
          error instanceof ApiError ? error.message : 'Your answer did not go through. Try again.',
          'error',
        ),
    })
  }

  return (
    <section className={styles.interview} aria-label="Next interview">
      <div className={styles.interviewHead}>
        <p className={styles.leaf} aria-hidden="true">
          <span className={styles.weekday}>{WEEKDAY.format(start).toUpperCase()}</span>
          <span className={styles.day}>{start.getDate()}</span>
          <span className={styles.month}>{MONTH.format(start).slice(0, 3).toUpperCase()}</span>
        </p>
        <div className={styles.interviewText}>
          <p className={styles.interviewTitle}>
            {roundTitle(round)}, {TIME.format(start)}
          </p>
          <p className={styles.interviewWhere}>
            {application.companyName} · {INTERVIEW_MODE_LABEL[interview.mode]}, {interview.locationOrLink}
          </p>
        </div>
      </div>
      {waiting ? (
        <div className={styles.reply}>
          <Button variant="primary" className={styles.replyButton} onClick={() => reply('CONFIRM')} disabled={respond.isPending}>
            Confirm
          </Button>
          <Button variant="secondary" className={styles.replyButton} onClick={() => reply('DECLINE')} disabled={respond.isPending}>
            Can't make it
          </Button>
        </div>
      ) : (
        <p className={styles.answered}>
          <span className={styles.answeredDot} aria-hidden="true" />
          Confirmed. {application.companyName} has been told.
        </p>
      )}
    </section>
  )
}
