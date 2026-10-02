import { Link } from 'react-router-dom'
import type { ApplicationSummary } from '@/api/types'
import { OPPORTUNITY_TYPE_LABEL } from '@/api/enums'
import { StatusTag } from '@/ui/StatusTag'
import { formatDate } from '@/lib/formatDate'
import styles from './ApplicationRow.module.css'

// glass-dense: this row carries metadata (company, dates) in text-muted,
// which needs glass-dense beneath it.
export function ApplicationRow({ application }: { application: ApplicationSummary }) {
  return (
    <Link to={`/applications/${application.applicationId}`} className={['glass-dense', styles.row].join(' ')}>
      <div>
        <p className="t-heading-sm">{application.jobTitle}</p>
        <p className="t-body-sm" style={{ color: 'var(--color-text-muted)' }}>
          {application.companyName} · {OPPORTUNITY_TYPE_LABEL[application.opportunityType]}
        </p>
        <p className="t-caption" style={{ color: 'var(--color-text-subtle)' }}>
          Applied {formatDate(application.appliedAt)}
          {application.lastEditedAt && ` · edited ${formatDate(application.lastEditedAt)}`}
        </p>
      </div>
      <div className={styles.right}>
        <StatusTag status={application.status} />
        {application.status === 'OFFER_EXTENDED' && (
          <p className="t-caption" style={{ color: 'var(--color-attention-text)' }}>
            Answer the offer
          </p>
        )}
        {application.canEdit && (
          <p className="t-caption" style={{ color: 'var(--color-text-subtle)' }}>
            Editable
          </p>
        )}
      </div>
    </Link>
  )
}
