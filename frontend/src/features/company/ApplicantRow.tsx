import type { CompanyApplicant } from '@/api/types'
import { Monogram } from '@/ui/Monogram'
import { StatusTag } from '@/ui/StatusTag'
import { formatAgo } from '@/lib/formatDate'
import styles from './ApplicantRow.module.css'

/** At most three, because the row is for recognising somebody rather than
 *  reading their profile, and a fourth line of tags turns a list into a wall. */
const SKILLS_SHOWN = 3

/**
 * One person in the directory.
 *
 * The row answers four things without being opened, in the order a recruiter
 * asks them: who is this, have we seen them before, how far did they get, and
 * is anybody waiting. The last of those is the only one that takes colour, so
 * that a page of rows reads as a page with three things to do on it rather than
 * as a page of badges.
 */
export function ApplicantRow({
  person,
  selected,
  onOpen,
}: {
  person: CompanyApplicant
  selected: boolean
  onOpen: () => void
}) {
  const name = person.fullName || 'Applicant'
  const postings = person.applications.map((a) => a.jobTitle).filter(Boolean) as string[]
  const skills = person.skills.slice(0, SKILLS_SHOWN)
  const moreSkills = person.skills.length - skills.length

  return (
    <button
      type="button"
      data-ripple
      onClick={onOpen}
      aria-current={selected ? 'true' : undefined}
      className={[styles.row, selected ? styles.selected : ''].join(' ')}
    >
      <Monogram name={name} />

      <span className={styles.who}>
        <span className={styles.nameLine}>
          <span className={['t-body', styles.name].join(' ')}>{name}</span>
          {person.applicationCount > 1 && (
            <span className={['t-caption', styles.repeat].join(' ')}>
              {person.applicationCount} applications
            </span>
          )}
        </span>

        <span className={['t-body-sm', styles.muted, styles.email].join(' ')}>{person.email}</span>

        {postings.length > 0 && (
          <span className={['t-caption', styles.muted, styles.postings].join(' ')}>
            {postings.join(' · ')}
          </span>
        )}

        {skills.length > 0 && (
          <span className={styles.skills}>
            {skills.map((skill) => (
              <span key={skill} className={['t-caption', styles.skill].join(' ')}>
                {skill}
              </span>
            ))}
            {moreSkills > 0 && (
              <span className={['t-caption', styles.muted].join(' ')}>and {moreSkills} more</span>
            )}
          </span>
        )}
      </span>

      <span className={styles.standing}>
        <StatusTag status={person.furthestStatus} compact />
        {person.lastActivityAt && (
          <span className={['t-caption', styles.muted].join(' ')}>
            {formatAgo(person.lastActivityAt)}
          </span>
        )}
      </span>

      {/* The only thing on the row that takes a colour, because it is the only
          thing on it that is a job of work rather than a fact. */}
      <span className={styles.owed}>
        {person.awaitingReview > 0 && (
          <span className={['t-caption', styles.needsYou].join(' ')}>
            <span className={styles.dot} aria-hidden="true" />
            {person.awaitingReview === 1 ? 'Not opened' : `${person.awaitingReview} not opened`}
          </span>
        )}
        {person.awaitingTheirReply > 0 && (
          <span className={['t-caption', styles.waiting].join(' ')}>
            {person.awaitingTheirReply === 1
              ? 'Waiting on them'
              : `${person.awaitingTheirReply} awaiting reply`}
          </span>
        )}
      </span>
    </button>
  )
}
