import type { PipelineRow } from '@/api/types'
import { StatusTag } from '@/ui/StatusTag'
import { formatDateShort } from '@/lib/formatDate'
import { initials } from '@/lib/initials'
import { applicantName, chipTime, hasPassed, recruiterShortLabel, timeInStage } from './pipeline'
import styles from './PipelineCard.module.css'

const CHIP_WORD = {
  PROPOSED: 'Awaiting',
  CONFIRMED: 'Confirmed',
  DECLINED: 'Declined',
  CANCELLED: 'Cancelled',
  COMPLETED: 'Complete',
}

/**
 * One application on the board. The checkbox picks it for a bulk change; the
 * rest of the card opens it in the drawer, and opening a new one is what moves
 * it to Under review.
 */
export function PipelineCard({
  row,
  picked,
  current,
  pickDisabled,
  onToggle,
  onOpen,
}: {
  row: PipelineRow
  picked: boolean
  /** The application open in the drawer. */
  current: boolean
  /** The bulk limit is reached and this one is not among them. */
  pickDisabled: boolean
  onToggle: () => void
  onOpen: () => void
}) {
  const name = applicantName(row)
  // Opening an application is what moves it off SUBMITTED, so sitting at that
  // status is exactly what "nobody has read this yet" means.
  const unopened = row.status === 'SUBMITTED'
  const interview = row.status === 'INTERVIEW_SCHEDULED' ? row.nextInterview : null
  const awaiting = interview?.state === 'PROPOSED'
  // The clock passing an interview writes nothing to the application, so a card
  // can sit here showing a time that has already been and gone. Saying so is
  // the only thing that tells a recruiter this one is theirs to move.
  const passed = Boolean(interview && hasPassed(interview.scheduledAt))

  return (
    <li
      className={[styles.card, current ? styles.current : picked ? styles.picked : ''].join(' ')}
    >
      <label className={styles.pick}>
        <input
          type="checkbox"
          checked={picked}
          onChange={onToggle}
          disabled={pickDisabled}
          className={styles.box}
        />
        <span className={styles.hidden}>Select {name}</span>
      </label>
      <button type="button" className={styles.body} onClick={onOpen} aria-haspopup="dialog">
        <span className={styles.head}>
          <span className={styles.avatar} aria-hidden="true">
            {initials(name)}
          </span>
          <span className={styles.who}>
            <span className={styles.name}>{name}</span>
            {row.applicantName && row.applicantEmail && (
              <span className={styles.sub}>{row.applicantEmail}</span>
            )}
          </span>
          {unopened && <span className={styles.unopened} role="img" aria-label="Not opened yet" />}
        </span>

        {interview && (
          <span
            className={[
              styles.chip,
              passed ? styles.chipPassed : awaiting ? styles.chipAwaiting : styles.chipConfirmed,
            ].join(' ')}
          >
            {(interview.round ?? 1) > 1 && `R${interview.round} · `}
            {chipTime(interview.scheduledAt)} · {passed ? 'needs an outcome' : CHIP_WORD[interview.state]}
          </span>
        )}
        {/* Between rounds nothing is booked, so the card says where it stands
            rather than looking like an interview that was never arranged. */}
        {!interview && row.status === 'INTERVIEW_SCHEDULED' && (row.roundsCompleted ?? 0) > 0 && (
          <span className={[styles.chip, styles.chipConfirmed].join(' ')}>
            Round {row.roundsCompleted} complete · book the next or decide
          </span>
        )}

        {row.isFinal && (
          <span className={styles.badge}>
            <StatusTag status={row.status} label={recruiterShortLabel(row.status)} />
          </span>
        )}

        <span className={styles.foot}>
          <span>Applied {formatDateShort(row.appliedAt)}</span>
          {!row.isFinal && <span>{timeInStage(row.statusChangedAt)}</span>}
        </span>
      </button>
    </li>
  )
}
