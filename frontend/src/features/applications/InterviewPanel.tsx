import type { Interview } from '@/api/types'
import { INTERVIEW_MODE_LABEL } from '@/api/enums'
import { Button } from '@/ui/Button'
import { formatDateTime } from '@/lib/formatDate'
import { useRespondToInterview } from './useApplications'

interface InterviewPanelProps {
  applicationId: string
  interviews: Interview[]
}

// The latest answerable interview is found by scanning from the end for a
// PROPOSED or CONFIRMED entry, mirroring _latest_open_interview in
// application_service/handler.py. Picking interviews[0] or the max
// scheduledAt would answer the wrong one after a reschedule, since a
// reschedule appends a new entry and marks the old one CANCELLED rather
// than editing it in place.
function findLatestOpenInterview(interviews: Interview[]): Interview | undefined {
  for (let i = interviews.length - 1; i >= 0; i -= 1) {
    const interview = interviews[i]
    if (interview && (interview.state === 'PROPOSED' || interview.state === 'CONFIRMED')) return interview
  }
  return undefined
}

export function InterviewPanel({ applicationId, interviews }: InterviewPanelProps) {
  const respond = useRespondToInterview(applicationId)

  if (interviews.length === 0) return null

  const open = findLatestOpenInterview(interviews)
  const earlier = interviews.filter((interview) => interview !== open)

  return (
    <div className="glass-dense" style={{ padding: 'var(--space-5)' }}>
      <p className="t-eyebrow" style={{ textTransform: 'uppercase', marginBottom: 'var(--space-3)' }}>
        Interview
      </p>

      {open ? (
        <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
          <p className="t-body" style={{ fontWeight: 600 }}>
            {formatDateTime(open.scheduledAt)}
          </p>
          <p className="t-body-sm" style={{ color: 'var(--color-text-muted)' }}>
            {INTERVIEW_MODE_LABEL[open.mode]} · {open.durationMinutes} minutes
          </p>
          {open.mode === 'ONLINE' ? (
            <a
              href={open.locationOrLink}
              target="_blank"
              rel="noopener noreferrer"
              className="t-body-sm"
              style={{ color: 'var(--color-text-link)', textDecoration: 'underline' }}
            >
              {open.locationOrLink}
            </a>
          ) : (
            <p className="t-body-sm">{open.locationOrLink}</p>
          )}

          {open.state === 'PROPOSED' && (
            <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
              <Button variant="primary" loading={respond.isPending} onClick={() => respond.mutate('CONFIRM')}>
                Confirm attendance
              </Button>
              <Button variant="quiet" loading={respond.isPending} onClick={() => respond.mutate('DECLINE')}>
                Decline interview
              </Button>
            </div>
          )}

          {open.state === 'CONFIRMED' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
              <span className="t-body-sm" style={{ color: 'var(--color-feedback-ok-text)', fontWeight: 600 }}>
                Confirmed
              </span>
              <Button variant="quiet" loading={respond.isPending} onClick={() => respond.mutate('DECLINE')}>
                Decline interview
              </Button>
            </div>
          )}
        </div>
      ) : (
        <p className="t-body-sm" style={{ color: 'var(--color-text-muted)' }}>
          There is no interview on this application still open.
        </p>
      )}

      {earlier.length > 0 && (
        <details style={{ marginTop: 'var(--space-4)' }}>
          <summary className="t-body-sm" style={{ cursor: 'pointer', color: 'var(--color-text-link)' }}>
            Earlier times
          </summary>
          <div style={{ display: 'grid', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
            {earlier.map((interview) => (
              <p key={interview.interviewId} className="t-caption" style={{ color: 'var(--color-text-subtle)' }}>
                {formatDateTime(interview.scheduledAt)} · {interview.state.toLowerCase()}
              </p>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
