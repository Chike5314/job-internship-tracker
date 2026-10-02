import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { StatusTag } from '@/ui/StatusTag'
import { BackLink } from '@/ui/BackLink'
import { EmptyState } from '@/ui/EmptyState'
import { Skeleton } from '@/ui/Skeleton'
import { formatDate } from '@/lib/formatDate'
import { ApplicationActions } from './ApplicationActions'
import { InterviewPanel } from './InterviewPanel'
import { SubmittedItemsPanel } from './SubmittedItemsPanel'
import { StatusHistoryTimeline } from './StatusHistoryTimeline'
import { EditApplicationPanel } from './EditApplicationPanel'
import { useApplication } from './useApplications'

export function ApplicationDetailPage() {
  const { applicationId } = useParams<{ applicationId: string }>()
  const { data, isLoading, isError } = useApplication(applicationId!)
  const [editing, setEditing] = useState(false)

  if (isLoading) return <Skeleton height={320} radius="var(--radius-xl)" />
  if (isError || !data) return <EmptyState heading="Application not found" />

  const { application } = data

  if (editing) {
    return (
      <div>
        <BackLink to={`/applications/${application.applicationId}`}>Back to the application</BackLink>
        <EditApplicationPanel application={application} onDone={() => setEditing(false)} />
      </div>
    )
  }

  return (
    <div>
      <BackLink to="/applications">All applications</BackLink>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-4)' }}>
        <div>
          <h1 className="t-display-md">{application.jobTitle}</h1>
          <p className="t-body-sm" style={{ color: 'var(--color-text-muted)' }}>
            {application.companyName} · Applied {formatDate(application.appliedAt)}
          </p>
        </div>
        <StatusTag status={application.status} />
      </div>

      <div style={{ marginTop: 'var(--space-4)' }}>
        <ApplicationActions application={application} onEdit={() => setEditing(true)} />
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-5)', marginTop: 'var(--space-6)' }}>
        {application.interviews.length > 0 && (
          <InterviewPanel applicationId={application.applicationId} interviews={application.interviews} />
        )}

        <div className="glass-dense" style={{ padding: 'var(--space-5)' }}>
          <SubmittedItemsPanel
            requirements={application.documentRequirements}
            documentUrls={application.documentUrls}
            answers={application.answers}
          />
        </div>

        {application.coverLetter && (
          <div className="glass-dense" style={{ padding: 'var(--space-5)' }}>
            <p className="t-eyebrow" style={{ textTransform: 'uppercase', marginBottom: 'var(--space-3)' }}>
              Message to the recruiter
            </p>
            <p className="t-body-sm" style={{ whiteSpace: 'pre-wrap' }}>
              {application.coverLetter}
            </p>
          </div>
        )}

        <div className="glass-dense" style={{ padding: 'var(--space-5)' }}>
          <StatusHistoryTimeline history={application.statusHistory} />
        </div>
      </div>
    </div>
  )
}
