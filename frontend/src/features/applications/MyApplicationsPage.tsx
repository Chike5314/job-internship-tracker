import { useState } from 'react'
import { APPLICATION_STATUS_LABEL, ALL_STATUSES, type ApplicationStatus } from '@/api/enums'
import { PageHeader } from '@/ui/PageHeader'
import { Chip } from '@/ui/Chip'
import { EmptyState } from '@/ui/EmptyState'
import { ErrorState } from '@/ui/ErrorState'
import { Skeleton } from '@/ui/Skeleton'
import { ButtonLink } from '@/ui/ButtonLink'
import { ApplicationRow } from './ApplicationRow'
import { useMyApplications } from './useApplications'

export function MyApplicationsPage() {
  const { data, isLoading, isError } = useMyApplications()
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | null>(null)

  const applications = data?.applications ?? []
  const counts = new Map<ApplicationStatus, number>()
  for (const application of applications) {
    counts.set(application.status, (counts.get(application.status) ?? 0) + 1)
  }

  const visible = statusFilter ? applications.filter((a) => a.status === statusFilter) : applications

  return (
    <div>
      <PageHeader title="Applications" />

      {isLoading && (
        <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
          <Skeleton height={88} radius="var(--radius-md)" />
          <Skeleton height={88} radius="var(--radius-md)" />
        </div>
      )}

      {isError && <ErrorState body="Could not load your applications." />}

      {data && applications.length === 0 && (
        <EmptyState
          heading="No applications yet"
          body="Browse postings and apply to the ones that fit."
          action={<ButtonLink to="/postings">Browse postings</ButtonLink>}
        />
      )}

      {data && applications.length > 0 && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
            <Chip selected={statusFilter === null} onClick={() => setStatusFilter(null)}>
              All ({applications.length})
            </Chip>
            {ALL_STATUSES.filter((status) => counts.has(status)).map((status) => (
              <Chip key={status} selected={statusFilter === status} onClick={() => setStatusFilter(status)}>
                {APPLICATION_STATUS_LABEL[status]} ({counts.get(status)})
              </Chip>
            ))}
          </div>

          <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
            {visible.map((application) => (
              <ApplicationRow key={application.applicationId} application={application} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
