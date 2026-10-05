import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { PostingDraft } from '@/api/company'
import { EXPERIENCE_LEVEL_LABEL, OPPORTUNITY_TYPE_LABEL, WORK_MODALITY_LABEL } from '@/api/enums'
import type { CompanySnippet, JobSummary } from '@/api/types'
import { Icon } from '@/ui/Icon'
import { formatDateShort, formatDayMonthYear, formatWeekdayDayMonthYear } from '@/lib/formatDate'
import { formatSalary } from '@/lib/formatSalary'
import type { Blocker } from './postingDraft'
import stepStyles from './EditorStep.module.css'
import styles from './PublishStep.module.css'

type Verification = CompanySnippet['verificationStatus']

const UNVERIFIED: Record<Exclude<Verification, 'VERIFIED'>, (company: string) => { title: string; body: string }> = {
  PENDING_VERIFICATION: (company) => ({
    title: 'Your company is still being verified',
    body: `You can save this as a draft now. Publishing unlocks as soon as our team approves ${company}, and we'll email you when that happens.`,
  }),
  REJECTED: () => ({
    title: 'Your company was not verified',
    body: 'Publishing needs a verified company. The email we sent says why, and your drafts stay saved.',
  }),
  SUSPENDED: () => ({
    title: 'Your company account is suspended',
    body: 'Nothing can be published while it is suspended. Your drafts stay saved.',
  }),
}

type Row = { term: string; value: string; missing?: boolean; quiet?: boolean; long?: boolean }

/** The three parts of the posting, row by row, with anything missing marked. */
function reviewOf(draft: PostingDraft, now: number): { step: 1 | 2 | 3; title: string; rows: Row[] }[] {
  const remote = draft.workModality === 'REMOTE'
  const city = draft.city?.trim()
  const country = draft.country?.trim()
  const deadline = draft.applicationDeadline ? new Date(draft.applicationDeadline) : null
  const passed = deadline ? deadline.getTime() <= now : false
  const salary = draft.salary?.disclosed ? formatSalary(draft.salary, { compact: true }) : ''
  const skills = draft.skills ?? []
  const about = draft.description.trim()
  const place = `${WORK_MODALITY_LABEL[draft.workModality]} · ${city}${country ? `, ${country}` : ''}`

  return [
    {
      step: 1,
      title: 'The basics',
      rows: [
        { term: 'Title', value: draft.title.trim() || 'Missing', missing: !draft.title.trim() },
        { term: 'Type', value: OPPORTUNITY_TYPE_LABEL[draft.opportunityType] },
        remote
          ? { term: 'Location', value: WORK_MODALITY_LABEL.REMOTE }
          : city
            ? { term: 'Location', value: place }
            : { term: 'Location', value: 'City missing', missing: true },
        deadline
          ? {
              term: 'Deadline',
              value: passed ? `${formatWeekdayDayMonthYear(deadline)}, passed` : formatWeekdayDayMonthYear(deadline),
              missing: passed,
            }
          : { term: 'Deadline', value: 'Missing', missing: true },
        { term: 'Openings', value: String(draft.openings ?? 1) },
      ],
    },
    {
      step: 2,
      title: 'Details',
      rows: [
        { term: 'Salary', value: salary || 'Not disclosed', quiet: !salary },
        {
          term: 'Level',
          value: draft.experienceLevel ? EXPERIENCE_LEVEL_LABEL[draft.experienceLevel] : 'Not set',
          quiet: !draft.experienceLevel,
        },
        { term: 'Start date', value: draft.startDate ? formatDayMonthYear(new Date(draft.startDate)) : 'Flexible' },
        ...(draft.duration?.trim() ? [{ term: 'Duration', value: draft.duration.trim() }] : []),
        { term: 'Skills', value: skills.length ? skills.join(', ') : 'None added', quiet: !skills.length },
        { term: 'About the role', value: about || 'Missing', missing: !about, long: true },
      ],
    },
    {
      step: 3,
      title: 'Documents',
      rows: (draft.documentRequirements ?? []).map((requirement) => ({
        term: requirement.label.trim() || 'Untitled document',
        value: requirement.required ? 'Required' : 'Optional',
        missing: !requirement.label.trim(),
        quiet: !requirement.required,
      })),
    },
  ]
}

/**
 * Step 4: everything at a glance, and the one place a posting is published
 * from. A posting already live says so; a closed or expired one can be
 * published again.
 */
export function PublishStep({
  draft,
  onEdit,
  status,
  verification,
  companyName,
  deadline,
  blockers,
  showBlockers,
  pending,
  onPublish,
  onSave,
}: {
  draft: PostingDraft
  onEdit: (step: 1 | 2 | 3) => void
  /** Absent until the posting is first saved. */
  status?: JobSummary['postingStatus']
  verification?: Verification
  companyName: string
  deadline?: string
  blockers: Blocker[]
  showBlockers: boolean
  pending: boolean
  onPublish: () => void
  onSave: () => void
}) {
  const live = status === 'PUBLISHED'
  const unverified = verification && verification !== 'VERIFIED' ? UNVERIFIED[verification](companyName) : null
  const again = status === 'CLOSED' || status === 'EXPIRED'
  // Read once on arrival, so a deadline does not turn to passed under the reader.
  const [now] = useState(() => Date.now())
  const review = reviewOf(draft, now)

  return (
    <div className={stepStyles.step}>
      <div className={stepStyles.intro}>
        <h1 className={stepStyles.heading}>Review and publish</h1>
        <p className={stepStyles.lede}>
          {live
            ? 'This posting is live. Saved changes reach applicants straight away.'
            : 'Check each part, then publish or keep it as a draft.'}
        </p>
      </div>

      {review.map((part) => (
        <section key={part.title} className={['glass-soft', styles.part].join(' ')} aria-labelledby={`review-${part.step}`}>
          <div className={styles.partHead}>
            <h2 id={`review-${part.step}`} className={styles.partTitle}>
              {part.title}
            </h2>
            <button type="button" className={styles.edit} onClick={() => onEdit(part.step)}>
              Edit<span className={styles.hidden}> {part.title.toLowerCase()}</span>
            </button>
          </div>
          <dl className={styles.rows}>
            {part.rows.map((row, index) => (
              <div key={`${row.term}-${index}`} className={[styles.row, row.long ? styles.rowLong : ''].join(' ')}>
                <dt>{row.term}</dt>
                <dd className={row.missing ? styles.missing : row.quiet ? styles.quiet : undefined}>{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}

      {showBlockers && blockers.length > 0 && (
        <div role="alert" className={styles.blockers}>
          <p className={styles.blockersTitle}>Before you can publish</p>
          <ul className={styles.blockerList}>
            {blockers.map((blocker) => (
              <li key={blocker.text}>
                ·{' '}
                <button type="button" className={styles.blockerLink} onClick={() => onEdit(blocker.step)}>
                  {blocker.text}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {unverified && !live && (
        <div className={styles.unverified}>
          <span className={styles.unverifiedMark} aria-hidden="true">
            <Icon name="pending" size={18} />
          </span>
          <div>
            <p className={styles.unverifiedTitle}>{unverified.title}</p>
            <p className={styles.unverifiedBody}>{unverified.body}</p>
          </div>
        </div>
      )}

      {live ? (
        <div role="status" className={styles.published}>
          <span className={styles.publishedMark} aria-hidden="true">
            <Icon name="confirm" size={18} />
          </span>
          <div className={styles.publishedText}>
            <p className={styles.publishedTitle}>Published. Applicants can see it now.</p>
            <p className={styles.publishedBody}>
              It closes itself on {deadline ? formatDateShort(deadline) : 'its deadline'}. New applications will appear
              in your pipeline.
            </p>
          </div>
          <Link to="/company/postings" className={styles.back}>
            Back to postings
          </Link>
        </div>
      ) : (
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.publish}
            onClick={onPublish}
            disabled={pending || Boolean(unverified)}
          >
            {again ? 'Publish again' : 'Publish posting'}
          </button>
          <button type="button" className={styles.keep} onClick={onSave} disabled={pending}>
            {status === undefined || status === 'DRAFT' ? 'Keep as draft' : 'Save changes'}
          </button>
        </div>
      )}
    </div>
  )
}
