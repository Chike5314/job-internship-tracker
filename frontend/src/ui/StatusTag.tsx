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

export function StatusTag({ status }: { status: ApplicationStatus }) {
  return (
    <span className={[styles.tag, styles[TONE[status]], 't-caption'].join(' ')}>
      {APPLICATION_STATUS_LABEL[status]}
    </span>
  )
}
