import type { CompanySnippet, JobSummary, LabelValue } from '@/api/types'
import {
  EXPERIENCE_LEVEL_LABEL,
  OPPORTUNITY_TYPE_LABEL,
  WORK_MODALITY_LABEL,
  type OpportunityType,
} from '@/api/enums'
import { Icon } from '@/ui/Icon'
import { Monogram } from '@/ui/Monogram'
import { VisuallyHidden } from '@/ui/VisuallyHidden'
import { formatSalary } from '@/lib/formatSalary'
import type { ApplyFormState } from './applyForm'
import { requirementChecklist, requiredProgress } from './applyForm'
import styles from './ApplyPostingSummary.module.css'

const DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

const TYPE_TONE: Record<OpportunityType, string> = {
  FULL_TIME_JOB: styles.job!,
  PROFESSIONAL_INTERNSHIP: styles.professional!,
  ACADEMIC_INTERNSHIP: styles.academic!,
}

interface ApplyPostingSummaryProps {
  job: JobSummary
  company?: CompanySnippet
  formState: ApplyFormState
}

/**
 * The persistent left column of the apply screen: what the posting is, and a
 * live read on what it still needs. It tracks the form as it fills in, which
 * is the whole point of it sitting beside the form.
 */
export function ApplyPostingSummary({ job, company, formState }: ApplyPostingSummaryProps) {
  const verified = company?.verificationStatus === 'VERIFIED'
  const salary = job.salary?.disclosed ? formatSalary(job.salary) : ''
  const place =
    job.workModality === 'REMOTE'
      ? WORK_MODALITY_LABEL.REMOTE
      : [WORK_MODALITY_LABEL[job.workModality], [job.city, job.country].filter(Boolean).join(', ')]
          .filter(Boolean)
          .join(' · ')

  const facts: { term: string; value: string; muted?: boolean }[] = [
    { term: 'Salary', value: salary || 'Not disclosed', muted: !salary },
    { term: 'Location', value: place },
  ]
  if (job.experienceLevel) facts.push({ term: 'Experience', value: EXPERIENCE_LEVEL_LABEL[job.experienceLevel] })
  if (job.openings) facts.push({ term: 'Openings', value: String(job.openings) })
  if (job.startDate) facts.push({ term: 'Start date', value: DATE.format(new Date(job.startDate)) })

  // What the company added on top of the standard fields, under its own name.
  const extras: LabelValue[] = [
    ...(job.duration ? [{ label: 'Duration', value: job.duration }] : []),
    ...(job.additionalDetails ?? []),
  ]

  const checklist = requirementChecklist(formState, job.documentRequirements)
  const progress = requiredProgress(formState, job.documentRequirements)
  const attempted = formState.submitAttempted

  return (
    <aside className={styles.column} aria-label="Posting summary">
      <div className={['glass-soft', styles.card].join(' ')}>
        <div className={styles.company}>
          <Monogram name={job.companyName} size="lg" />
          <div>
            <p className={styles.companyName}>
              {job.companyName}
              {verified && (
                <Icon name="admin" size={15} label="Verified company" className={styles.shield} />
              )}
            </p>
            {verified && <p className={styles.verified}>Verified company</p>}
          </div>
        </div>

        <h2 className={styles.role}>{job.title}</h2>
        <span className={[styles.type, TYPE_TONE[job.opportunityType]].join(' ')}>
          {OPPORTUNITY_TYPE_LABEL[job.opportunityType]}
        </span>

        <dl className={styles.facts}>
          {facts.map((fact) => (
            <div key={fact.term} className={styles.fact}>
              <dt>{fact.term}</dt>
              <dd className={fact.muted ? styles.mutedValue : undefined}>{fact.value}</dd>
            </div>
          ))}
        </dl>

        {job.skills && job.skills.length > 0 && (
          <div className={styles.group}>
            <p className={styles.eyebrow}>SKILLS</p>
            <div className={styles.skills}>
              {job.skills.map((skill) => (
                <span key={skill} className={styles.skill}>
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {extras.length > 0 && (
          <div className={styles.group}>
            <p className={styles.eyebrow}>ALSO FROM {job.companyName.toUpperCase()}</p>
            <dl className={styles.extras}>
              {extras.map((extra) => (
                <div key={extra.label} className={styles.extra}>
                  <dt>{extra.label}</dt>
                  <dd>{extra.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {(company?.companyWebsiteUrl || company?.googleMapsUrl) && (
          <div className={styles.links}>
            {company.companyWebsiteUrl && (
              <a href={company.companyWebsiteUrl} target="_blank" rel="noopener noreferrer" className={styles.outline}>
                Company website
              </a>
            )}
            {company.googleMapsUrl && (
              <a href={company.googleMapsUrl} target="_blank" rel="noopener noreferrer" className={styles.outline}>
                View on Maps
              </a>
            )}
          </div>
        )}
      </div>

      <div className={['glass-soft', styles.card, styles.asks].join(' ')}>
        <div className={styles.asksHead}>
          <p className={styles.eyebrow}>THIS POSTING ASKS FOR</p>
          <p className={styles.count}>
            {progress.done} of {progress.total} required
          </p>
        </div>
        <div
          className={styles.track}
          role="progressbar"
          aria-label="Required items done"
          aria-valuenow={progress.done}
          aria-valuemin={0}
          aria-valuemax={progress.total}
        >
          <span
            className={styles.bar}
            style={{ width: progress.total > 0 ? `${(progress.done / progress.total) * 100}%` : '0%' }}
          />
        </div>
        <ul className={styles.items}>
          {checklist.map(({ requirement, done }) => (
            <li key={requirement.key} className={styles.item}>
              <span
                className={[
                  styles.check,
                  done ? styles.checkDone : '',
                  !done && attempted && requirement.required ? styles.checkMissing : '',
                ].join(' ')}
                aria-hidden="true"
              >
                {done && <Icon name="confirm" size={12} />}
              </span>
              <span className={done ? styles.itemDone : styles.itemLabel}>
                {requirement.label}
                <VisuallyHidden>{done ? ', done' : ', not done yet'}</VisuallyHidden>
              </span>
              <span className={requirement.required ? styles.tag : styles.tagOptional}>
                {formState.uploads[requirement.key]?.kind === 'profile'
                  ? 'From profile'
                  : requirement.required
                    ? 'Required'
                    : 'Optional'}
              </span>
            </li>
          ))}
        </ul>
        <p className={styles.footnote}>
          {job.companyName} set this list. It started from the usual documents for this type of posting.
        </p>
      </div>

      <p className={styles.note}>
        You can change this application until {job.companyName} opens it. After that it is locked, so
        they always read exactly what you sent.
      </p>
    </aside>
  )
}
