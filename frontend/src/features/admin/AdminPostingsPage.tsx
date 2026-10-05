import { useSearchParams } from 'react-router-dom'
import { OPPORTUNITY_TYPE_LABEL, WORK_MODALITY_LABEL, type OpportunityType } from '@/api/enums'
import type { JobSummary } from '@/api/types'
import { ErrorState } from '@/ui/ErrorState'
import { Skeleton } from '@/ui/Skeleton'
import { formatDateShort } from '@/lib/formatDate'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { usePostingsList } from '@/features/postings/usePostings'
import { STACKED_QUERY } from './adminFormat'
import { PostingDrawer } from './PostingDrawer'
import { CompanyMark } from './VerificationTag'
import pageStyles from './AdminPage.module.css'
// The same list frame as the companies page: tabs, a toolbar and a table.
import listStyles from './AdminCompaniesPage.module.css'
import styles from './AdminPostingsPage.module.css'

type Tab = OpportunityType | 'ALL'

const TABS: { key: Tab; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'FULL_TIME_JOB', label: 'Jobs' },
  { key: 'PROFESSIONAL_INTERNSHIP', label: 'Professional internships' },
  { key: 'ACADEMIC_INTERNSHIP', label: 'Academic internships' },
]

/** GET /jobs returns at most this many, newest first. */
const LISTING_LIMIT = 100

const TYPE_TONE: Record<OpportunityType, string> = {
  FULL_TIME_JOB: styles.job!,
  PROFESSIONAL_INTERNSHIP: styles.professional!,
  ACADEMIC_INTERNSHIP: styles.academic!,
}

function isTab(value: string | null): value is Tab {
  return TABS.some((tab) => tab.key === value)
}

function matches(job: JobSummary, term: string): boolean {
  if (!term) return true
  return `${job.title} ${job.companyName}`.toLowerCase().includes(term.toLowerCase())
}

function place(job: JobSummary): string {
  if (job.workModality === 'REMOTE') return WORK_MODALITY_LABEL.REMOTE
  return [WORK_MODALITY_LABEL[job.workModality], job.city].filter(Boolean).join(', ')
}

/**
 * FR-9.2: every posting applicants can see right now, with the way to take one
 * down. It reads the public listing, which holds exactly the postings that are
 * live and whose deadline has not passed.
 */
export function AdminPostingsPage() {
  const [params, setParams] = useSearchParams()
  const requested = params.get('type')
  const tab: Tab = isTab(requested) ? requested : 'ALL'
  const term = (params.get('q') ?? '').trim()
  const openId = params.get('posting')
  const stacked = useMediaQuery(STACKED_QUERY)

  // The same query as the browse page with no filter, so the two share one read.
  const listing = usePostingsList({})
  const jobs = listing.data?.jobs ?? []
  const searched = jobs.filter((job) => matches(job, term))
  const shown = tab === 'ALL' ? searched : searched.filter((job) => job.opportunityType === tab)
  const full = (listing.data?.count ?? 0) >= LISTING_LIMIT

  function count(key: Tab): string {
    if (!listing.data) return ''
    return String(key === 'ALL' ? searched.length : searched.filter((job) => job.opportunityType === key).length)
  }

  function update(changes: Record<string, string | null>, replace = true) {
    setParams(
      (current) => {
        const copy = new URLSearchParams(current)
        for (const [key, value] of Object.entries(changes)) {
          if (value === null) copy.delete(key)
          else copy.set(key, value)
        }
        return copy
      },
      { replace },
    )
  }

  return (
    <div className={[pageStyles.page, listStyles.fill].join(' ')}>
      <header className={pageStyles.head}>
        <div className={pageStyles.titles}>
          <h1 className={pageStyles.title}>Postings</h1>
          <p className={pageStyles.subtitle}>Every posting applicants can see right now, and the way to take one down.</p>
        </div>
      </header>

      <section className={['glass-soft', listStyles.card].join(' ')} aria-label="Live postings">
        <div className={listStyles.toolbar}>
          <div className={listStyles.tabs} role="tablist" aria-label="Opportunity type">
            {TABS.map((item) => (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={tab === item.key}
                className={[listStyles.tab, tab === item.key ? listStyles.tabActive : ''].join(' ')}
                onClick={() => update({ type: item.key === 'ALL' ? null : item.key })}
              >
                {item.label}
                <span className={listStyles.tabCount}>{count(item.key)}</span>
              </button>
            ))}
          </div>
          {term && (
            <p className={listStyles.searching}>
              {shown.length === 1 ? '1 match' : `${shown.length} matches`} for “{term}”
              <button type="button" className={listStyles.clear} onClick={() => update({ q: null })}>
                Clear search
              </button>
            </p>
          )}
        </div>

        {full && (
          <p className={styles.limit}>
            Showing the newest {LISTING_LIMIT} live postings, which is as many as one read returns. Search looks
            within these.
          </p>
        )}

        {listing.isError ? (
          <div className={listStyles.state}>
            <ErrorState />
          </div>
        ) : listing.isPending ? (
          <div className={listStyles.loading}>
            {[0, 1, 2, 3].map((row) => (
              <Skeleton key={row} height={52} radius="var(--radius-md)" />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <div className={listStyles.state}>
            <p className={listStyles.empty}>
              {term
                ? `No live posting matches “${term}”.`
                : jobs.length === 0
                  ? 'No posting is live right now.'
                  : 'No live posting of this type.'}
            </p>
          </div>
        ) : stacked ? (
          <ul className={listStyles.list}>
            {shown.map((job) => (
              <li key={job.jobId}>
                <button
                  type="button"
                  className={[listStyles.item, job.jobId === openId ? listStyles.itemCurrent : ''].join(' ')}
                  onClick={() => update({ posting: job.jobId }, false)}
                  aria-haspopup="dialog"
                >
                  <CompanyMark name={job.companyName} size="sm" />
                  <span className={listStyles.itemMain}>
                    <span className={listStyles.itemTop}>
                      <span className={listStyles.itemName}>{job.title}</span>
                      <span className={[styles.type, TYPE_TONE[job.opportunityType]].join(' ')}>
                        {OPPORTUNITY_TYPE_LABEL[job.opportunityType]}
                      </span>
                    </span>
                    <span className={listStyles.itemSub}>
                      {job.companyName} · {place(job)}
                    </span>
                    <span className={listStyles.itemMeta}>
                      Posted {formatDateShort(job.createdAt)}
                      {job.applicationDeadline ? ` · Closes ${formatDateShort(job.applicationDeadline)}` : ''}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className={listStyles.tableWrap}>
            <table className={[listStyles.table, styles.table].join(' ')}>
              <colgroup>
                <col />
                <col className={styles.colCompany} />
                <col className={styles.colPlace} />
                <col className={styles.colDate} />
                <col className={styles.colDate} />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">POSTING</th>
                  <th scope="col">COMPANY</th>
                  <th scope="col">PLACE</th>
                  <th scope="col">POSTED</th>
                  <th scope="col">CLOSES</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((job) => (
                  <tr
                    key={job.jobId}
                    className={[listStyles.row, job.jobId === openId ? listStyles.rowCurrent : ''].join(' ')}
                    onClick={() => update({ posting: job.jobId }, false)}
                  >
                    <th scope="row">
                      <span className={listStyles.stack}>
                        <button
                          type="button"
                          className={listStyles.name}
                          onClick={(event) => {
                            event.stopPropagation()
                            update({ posting: job.jobId }, false)
                          }}
                          aria-haspopup="dialog"
                        >
                          {job.title}
                        </button>
                        <span className={[styles.type, TYPE_TONE[job.opportunityType]].join(' ')}>
                          {OPPORTUNITY_TYPE_LABEL[job.opportunityType]}
                        </span>
                      </span>
                    </th>
                    <td>
                      <span className={styles.company}>
                        <CompanyMark name={job.companyName} size="sm" />
                        <span className={listStyles.contact}>{job.companyName}</span>
                      </span>
                    </td>
                    <td>
                      <span className={listStyles.contact}>{place(job)}</span>
                    </td>
                    <td>
                      <span className={listStyles.figure}>{formatDateShort(job.createdAt)}</span>
                    </td>
                    <td>
                      <span className={listStyles.figure}>
                        {job.applicationDeadline ? formatDateShort(job.applicationDeadline) : 'Not set'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {openId && (
        <PostingDrawer
          key={openId}
          jobId={openId}
          listed={jobs.find((job) => job.jobId === openId)}
          onClose={() => update({ posting: null })}
        />
      )}
    </div>
  )
}
