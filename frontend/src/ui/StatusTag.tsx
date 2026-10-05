import { APPLICATION_STATUS_LABEL, type ApplicationStatus } from '@/api/enums'
import styles from './StatusTag.module.css'

export type { ApplicationStatus }

// Presentation-only: which state-* token set each status renders with.
// Matches the tone notes in docs/brand/tokens.json exactly (e.g.
// OFFER_EXTENDED is "the only solid tag, because it is the only state that
// demands an answer").
const TONE: Record<ApplicationStatus, string> = {
  SUBMITTED: 'open',
  UNDER_REVIEW: 'active',
  INTERVIEW_SCHEDULED: 'waiting',
  OFFER_EXTENDED: 'offer',
  OFFER_ACCEPTED: 'won',
  OFFER_DECLINED: 'closed',
  REJECTED: 'closed',
  WITHDRAWN: 'closed',
}

// The boards set the shorter word in a list row, where the tag shares a line
// with a title, and the full one wherever the status is the subject.
const SHORT_LABEL: Partial<Record<ApplicationStatus, string>> = {
  INTERVIEW_SCHEDULED: 'Interview',
  OFFER_ACCEPTED: 'Accepted',
  OFFER_DECLINED: 'Declined',
}

export function StatusTag({
  status,
  compact,
  label: override,
}: {
  status: ApplicationStatus
  compact?: boolean
  /** A different word in the same tone, for a reader other than the applicant. */
  label?: string
}) {
  const label = override || (compact && SHORT_LABEL[status]) || APPLICATION_STATUS_LABEL[status]
  return (
    <span className={[styles.tag, styles[TONE[status]], 't-caption'].join(' ')}>
      <span className={styles.dot} aria-hidden="true" />
      {label}
    </span>
  )
}
