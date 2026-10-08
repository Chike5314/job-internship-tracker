import type { ApplicationStatus } from '@/api/enums'
import type { PipelineRow } from '@/api/types'
import { formatClock, formatDateShort } from '@/lib/formatDate'

/**
 * The board's columns, in the order an application moves through them.
 *
 * The column is not the status: every decided application shares the last
 * column, because a decision is one place on a board even though the state
 * machine records four different ones. A column per ending would read as four
 * more places still to go.
 */
export const COLUMNS: {
  key: string
  label: string
  hint: string
  dot: string
  statuses: ApplicationStatus[]
}[] = [
  { key: 'new', label: 'New', hint: 'Not opened yet', dot: 'var(--color-brand-verm)', statuses: ['SUBMITTED'] },
  {
    key: 'review',
    label: 'Under review',
    hint: 'Opened and being read',
    dot: 'var(--color-brand-forest)',
    statuses: ['UNDER_REVIEW'],
  },
  {
    key: 'interview',
    label: 'Interview',
    hint: 'Interview booked',
    dot: 'var(--color-attention-text)',
    statuses: ['INTERVIEW_SCHEDULED'],
  },
  {
    key: 'offer',
    label: 'Offer extended',
    hint: 'Waiting on the applicant',
    dot: 'var(--color-state-active-text)',
    statuses: ['OFFER_EXTENDED'],
  },
  {
    key: 'decided',
    label: 'Decided',
    hint: 'Closed, kept for records',
    dot: 'var(--color-text-subtle)',
    statuses: ['OFFER_ACCEPTED', 'REJECTED', 'OFFER_DECLINED', 'WITHDRAWN'],
  },
]

/** Fifty is the API's own limit on one bulk call. */
export const BULK_LIMIT = 50

/**
 * The company's words for each status. They differ from the applicant's in one
 * place: the company made the decision, so it reads "Rejected" where the
 * applicant reads "Not taken forward".
 */
export const RECRUITER_STATUS_LABEL: Record<ApplicationStatus, string> = {
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under review',
  INTERVIEW_SCHEDULED: 'Interview scheduled',
  OFFER_EXTENDED: 'Offer extended',
  OFFER_ACCEPTED: 'Offer accepted',
  OFFER_DECLINED: 'Offer declined',
  REJECTED: 'Rejected',
  WITHDRAWN: 'Withdrawn',
}

const SHORT_LABEL: Partial<Record<ApplicationStatus, string>> = {
  INTERVIEW_SCHEDULED: 'Interview',
  OFFER_ACCEPTED: 'Accepted',
  OFFER_DECLINED: 'Declined',
}

/** The shorter word, for a tag that shares a card or a header line. */
export function recruiterShortLabel(status: ApplicationStatus): string {
  return SHORT_LABEL[status] ?? RECRUITER_STATUS_LABEL[status]
}

export function applicantName(row: { applicantName?: string; applicantEmail?: string }): string {
  return row.applicantName || row.applicantEmail || 'Applicant'
}

/** How long the application has sat where it is, counted in calendar days. */
export function timeInStage(iso: string, now: number = Date.now()): string {
  const day = 24 * 60 * 60 * 1000
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const then = new Date(iso)
  then.setHours(0, 0, 0, 0)
  const days = Math.max(0, Math.round((today.getTime() - then.getTime()) / day))
  return days === 0 ? 'today' : `${days}d in stage`
}

/** "29 Sep 10:00", which reads as one unit on a card. */
export function chipTime(iso: string): string {
  return `${formatDateShort(iso)} ${formatClock(iso)}`
}

/**
 * Why one application in a bulk run stayed where it was, said about that
 * applicant. The API's own reason is kept for any case not covered here.
 */
export function refusalReason(
  row: PipelineRow | undefined,
  target: ApplicationStatus,
  fallback: string,
): string {
  if (!row) return fallback
  const name = applicantName(row)
  const label = recruiterShortLabel(row.status).toLowerCase()
  if (row.isFinal) return `${name} is ${label}, which is final.`
  if (row.status === 'OFFER_EXTENDED') return `${name} has an offer waiting on their answer.`
  if (row.status === target) return `${name} is already ${label}.`
  if (row.status === 'INTERVIEW_SCHEDULED' && target === 'UNDER_REVIEW') {
    return `${name} already has an interview booked.`
  }
  return `${name}: ${fallback}`
}
