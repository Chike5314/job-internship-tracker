import { Link } from 'react-router-dom'
import { Icon } from '@/ui/Icon'
import { Button } from '@/ui/Button'
import { INTERVIEW_MODE_LABEL } from '@/api/enums'
import { useRespondToInterview } from '@/features/applications/useApplications'
import type { UpcomingInterview } from './useDashboard'
import styles from './NextInterviewPanel.module.css'

const WEEKDAY = new Intl.DateTimeFormat('en', { weekday: 'short' })
const MONTH = new Intl.DateTimeFormat('en', { month: 'short' })
const TIME = new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit', hour12: false })

export function NextInterviewPanel({ next }: { next: UpcomingInterview }) {
  const { application, interview } = next
  const respond = useRespondToInterview(application.applicationId)

  const start = new Date(interview.scheduledAt)
  const end = new Date(start.getTime() + interview.durationMinutes * 60_000)
  const awaitingReply = interview.state === 'PROPOSED'

  return (
    <section className={['glass-dense', styles.panel].join(' ')} aria-labelledby="next-interview">
      <header className={styles.head}>
        <h2 id="next-interview" className={['t-eyebrow', styles.eyebrow].join(' ')}>
          Next interview
        </h2>
        {awaitingReply && (
          <span className={styles.waiting}>
            <span className={styles.dot} aria-hidden="true" />
            Waiting for you
          </span>
        )}
      </header>

      <div className={styles.body}>
        <p className={styles.date} aria-hidden="true">
          <span className={styles.weekday}>{WEEKDAY.format(start).toUpperCase()}</span>
          <span className={styles.day}>{start.getDate()}</span>
          <span className={styles.month}>{MONTH.format(start).toUpperCase()}</span>
        </p>

        <div className={styles.detail}>
          <h3 className="t-heading-sm">Interview</h3>
          <p className={['t-body-sm', styles.role].join(' ')}>
            {application.jobTitle} · {application.companyName}
          </p>
          <p className={['t-caption', styles.line].join(' ')}>
            <Icon name="interview" size={14} />
            {TIME.format(start)}–{TIME.format(end)} · {interview.durationMinutes} min
          </p>
          <p className={['t-caption', styles.line].join(' ')}>
            <Icon name="location" size={14} />
            {INTERVIEW_MODE_LABEL[interview.mode]} · {interview.locationOrLink}
          </p>
        </div>
      </div>

      {awaitingReply ? (
        <div className={styles.actions}>
          <Button
            variant="primary"
            onClick={() => respond.mutate('CONFIRM')}
            disabled={respond.isPending}
          >
            Confirm attendance
          </Button>
          <Button
            variant="secondary"
            onClick={() => respond.mutate('DECLINE')}
            disabled={respond.isPending}
          >
            Can't make it
          </Button>
          <Link to={`/applications/${application.applicationId}`} className={styles.quiet}>
            <Icon name="forward" size={15} />
            Open application
          </Link>
        </div>
      ) : (
        <p className={['t-body-sm', styles.confirmed].join(' ')}>
          <Icon name="confirm" size={15} />
          Confirmed. {application.companyName} has been told.
        </p>
      )}
    </section>
  )
}
