import { PageHeader } from '@/ui/PageHeader'
import { Skeleton } from '@/ui/Skeleton'
import { EmptyState } from '@/ui/EmptyState'
import { ButtonLink } from '@/ui/ButtonLink'
import { formatDate } from '@/lib/formatDate'
import { CvUploadCard } from './CvUploadCard'
import { useCvs } from './useProfile'

export function CvLibraryPage() {
  const { data, isLoading } = useCvs()

  return (
    <div>
      <PageHeader title="CVs" />
      <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
        <CvUploadCard />

        {isLoading && <Skeleton height={200} radius="var(--radius-xl)" />}

        {data && data.cvs.length === 0 && (
          <EmptyState
            art="docs"
            heading="No CVs yet"
            body="Upload a CV and it will be offered the next time you apply."
          />
        )}

        {data && data.cvs.length > 0 && (
          <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
            {data.cvs.map((cv) => (
              <div key={cv.cvId} className="glass-dense" style={{ padding: 'var(--space-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p className="t-heading-sm">{cv.label}</p>
                  <p className="t-caption" style={{ color: 'var(--color-text-subtle)' }}>
                    Uploaded {formatDate(cv.uploadedAt)}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                  <a
                    href={cv.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="t-body-sm"
                    style={{ color: 'var(--color-text-link)', textDecoration: 'underline' }}
                  >
                    Open
                  </a>
                  <ButtonLink variant="quiet" to="/postings">
                    Use in an application
                  </ButtonLink>
                </div>
              </div>
            ))}
            {data.totalUploaded > data.cvs.length && (
              <p className="t-caption" style={{ color: 'var(--color-text-subtle)' }}>
                Your ten most recent uploads are shown.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
