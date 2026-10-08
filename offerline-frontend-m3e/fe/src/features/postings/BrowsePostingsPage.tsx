import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { OpportunityType } from '@/api/enums'
import { Button } from '@/ui/Button'
import { EmptyState } from '@/ui/EmptyState'
import { ErrorState } from '@/ui/ErrorState'
import { Icon } from '@/ui/Icon'
import { Skeleton } from '@/ui/Skeleton'
import { OpeningCard } from '@/features/marketing/OpeningCard'
import { fromSearchParams, toSearchParams } from './filterParams'
import { useLocationFacets, usePostingsList } from './usePostings'
import styles from './BrowsePostingsPage.module.css'

const TYPE_PILLS: { value: OpportunityType | undefined; label: string }[] = [
  { value: undefined, label: 'All' },
  { value: 'FULL_TIME_JOB', label: 'Full-time jobs' },
  { value: 'PROFESSIONAL_INTERNSHIP', label: 'Professional internships' },
  { value: 'ACADEMIC_INTERNSHIP', label: 'Academic internships' },
]

/**
 * The canvas puts browsing directly under the landing hero: a search field,
 * a city picker and three type pills, over a grid of the same OpeningCard
 * used there. This is that same browsing surface, reached on its own once a
 * visitor leaves the hero behind (a search submit, a sidebar "Jobs" or
 * "Internships" link, or "Browse all"), so it carries the same controls
 * rather than a denser, unrelated facet panel.
 */
export function BrowsePostingsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = fromSearchParams(searchParams)
  const { data, isLoading, isError, refetch } = usePostingsList(filters)
  const { cities } = useLocationFacets()
  const [query, setQuery] = useState(filters.q ?? '')

  function applyFilters(next: typeof filters) {
    setSearchParams(toSearchParams(next))
  }

  function onSearch(event: FormEvent) {
    event.preventDefault()
    applyFilters({ ...filters, q: query.trim() || undefined })
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className="t-heading-lg">Postings</h1>
        <p className={['t-body', styles.muted].join(' ')}>
          Open roles and internships from verified companies.
        </p>
      </header>

      <form className={styles.search} onSubmit={onSearch} role="search">
        <div className={styles.searchField}>
          <Icon name="search" size={18} />
          <input
            className={styles.searchInput}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search titles and companies"
            aria-label="Search titles and companies"
          />
        </div>
        <select
          className={styles.city}
          value={filters.city ?? ''}
          onChange={(event) => applyFilters({ ...filters, city: event.target.value || undefined })}
          aria-label="City"
        >
          <option value="">All cities</option>
          {cities.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <Button type="submit" variant="primary">
          Search
        </Button>
      </form>

      <div className={styles.pills}>
        {TYPE_PILLS.map((pill) => (
          <button
            key={pill.label}
            type="button"
            aria-pressed={filters.type === pill.value}
            className={[styles.pill, filters.type === pill.value ? styles.pillOn : ''].join(' ')}
            onClick={() => applyFilters({ ...filters, type: pill.value })}
          >
            {pill.label}
          </button>
        ))}
      </div>

      {isError && (
        <ErrorState
          body="Could not load postings."
          action={
            <Button variant="secondary" onClick={() => refetch()}>
              Try again
            </Button>
          }
        />
      )}

      {isLoading && (
        <div className={styles.grid}>
          <Skeleton height={220} radius="var(--radius-lg)" />
          <Skeleton height={220} radius="var(--radius-lg)" />
          <Skeleton height={220} radius="var(--radius-lg)" />
        </div>
      )}

      {data && (
        <>
          <p className={['t-caption', styles.muted].join(' ')}>
            {data.count} posting{data.count === 1 ? '' : 's'}
          </p>
          {data.jobs.length === 0 ? (
            <EmptyState art="search" heading="No postings match these filters" body="Try a different search, or clear the filters above." />
          ) : (
            <div className={styles.grid}>
              {data.jobs.map((job) => (
                <OpeningCard key={job.jobId} job={job} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
