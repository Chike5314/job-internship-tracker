import type { PostingDraft } from '@/api/company'
import { EXPERIENCE_LEVEL_LABEL, OPPORTUNITY_TYPE_LABEL, WORK_MODALITY_LABEL, type OpportunityType } from '@/api/enums'
import type { CompanyFull } from '@/api/types'
import { Icon } from '@/ui/Icon'
import { formatDateShort, formatDayMonthYear } from '@/lib/formatDate'
import { formatSalary } from '@/lib/formatSalary'
import { initials } from '@/lib/initials'
import styles from './PostingPreview.module.css'

const TYPE_TONE: Record<OpportunityType, string> = {
  FULL_TIME_JOB: styles.job!,
  PROFESSIONAL_INTERNSHIP: styles.professional!,
  ACADEMIC_INTERNSHIP: styles.academic!,
}

/**
 * The posting as an applicant will meet it, redrawn on every keystroke. It is
 * a picture, so nothing in it can be clicked.
 */
export function PostingPreview({ draft, company }: { draft: PostingDraft; company?: CompanyFull }) {
  const name = company?.companyName ?? 'Your company'
  const remote = draft.workModality === 'REMOTE'
  const city = draft.city?.trim()
  const where = remote ? WORK_MODALITY_LABEL.REMOTE : [WORK_MODALITY_LABEL[draft.workModality], city].filter(Boolean).join(' · ')
  const salary = draft.salary?.disclosed ? formatSalary(draft.salary, { compact: true }) : ''
  // Duration is a field of its own, shown with the other details as the
  // posting page shows it.
  const extras = [
    ...(draft.duration?.trim() ? [{ label: 'Duration', value: draft.duration.trim() }] : []),
    ...(draft.additionalDetails ?? []).filter((detail) => detail.label.trim() && detail.value.trim()),
  ]
  const skills = draft.skills ?? []
  const title = draft.title.trim()

  return (
    <aside className={styles.preview} aria-label="Applicant preview">
      <div className={styles.head}>
        <span className={styles.eyebrow}>WHAT APPLICANTS WILL SEE</span>
        <span className={styles.live}>Live preview</span>
      </div>

      <div className={styles.card}>
        <div className={styles.company}>
          {company?.logoUrl ? (
            <img src={company.logoUrl} alt="" className={styles.logo} />
          ) : (
            <span className={styles.tile} aria-hidden="true">
              {initials(name).charAt(0)}
            </span>
          )}
          <div className={styles.companyText}>
            <p className={styles.companyName}>
              {name}
              {company?.verificationStatus === 'VERIFIED' && (
                <span className={styles.verified}>
                  <Icon name="verified" size={14} />
                </span>
              )}
            </p>
            <p className={styles.closes}>
              {draft.applicationDeadline ? `Closes ${formatDateShort(draft.applicationDeadline)}` : 'No deadline set yet'}
            </p>
          </div>
        </div>

        <p className={title ? styles.title : [styles.title, styles.placeholder].join(' ')}>{title || 'Posting title'}</p>

        <div className={styles.tags}>
          <span className={[styles.tag, TYPE_TONE[draft.opportunityType]].join(' ')}>
            {OPPORTUNITY_TYPE_LABEL[draft.opportunityType]}
          </span>
          <span className={[styles.tag, styles.plain].join(' ')}>{where}</span>
          {draft.experienceLevel && (
            <span className={[styles.tag, styles.plain].join(' ')}>{EXPERIENCE_LEVEL_LABEL[draft.experienceLevel]}</span>
          )}
        </div>

        <p className={salary ? styles.salary : [styles.salary, styles.undisclosed].join(' ')}>
          <Icon name="salary" size={16} />
          {salary || 'Salary not disclosed'}
        </p>

        <dl className={styles.facts}>
          <div className={styles.fact}>
            <dt>Openings</dt>
            <dd>{draft.openings ?? 1}</dd>
          </div>
          <div className={styles.fact}>
            <dt>Start date</dt>
            <dd>{draft.startDate ? formatDayMonthYear(new Date(draft.startDate)) : 'Flexible'}</dd>
          </div>
        </dl>

        {skills.length > 0 && (
          <ul className={styles.skills} aria-label="Skills">
            {skills.map((skill) => (
              <li key={skill} className={styles.skill}>
                {skill}
              </li>
            ))}
          </ul>
        )}

        {extras.length > 0 && (
          <dl className={styles.extras}>
            {extras.map((detail) => (
              <div key={`${detail.label}-${detail.value}`} className={styles.extra}>
                <dt>{detail.label}</dt>
                <dd>{detail.value}</dd>
              </div>
            ))}
          </dl>
        )}

        <div className={styles.asks}>
          <p className={styles.asksTitle}>YOU WILL BE ASKED FOR</p>
          <ul className={styles.askList}>
            {(draft.documentRequirements ?? []).map((requirement) => (
              <li key={requirement.key} className={styles.ask}>
                <span>{requirement.label.trim() || 'Untitled document'}</span>
                <span className={requirement.required ? styles.required : styles.optional}>
                  {requirement.required ? 'Required' : 'Optional'}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {(company?.companyWebsiteUrl || (company?.googleMapsUrl && !remote)) && (
          <div className={styles.links}>
            {company?.companyWebsiteUrl && <span className={styles.link}>Company website</span>}
            {company?.googleMapsUrl && !remote && <span className={styles.link}>View on Maps</span>}
          </div>
        )}

        <span className={styles.apply} aria-hidden="true">
          Apply
        </span>
      </div>
    </aside>
  )
}
