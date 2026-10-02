import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/ui/PageHeader'
import { EmptyState } from '@/ui/EmptyState'
import { ErrorState } from '@/ui/ErrorState'
import { Skeleton } from '@/ui/Skeleton'
import { PostingCard } from './PostingCard'
import { PostingFilters } from './PostingFilters'
import { usePostingsList } from './usePostings'
import { fromSearchParams, toSearchParams } from './filterParams'
import styles from './BrowsePostingsPage.module.css'

export function BrowsePostingsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = fromSearchParams(searchParams)
  const { data, isLoading, isError, refetch } = usePostingsList(filters)

  return (
    <div>
      <PageHeader title="Postings" />
      <div className={styles.layout}>
        <PostingFilters filters={filters} onChange={(next) => setSearchParams(toSearchParams(next))} />

        <div>
          {isLoading && (
            <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
              <Skeleton height={96} radius="var(--radius-md)" />
              <Skeleton height={96} radius="var(--radius-md)" />
              <Skeleton height={96} radius="var(--radius-md)" />
            </div>
          )}

          {isError && <ErrorState body="Could not load postings." action={<button onClick={() => refetch()}>Try again</button>} />}

          {data && (
            <>
              <p className="t-caption" style={{ color: 'var(--color-text-subtle)', marginBottom: 'var(--space-3)' }}>
                Showing {data.count} posting{data.count === 1 ? '' : 's'}
              </p>
              {data.jobs.length === 0 ? (
                <EmptyState heading="No postings match these filters" body="Try widening your search." />
              ) : (
                <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                  {data.jobs.map((job) => (
                    <PostingCard key={job.jobId} job={job} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
