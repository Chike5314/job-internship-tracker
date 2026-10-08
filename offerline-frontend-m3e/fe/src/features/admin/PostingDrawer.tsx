import { useEffect, useId, useRef, useState, type MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '@/api/errors'
import { EXPERIENCE_LEVEL_LABEL, OPPORTUNITY_TYPE_LABEL, WORK_MODALITY_LABEL } from '@/api/enums'
import type { JobSummary } from '@/api/types'
import { Button } from '@/ui/Button'
import { Icon } from '@/ui/Icon'
import { Skeleton } from '@/ui/Skeleton'
import { formatDateShort, formatDayMonthYear } from '@/lib/formatDate'
import { formatSalary } from '@/lib/formatSalary'
import { CompanyMark } from './VerificationTag'
import { useAdminPosting, useClosePosting, useCompanyPostings } from './useAdmin'
import drawerStyles from './CompanyDrawer.module.css'
import styles from './PostingDrawer.module.css'

const STATUS: Record<JobSummary['postingStatus'], { label: string; tone: string }> = {
  PUBLISHED: { label: 'Live', tone: styles.live! },
  DRAFT: { label: 'Draft', tone: styles.quiet! },
  CLOSED: { label: 'Closed', tone: styles.quiet! },
  EXPIRED: { label: 'Expired', tone: styles.quiet! },
}

function where(job: JobSummary): string {
  const city = [job.city, job.country].filter(Boolean).join(', ')
  if (job.workModality === 'REMOTE') return city ? `Remote, company in ${city}` : 'Remote'
  return [WORK_MODALITY_LABEL[job.workModality], city].filter(Boolean).join(', ')
}

/**
 * One posting in full, opened from the postings list (FR-9.2). It is shown the
 * way an applicant meets it, so the admin judges the same thing they read, and
 * it can be closed on its own while the company stays as it stands.
 */
export function PostingDrawer({
  jobId,
  listed,
  onClose,
}: {
  jobId: string
  /** The row from the list, shown at once while the full posting is read. */
  listed?: JobSummary
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const query = useAdminPosting(jobId)
  const job = query.data?.job ?? listed

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
    dialog?.querySelector<HTMLElement>('h2')?.focus()
  }, [])

  function onBackdrop(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) onClose()
  }

  return (
    <dialog
      ref={ref}
      className={drawerStyles.drawer}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={onBackdrop}
    >
      {job ? (
        <PostingContent titleId={titleId} job={job} onClose={onClose} />
      ) : (
        <div className={drawerStyles.panel}>
          <header className={drawerStyles.head}>
            <div className={drawerStyles.who}>
              <h2 id={titleId} className={drawerStyles.placeholder} tabIndex={-1}>
                {query.isError ? 'This posting could not be found' : 'Opening the posting'}
              </h2>
              <button type="button" className={drawerStyles.close} onClick={onClose} aria-label="Close">
                <Icon name="close" size={16} />
              </button>
            </div>
          </header>
          <div className={drawerStyles.body}>
            {query.isError ? (
              <p className={drawerStyles.quiet}>It may have been removed, or the link is out of date.</p>
            ) : (
              <>
                <Skeleton height={160} radius="var(--radius-md)" />
                <Skeleton height={200} radius="var(--radius-md)" />
              </>
            )}
          </div>
        </div>
      )}
    </dialog>
  )
}

function PostingContent({
  titleId,
  job,
  onClose,
}: {
  titleId: string
  job: JobSummary
  onClose: () => void
}) {
  const close = useClosePosting(job.companyId)
  const postings = useCompanyPostings(job.companyId)
  const [asking, setAsking] = useState(false)
  const [flash, setFlash] = useState('')
  const [problem, setProblem] = useState('')

  const status = STATUS[job.postingStatus]
  const live = job.postingStatus === 'PUBLISHED'
  const applications = postings.data?.find((row) => row.jobId === job.jobId)?.applications
  const salary = job.salary?.disclosed ? formatSalary(job.salary) : 'Not disclosed'
  const details = job.additionalDetails?.filter((detail) => detail.label && detail.value) ?? []
  const companyLink = `/admin/companies?status=ALL&company=${encodeURIComponent(job.companyId)}`

  const facts: { term: string; value: string }[] = [
    { term: 'Type', value: OPPORTUNITY_TYPE_LABEL[job.opportunityType] },
    { term: 'Place', value: where(job) },
    { term: 'Salary', value: salary },
    { term: 'Openings', value: String(job.openings ?? 1) },
    ...(job.experienceLevel ? [{ term: 'Level', value: EXPERIENCE_LEVEL_LABEL[job.experienceLevel] }] : []),
    { term: 'Start date', value: job.startDate ? formatDayMonthYear(new Date(job.startDate)) : 'Flexible' },
    ...(job.duration ? [{ term: 'Duration', value: job.duration }] : []),
    {
      term: 'Applications',
      value: applications === undefined ? (postings.isPending ? '·' : 'Not known') : String(applications),
    },
  ]

  function confirmClose() {
    setProblem('')
    close.mutate(job.jobId, {
      onSuccess: () => {
        setAsking(false)
        setFlash(`${job.title} is closed. It takes no more applications, and anyone who applied can still see it.`)
      },
      onError: (error) =>
        setProblem(error instanceof ApiError ? error.message : 'The posting did not close. Try again.'),
    })
  }

  return (
    <div className={drawerStyles.panel}>
      <header className={drawerStyles.head}>
        <div className={drawerStyles.who}>
          <CompanyMark name={job.companyName} size="lg" />
          <div className={drawerStyles.identity}>
            <h2 id={titleId} className={drawerStyles.name} tabIndex={-1}>
              {job.title}
            </h2>
            <Link to={companyLink} className={drawerStyles.site}>
              {job.companyName}
              <Icon name="chevron-right" size={13} />
            </Link>
          </div>
          <button type="button" className={drawerStyles.close} onClick={onClose} aria-label="Close">
            <Icon name="close" size={16} />
          </button>
        </div>
        <div className={drawerStyles.statusLine}>
          <span className={[styles.status, status.tone].join(' ')}>
            <span className={styles.dot} aria-hidden="true" />
            {status.label}
          </span>
          <span className={drawerStyles.quietSmall}>
            Posted {formatDateShort(job.createdAt)}
            {job.applicationDeadline ? ` · Closes ${formatDateShort(job.applicationDeadline)}` : ''}
          </span>
        </div>
      </header>

      <div className={drawerStyles.body}>
        <section className={drawerStyles.section} aria-label="At a glance">
          <h3 className={drawerStyles.eyebrow}>AT A GLANCE</h3>
          <dl className={drawerStyles.details}>
            {facts.map((fact) => (
              <div key={fact.term} className={drawerStyles.detail}>
                <dt>{fact.term}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className={drawerStyles.section} aria-label="About the role">
          <h3 className={drawerStyles.eyebrow}>ABOUT THE ROLE</h3>
          <p className={styles.description}>{job.description || 'No description given.'}</p>
        </section>

        {(job.skills?.length ?? 0) > 0 && (
          <section className={drawerStyles.section} aria-label="Skills">
            <h3 className={drawerStyles.eyebrow}>SKILLS</h3>
            <ul className={styles.skills}>
              {job.skills!.map((skill) => (
                <li key={skill} className={styles.skill}>
                  {skill}
                </li>
              ))}
            </ul>
          </section>
        )}

        {details.length > 0 && (
          <section className={drawerStyles.section} aria-label="More details">
            <h3 className={drawerStyles.eyebrow}>MORE DETAILS</h3>
            <dl className={drawerStyles.details}>
              {details.map((detail) => (
                <div key={`${detail.label}-${detail.value}`} className={drawerStyles.detail}>
                  <dt>{detail.label}</dt>
                  <dd>{detail.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        <section className={drawerStyles.section} aria-label="Applicants are asked for">
          <h3 className={drawerStyles.eyebrow}>APPLICANTS ARE ASKED FOR</h3>
          <ul className={styles.asks}>
            {job.documentRequirements.map((requirement) => (
              <li key={requirement.key} className={styles.ask}>
                <Icon name={requirement.kind === 'TEXT' ? 'message' : 'file'} size={16} />
                <span className={styles.askLabel}>{requirement.label}</span>
                <span className={requirement.required ? styles.required : styles.optional}>
                  {requirement.required ? 'Required' : 'Optional'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <footer className={drawerStyles.foot}>
        {flash && (
          <p className={drawerStyles.flash} role="status">
            <Icon name="confirm" size={16} />
            {flash}
          </p>
        )}

        {asking ? (
          <div className={drawerStyles.confirm}>
            <p className={drawerStyles.confirmTitle}>Close {job.title}</p>
            <p className={drawerStyles.confirmBody}>
              It stops taking applications at once and comes off the listing. {job.companyName} stays as it
              stands, and is not emailed about it.
            </p>
            {problem && (
              <p role="alert" className={drawerStyles.problem}>
                {problem}
              </p>
            )}
            <div className={drawerStyles.confirmActions}>
              <button
                type="button"
                className={[drawerStyles.confirmButton, drawerStyles.confirmDanger].join(' ')}
                onClick={confirmClose}
                disabled={close.isPending}
              >
                Close posting
              </button>
              <Button variant="secondary" onClick={() => setAsking(false)} disabled={close.isPending}>
                Keep it open
              </Button>
            </div>
          </div>
        ) : (
          <div className={drawerStyles.next}>
            <p className={drawerStyles.nextLabel}>
              {live ? 'Moderation' : 'This posting is not live, so applicants cannot see it.'}
            </p>
            <div className={drawerStyles.nextActions}>
              {live && (
                <button
                  type="button"
                  className={[drawerStyles.nextAction, drawerStyles.reject].join(' ')}
                  onClick={() => {
                    setAsking(true)
                    setFlash('')
                  }}
                >
                  Close posting
                </button>
              )}
              <Link to={companyLink} className={[drawerStyles.nextAction, drawerStyles.secondary, styles.linkButton].join(' ')}>
                Review {job.companyName}
              </Link>
            </div>
          </div>
        )}
      </footer>
    </div>
  )
}
