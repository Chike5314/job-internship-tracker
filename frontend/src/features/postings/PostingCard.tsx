import { Link } from 'react-router-dom'
import type { JobSummary } from '@/api/types'
import { WORK_MODALITY_LABEL } from '@/api/enums'
import { Tag } from '@/ui/Tag'
import { Pill } from '@/ui/Pill'
import { formatDate } from '@/lib/formatDate'
import { formatSalary } from '@/lib/formatSalary'
import styles from './PostingCard.module.css'

// glass-dense, not glass-soft: this row carries metadata in text-muted,
// which the token file says needs glass-dense beneath it.
export function PostingCard({ job }: { job: JobSummary }) {
  // Date.now() during render is impure, but this is a client-only SPA with
  // no SSR (no hydration mismatch is possible) and the "closing soon" pill
  // is a display heuristic where a few milliseconds of drift across
  // re-renders is imperceptible. Not worth a dedicated clock hook.
  const deadlineSoon =
    job.applicationDeadline &&
    new Date(job.applicationDeadline).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000

  return (
    <Link to={`/postings/${job.jobId}`} className={['glass-dense', styles.card].join(' ')}>
      <div className={styles.header}>
        <p className="t-heading-sm">{job.title}</p>
        {job.applicationDeadline && (
          <Pill tone={deadlineSoon ? 'attention' : 'neutral'}>Closes {formatDate(job.applicationDeadline)}</Pill>
        )}
      </div>
      <p className="t-body-sm" style={{ color: 'var(--color-text-muted)' }}>
        {job.companyName} · {[job.city, job.country].filter(Boolean).join(', ') || WORK_MODALITY_LABEL[job.workModality]}
        {' · '}
        {WORK_MODALITY_LABEL[job.workModality]}
      </p>
      {job.salary?.disclosed && (
        <p className="t-body-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {formatSalary(job.salary, { compact: true })}
        </p>
      )}
      <p className="t-caption" style={{ color: 'var(--color-text-subtle)' }}>
        Asks for {job.documentRequirements.length} item{job.documentRequirements.length === 1 ? '' : 's'}
      </p>
      {job.skills && job.skills.length > 0 && (
        <div className={styles.tags}>
          {job.skills.slice(0, 4).map((skill) => (
            <Tag key={skill}>{skill}</Tag>
          ))}
          {job.skills.length > 4 && <Tag>+{job.skills.length - 4}</Tag>}
        </div>
      )}
    </Link>
  )
}
