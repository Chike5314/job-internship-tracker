import { Icon } from '@/ui/Icon'
import { Button } from '@/ui/Button'
import { VisuallyHidden } from '@/ui/VisuallyHidden'
import { useToast } from '@/ui/ToastProvider'
import { INTERVIEW_MODE_LABEL } from '@/api/enums'
import { ApiError } from '@/api/errors'
import { formatLongDate } from '@/lib/formatDate'
import { downloadCalendarFile, interviewCalendarFile } from '@/lib/calendarFile'
import { roundTitle } from '@/lib/interviews'
import { useRespondToInterview } from '@/features/applications/useApplications'
import type { UpcomingInterview } from './useDashboard'
import styles from './NextInterviewPanel.module.css'

const WEEKDAY = new Intl.DateTimeFormat('en-GB', { weekday: 'short' })
const MONTH = new Intl.DateTimeFormat('en-GB', { month: 'short' })
const TIME = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })

export function NextInterviewPanel({ next }: { next: UpcomingInterview }) {
  const { application, interview, round } = next
  const respond = useRespondToInterview(application.applicationId)
  const { showToast } = useToast()

  const start = new Date(interview.scheduledAt)
  const end = new Date(start.getTime() + interview.durationMinutes * 60_000)
  const awaitingReply = interview.state === 'PROPOSED'
  const title = roundTitle(round)
  const isLink = /^https?:\/\//i.test(interview.locationOrLink)

  function reply(action: 'CONFIRM' | 'DECLINE') {
    respond.mutate(action, {
      // A declined time leaves the list of upcoming interviews, and this card
      // with it, so the confirmation has to outlive the card.
      onSuccess: () => {
        if (action === 'DECLINE') {
          showToast(`${application.companyName} has been told and can propose a new time.`)
        }
      },
      onError: (error) =>
        showToast(
          error instanceof ApiError ? error.message : 'Your answer did not go through. Try again.',
          'error',
        ),
    })
  }

  function addToCalendar() {
    downloadCalendarFile(
      interviewCalendarFile({
        title,
        company: application.companyName,
        scheduledAt: interview.scheduledAt,
        durationMinutes: interview.durationMinutes,
        location: interview.locationOrLink,
        uid: interview.interviewId,
      }),
      `interview-${application.companyName.toLowerCase().replace(/\s+/g, '-')}.ics`,
    )
  }

  return (
    <section className={['glass-soft', styles.panel].join(' ')} aria-labelledby="next-interview">
      <header className={styles.head}>
        <h2 id="next-interview" className={styles.eyebrow}>
          NEXT INTERVIEW
        </h2>
        <span className={[styles.badge, awaitingReply ? styles.waiting : styles.confirmed].join(' ')}>
          <span className={styles.dot} aria-hidden="true" />
          {awaitingReply ? 'Waiting for you' : 'Confirmed'}
        </span>
      </header>

      <div className={styles.body}>
        <p className={styles.leaf} aria-hidden="true">
          <span className={styles.weekday}>{WEEKDAY.format(start).toUpperCase()}</span>
          <span className={styles.day}>{start.getDate()}</span>
          <span className={styles.month}>{MONTH.format(start).slice(0, 3).toUpperCase()}</span>
        </p>

        <div className={styles.detail}>
          <div>
            <h3 className={styles.title}>{title}</h3>
            <p className={styles.role}>
              {application.jobTitle} · {application.companyName}
            </p>
          </div>
          <p className={styles.meta}>
            <span className={styles.fact}>
              <Icon name="deadline" size={15} />
              <VisuallyHidden>{formatLongDate(start)}, </VisuallyHidden>
              {TIME.format(start)}–{TIME.format(end)} · {interview.durationMinutes} min
            </span>
            <span className={styles.fact}>
              <Icon name="location" size={15} />
              <span className={styles.place}>
                {INTERVIEW_MODE_LABEL[interview.mode]} ·{' '}
                {isLink ? (
                  <a href={interview.locationOrLink} target="_blank" rel="noopener noreferrer">
                    {interview.locationOrLink.replace(/^https?:\/\//i, '')}
                  </a>
                ) : (
                  interview.locationOrLink
                )}
              </span>
            </span>
          </p>
        </div>
      </div>

      <div className={styles.actions}>
        {awaitingReply ? (
          <>
            <Button
              variant="primary"
              className={styles.confirm}
              onClick={() => reply('CONFIRM')}
              disabled={respond.isPending}
            >
              Confirm attendance
            </Button>
            <Button
              variant="secondary"
              className={styles.decline}
              onClick={() => reply('DECLINE')}
              disabled={respond.isPending}
            >
              Can't make it
            </Button>
          </>
        ) : (
          <span className={styles.message}>
            You confirmed. {application.companyName} has been told.
          </span>
        )}
        <button type="button" className={styles.calendar} onClick={addToCalendar}>
          <Icon name="save" size={16} />
          Add to calendar
        </button>
      </div>
    </section>
  )
}
