import type { ApplicationDetail, Interview } from '@/api/types'
import { ApiError } from '@/api/errors'
import { INTERVIEW_MODE_LABEL } from '@/api/enums'
import { Button } from '@/ui/Button'
import { Icon } from '@/ui/Icon'
import { useToast } from '@/ui/ToastProvider'
import { formatInterviewMoment, formatInterviewWhen } from '@/lib/formatDate'
import { downloadCalendarFile, interviewCalendarFile } from '@/lib/calendarFile'
import { interviewRound, roundTitle } from '@/lib/interviews'
import { useRespondToInterview } from './useApplications'
import styles from './InterviewCard.module.css'

const STATE: Record<Interview['state'], { label: string; tone: string }> = {
  PROPOSED: { label: 'Waiting for you', tone: styles.waiting! },
  CONFIRMED: { label: 'You confirmed', tone: styles.confirmed! },
  DECLINED: { label: 'You declined', tone: styles.declined! },
  CANCELLED: { label: 'Cancelled', tone: styles.declined! },
  COMPLETED: { label: 'Round complete', tone: styles.confirmed! },
}

export function InterviewCard({
  application,
  interview,
}: {
  application: ApplicationDetail
  interview: Interview
}) {
  const respond = useRespondToInterview(application.applicationId)
  const { showToast } = useToast()
  const title = roundTitle(interviewRound(application.interviews, interview), interview.roundLabel)
  const state = STATE[interview.state]
  // The superseded interview stays in the list, so the time it moved from can
  // be named rather than merely alluded to.
  const replaced = interview.replacesInterviewId
    ? application.interviews.find((entry) => entry.interviewId === interview.replacesInterviewId)
    : undefined
  const isLink = /^https?:\/\//i.test(interview.locationOrLink)

  function reply(action: 'CONFIRM' | 'DECLINE') {
    respond.mutate(action, {
      onError: (error) =>
        showToast(
          error instanceof ApiError ? error.message : 'Your answer did not go through. Try again.',
          'error',
        ),
    })
  }

  return (
    <section className={styles.card} aria-labelledby="interview-card">
      <header className={styles.head}>
        <h3 id="interview-card" className={styles.eyebrow}>
          INTERVIEW
        </h3>
        <span className={[styles.chip, state.tone].join(' ')}>{state.label}</span>
      </header>

      <div>
        <p className={styles.title}>{title}</p>
        <p className={styles.when}>
          {formatInterviewWhen(interview.scheduledAt, interview.durationMinutes)}
        </p>
      </div>

      <dl className={styles.facts}>
        <div>
          <dt>Length</dt>
          <dd>{interview.durationMinutes} minutes</dd>
        </div>
        <div>
          <dt>Where</dt>
          <dd>
            {INTERVIEW_MODE_LABEL[interview.mode]} ·{' '}
            {isLink ? (
              <a href={interview.locationOrLink} target="_blank" rel="noopener noreferrer">
                {interview.locationOrLink.replace(/^https?:\/\//i, '')}
              </a>
            ) : (
              interview.locationOrLink
            )}
          </dd>
        </div>
      </dl>

      {interview.state === 'PROPOSED' && (
        <div className={styles.reply}>
          <Button
            variant="primary"
            className={styles.replyButton}
            onClick={() => reply('CONFIRM')}
            disabled={respond.isPending}
          >
            Confirm attendance
          </Button>
          <Button
            variant="secondary"
            className={styles.replyButton}
            onClick={() => reply('DECLINE')}
            disabled={respond.isPending}
          >
            Can't make it
          </Button>
        </div>
      )}

      {interview.state === 'DECLINED' && (
        <p className={styles.declinedNote}>
          {application.companyName} has been told and can propose a new time.
        </p>
      )}

      <div className={styles.foot}>
        <span className={styles.moved}>
          {replaced ? `Moved from ${formatInterviewMoment(replaced.scheduledAt)}` : ''}
        </span>
        {interview.state !== 'DECLINED' && (
          <button
            type="button"
            className={styles.calendar}
            onClick={() =>
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
          >
            <Icon name="save" size={14} />
            Calendar file
          </button>
        )}
      </div>
    </section>
  )
}
