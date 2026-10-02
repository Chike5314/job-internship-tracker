import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { OPPORTUNITY_TYPE_LABEL, WORK_MODALITY_LABEL } from '@/api/enums'
import type { JobSummary } from '@/api/types'
import { ButtonLink } from '@/ui/ButtonLink'
import { Button } from '@/ui/Button'
import { EmptyState } from '@/ui/EmptyState'
import { ErrorState } from '@/ui/ErrorState'
import { Icon } from '@/ui/Icon'
import { Input } from '@/ui/Input'
import { PageHeader } from '@/ui/PageHeader'
import { Skeleton } from '@/ui/Skeleton'
import { formatDate } from '@/lib/formatDate'
import { useDebouncedValue } from '@/lib/useDebouncedValue'
import { useCompanyAnalytics, useMyCompany, useMyPostings, useUpdatePosting } from './useCompany'
import { StatTile } from '@/features/dashboard/StatTile'
import styles from './CompanyPostingsPage.module.css'

type Filter = 'ALL' | JobSummary['postingStatus']

const TABS: { key: Filter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'PUBLISHED', label: 'Published' },
  { key: 'DRAFT', label: 'Drafts' },
  { key: 'CLOSED', label: 'Closed' },
  { key: 'EXPIRED', label: 'Expired' },
]

/** Whole days from now until the deadline, floored, so "1 day left" means a
 *  full day remains rather than a few minutes of one. */
function daysLeft(iso: string): number {
  return Math.floor((new Date(iso).getTime() - Date.now()) / 86_400_000)
}

type Counts = { applications: number; newApplications: number }

const STATUS_LABEL: Record<JobSummary['postingStatus'], string> = {
  DRAFT: 'Draft',
  PUBLISHED: 'Published',
  CLOSED: 'Closed',
  EXPIRED: 'Expired',
}

export function CompanyPostingsPage() {
  const { data: company } = useMyCompany()
  const postings = useMyPostings()
  const analytics = useCompanyAnalytics()
  const [tab, setTab] = useState<Filter>('ALL')
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  // The hook settles a callback rather than returning a value, so the settled
  // term lives in its own state and the input stays responsive.
  useDebouncedValue(search, 200, (settled) => setQuery(settled.trim().toLowerCase()))

  const all = useMemo(() => postings.data?.jobs ?? [], [postings.data])

  const counts = useMemo(() => {
    const tally: Record<string, number> = { ALL: all.length }
    for (const job of all) tally[job.postingStatus] = (tally[job.postingStatus] ?? 0) + 1
    return tally
  }, [all])

  const rows = useMemo(() => {
    return all
      .filter((job) => (tab === 'ALL' ? true : job.postingStatus === tab))
      .filter((job) => (query ? job.title.toLowerCase().includes(query) : true))
      .sort((a, b) => (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt))
  }, [all, tab, query])

  // The postings list and the per-posting counts come from two endpoints, so
  // the counts are looked up by jobId rather than assumed to be in step.
  const countsByJob = useMemo(() => {
    const map = new Map<string, Counts>()
    for (const row of analytics.data?.perPosting ?? []) {
      map.set(row.jobId, {
        applications: row.applications,
        newApplications: row.newApplications ?? 0,
      })
    }
    return map
  }, [analytics.data])

  const openApplicants = useMemo(() => {
    let total = 0
    let unopened = 0
    for (const job of all) {
      if (job.postingStatus !== 'PUBLISHED') continue
      const row = countsByJob.get(job.jobId)
      total += row?.applications ?? 0
      unopened += row?.newApplications ?? 0
    }
    return { total, unopened }
  }, [all, countsByJob])

  const companyName = company?.company.companyName

  return (
    <div className={styles.page}>
      <PageHeader
        title="Postings"
        action={
          <ButtonLink variant="primary" to="/company/postings/new">
            New posting
          </ButtonLink>
        }
      >
        <p className={['t-body', styles.muted].join(' ')}>
          Everything {companyName ?? 'your company'} has posted. Drafts are visible only to you.
        </p>
      </PageHeader>

      <div className={styles.tiles}>
        <StatTile
          label="Published"
          value={counts.PUBLISHED ?? 0}
          icon="posting"
          note={`${counts.DRAFT ?? 0} in draft`}
        />
        <StatTile
          label="Drafts"
          value={counts.DRAFT ?? 0}
          icon="edit"
          note="Only you can see these"
        />
        <StatTile
          label="Applicants on open postings"
          value={openApplicants.total}
          icon="account"
          note={
            openApplicants.unopened > 0
              ? `${openApplicants.unopened} not opened yet`
              : 'All opened'
          }
          urgent={openApplicants.unopened > 0}
        />
        <StatTile
          label="Closed or expired"
          value={(counts.CLOSED ?? 0) + (counts.EXPIRED ?? 0)}
          icon="history"
          note="Kept for your records"
        />
      </div>

      <div className={styles.controls}>
        <div className={styles.tabs} role="tablist" aria-label="Filter postings by status">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={tab === item.key}
              className={[styles.tab, tab === item.key ? styles.tabActive : ''].join(' ')}
              onClick={() => setTab(item.key)}
            >
              {item.label}
              <span className={styles.tabCount}>{counts[item.key] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className={styles.search}>
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search postings"
            aria-label="Search postings"
          />
        </div>
      </div>

      {postings.isPending ? (
        <div className={styles.loading}>
          {[0, 1, 2, 3].map((n) => (
            <Skeleton key={n} height={64} />
          ))}
        </div>
      ) : postings.isError ? (
        <ErrorState />
      ) : rows.length === 0 ? (
        <EmptyState
          heading={all.length === 0 ? 'No postings here yet' : 'Nothing matches that'}
          body={
            all.length === 0
              ? 'A posting starts as a draft. Nothing reaches applicants until you publish it.'
              : 'Try another status or clear the search.'
          }
          action={
            all.length === 0 ? (
              <ButtonLink variant="primary" to="/company/postings/new">
                New posting
              </ButtonLink>
            ) : undefined
          }
        />
      ) : (
        <PostingTable rows={rows} countsByJob={countsByJob} />
      )}
    </div>
  )
}

function PostingTable({
  rows,
  countsByJob,
}: {
  rows: JobSummary[]
  countsByJob: Map<string, Counts>
}) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Posting</th>
            <th scope="col">Location</th>
            <th scope="col">Applicants</th>
            <th scope="col">Deadline</th>
            <th scope="col">Status</th>
            <th scope="col">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((job) => (
            <PostingRow key={job.jobId} job={job} counts={countsByJob.get(job.jobId)} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PostingRow({ job, counts }: { job: JobSummary; counts?: Counts }) {
  const update = useUpdatePosting(job.jobId)
  const place = [job.city, job.country].filter(Boolean).join(', ')

  return (
    <tr>
      <th scope="row">
        <Link to={`/company/postings/${job.jobId}/pipeline`} className={styles.title}>
          {job.title}
        </Link>
        <span className={['t-body-sm', styles.muted].join(' ')}>
          {OPPORTUNITY_TYPE_LABEL[job.opportunityType]}
          {job.openings ? ` · ${job.openings} opening${job.openings === 1 ? '' : 's'}` : ''}
        </span>
      </th>
      <td>
        <span className="t-body-sm">{WORK_MODALITY_LABEL[job.workModality]}</span>
        {place && <span className={['t-body-sm', styles.muted].join(' ')}>{place}</span>}
      </td>
      <td>
        <span className={['t-figure', styles.applicants].join(' ')}>{counts?.applications ?? 0}</span>
        {counts && counts.newApplications > 0 ? (
          <span className={['t-caption', styles.unopened].join(' ')}>
            {counts.newApplications} not opened yet
          </span>
        ) : (
          <span className={['t-caption', styles.muted].join(' ')}>
            {counts?.applications ? 'All opened' : 'None yet'}
          </span>
        )}
      </td>
      <td>
        {job.applicationDeadline ? (
          <>
            <span className="t-body-sm">{formatDate(job.applicationDeadline)}</span>
            <span className={['t-caption', styles.muted].join(' ')}>
              {daysLeft(job.applicationDeadline) >= 0
                ? `${daysLeft(job.applicationDeadline)} day${daysLeft(job.applicationDeadline) === 1 ? '' : 's'} left`
                : 'Deadline passed'}
            </span>
          </>
        ) : (
          <span className={['t-body-sm', styles.muted].join(' ')}>Not set</span>
        )}
      </td>
      <td>
        <span className={[styles.status, styles[job.postingStatus.toLowerCase()]].join(' ')}>
          {STATUS_LABEL[job.postingStatus]}
        </span>
      </td>
      <td className={styles.actions}>
        <Link to={`/company/postings/${job.jobId}/pipeline`} className={styles.action}>
          <Icon name="bulk" size={16} />
          Pipeline
        </Link>
        <Link to={`/company/postings/${job.jobId}/edit`} className={styles.action}>
          <Icon name="edit" size={16} />
          {job.postingStatus === 'DRAFT' ? 'Continue' : 'Edit'}
        </Link>
        {job.postingStatus === 'PUBLISHED' && (
          <Button
            variant="quiet"
            loading={update.isPending}
            onClick={() => update.mutate({ postingStatus: 'CLOSED' })}
          >
            Close
          </Button>
        )}
      </td>
    </tr>
  )
}
