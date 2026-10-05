import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ApiError } from '@/api/errors'
import { OPPORTUNITY_TYPE_LABEL, WORK_MODALITY_LABEL, type OpportunityType } from '@/api/enums'
import type { JobSummary } from '@/api/types'
import { ButtonLink } from '@/ui/ButtonLink'
import { EmptyState } from '@/ui/EmptyState'
import { ErrorState } from '@/ui/ErrorState'
import { Icon } from '@/ui/Icon'
import { Skeleton } from '@/ui/Skeleton'
import { useToast } from '@/ui/ToastProvider'
import { formatDateShort, formatRelativeTime } from '@/lib/formatDate'
import { useCompanyAnalytics, useMyCompany, useMyPostings, useUpdatePosting } from './useCompany'
import styles from './CompanyPostingsPage.module.css'

type Filter = 'ALL' | JobSummary['postingStatus']

const TABS: { key: Filter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'PUBLISHED', label: 'Published' },
  { key: 'DRAFT', label: 'Drafts' },
  { key: 'CLOSED', label: 'Closed' },
  { key: 'EXPIRED', label: 'Expired' },
]

const STATUS_LABEL: Record<JobSummary['postingStatus'], string> = {
  DRAFT: 'Draft',
  PUBLISHED: 'Published',
  CLOSED: 'Closed',
  EXPIRED: 'Expired',
}

const TYPE_TONE: Record<OpportunityType, string> = {
  FULL_TIME_JOB: styles.job!,
  PROFESSIONAL_INTERNSHIP: styles.professional!,
  ACADEMIC_INTERNSHIP: styles.academic!,
}

const DAY = 86_400_000

type Counts = { applications: number; newApplications: number }

/** Whole days to the deadline's own date, so the evening before is not zero. */
function daysLeft(iso: string): number {
  const end = new Date(iso)
  end.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((end.getTime() - today.getTime()) / DAY)
}

/** The deadline column: a date, and a line saying what it means for this status. */
function deadlineCell(job: JobSummary): { main: string; note: string } {
  switch (job.postingStatus) {
    case 'DRAFT':
      return {
        main: job.applicationDeadline ? formatDateShort(job.applicationDeadline) : 'Not set',
        note: `Saved ${formatRelativeTime(job.updatedAt ?? job.createdAt)}`,
      }
    case 'CLOSED':
      return {
        main: `Closed ${formatDateShort(job.unpublishedAt ?? job.updatedAt ?? job.createdAt)}`,
        // unpublishedAt is written only when a suspension closes a posting.
        note: job.unpublishedAt ? 'Closed while the account was suspended' : 'Not taking applications',
      }
    case 'EXPIRED':
      return {
        main: job.applicationDeadline ? `Ended ${formatDateShort(job.applicationDeadline)}` : 'Ended',
        note: 'Closed itself on its deadline',
      }
    default: {
      if (!job.applicationDeadline) return { main: 'Not set', note: 'Open until you close it' }
      const days = daysLeft(job.applicationDeadline)
      return {
        main: formatDateShort(job.applicationDeadline),
        note: days <= 0 ? 'Last day' : days === 1 ? '1 day left' : `${days} days left`,
      }
    }
  }
}

function location(job: JobSummary): string {
  if (job.workModality === 'REMOTE') return WORK_MODALITY_LABEL.REMOTE
  return [WORK_MODALITY_LABEL[job.workModality], job.city ?? job.country].filter(Boolean).join(' · ')
}

export function CompanyPostingsPage() {
  const { data: company } = useMyCompany()
  const postings = useMyPostings()
  const analytics = useCompanyAnalytics()
  const [tab, setTab] = useState<Filter>('ALL')
  // The term lives in the URL, so a search from the bar above lands here
  // already filled in.
  const [searchParams, setSearchParams] = useSearchParams()
  const search = searchParams.get('q') ?? ''
  const query = search.trim().toLowerCase()

  function setSearch(next: string) {
    setSearchParams(
      (params) => {
        if (next) params.set('q', next)
        else params.delete('q')
        return params
      },
      { replace: true },
    )
  }

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
      map.set(row.jobId, { applications: row.applications, newApplications: row.newApplications ?? 0 })
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

  const stats = [
    { label: 'Published', value: counts.PUBLISHED ?? 0, foot: 'Visible to applicants now', tone: styles.dotForest },
    { label: 'Drafts', value: counts.DRAFT ?? 0, foot: 'Only you can see these', tone: styles.dotInk },
    {
      label: 'Applicants on open postings',
      value: openApplicants.total,
      foot: openApplicants.unopened > 0 ? `${openApplicants.unopened} not opened yet` : 'All opened',
      tone: styles.dotVerm,
    },
    {
      label: 'Closed or expired',
      value: (counts.CLOSED ?? 0) + (counts.EXPIRED ?? 0),
      foot: 'Kept for your records',
      tone: styles.dotMuted,
    },
  ]

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div className={styles.titles}>
          <h1 className={styles.title}>Postings</h1>
          <p className={styles.subtitle}>
            Everything {companyName ?? 'your company'} has posted. Drafts are visible only to you.
          </p>
        </div>
        <ButtonLink variant="primary" to="/company/postings/new" className={styles.cta}>
          <Icon name="add" size={16} />
          New posting
        </ButtonLink>
      </header>

      <div className={styles.tiles}>
        {stats.map((stat) => (
          <div key={stat.label} className={['glass-soft', styles.tile].join(' ')}>
            <p className={styles.tileLabel}>
              <span className={[styles.dot, stat.tone].join(' ')} aria-hidden="true" />
              {stat.label}
            </p>
            <p className={styles.tileValue}>{stat.value}</p>
            <p className={styles.tileFoot}>{stat.foot}</p>
          </div>
        ))}
      </div>

      <section className={['glass-soft', styles.card].join(' ')} aria-label="Postings">
        <div className={styles.toolbar}>
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
          <label className={styles.search}>
            <Icon name="search" size={16} />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search postings"
              aria-label="Search postings"
              className={styles.searchField}
            />
          </label>
        </div>

        {postings.isPending ? (
          <div className={styles.loading}>
            {[0, 1, 2, 3].map((n) => (
              <Skeleton key={n} height={64} radius="var(--radius-md)" />
            ))}
          </div>
        ) : postings.isError ? (
          <div className={styles.loading}>
            <ErrorState />
          </div>
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
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <colgroup>
                <col />
                <col className={styles.colLocation} />
                <col className={styles.colApplicants} />
                <col className={styles.colDeadline} />
                <col className={styles.colStatus} />
                <col className={styles.colActions} />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">POSTING</th>
                  <th scope="col">LOCATION</th>
                  <th scope="col">APPLICANTS</th>
                  <th scope="col">DEADLINE</th>
                  <th scope="col">STATUS</th>
                  <th scope="col" className={styles.end}>
                    ACTIONS
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
        )}
      </section>
    </div>
  )
}

function PostingRow({ job, counts }: { job: JobSummary; counts?: Counts }) {
  const update = useUpdatePosting(job.jobId)
  const { showToast } = useToast()
  const deadline = deadlineCell(job)
  const status = job.postingStatus
  const applications = counts?.applications ?? 0
  const unopened = counts?.newApplications ?? 0

  function close() {
    update.mutate(
      { postingStatus: 'CLOSED' },
      {
        onSuccess: () => showToast(`${job.title} is closed.`),
        onError: (error) =>
          showToast(error instanceof ApiError ? error.message : 'The posting did not close. Try again.', 'error'),
      },
    )
  }

  return (
    <tr>
      <th scope="row">
        <span className={styles.postingCell}>
          {status === 'DRAFT' ? (
            <span className={styles.postingTitle}>{job.title}</span>
          ) : (
            <Link to={`/company/postings/${job.jobId}/pipeline`} className={styles.postingTitle}>
              {job.title}
            </Link>
          )}
          <span className={[styles.type, TYPE_TONE[job.opportunityType]].join(' ')}>
            {OPPORTUNITY_TYPE_LABEL[job.opportunityType]}
          </span>
        </span>
      </th>
      <td className={styles.location}>{location(job)}</td>
      <td>
        <span className={styles.stack}>
          <span className={styles.figure}>{applications}</span>
          <span className={unopened > 0 ? styles.unopened : styles.note}>
            {status === 'DRAFT'
              ? 'Not published'
              : unopened > 0
                ? `${unopened} not opened yet`
                : applications > 0
                  ? 'All opened'
                  : 'None yet'}
          </span>
        </span>
      </td>
      <td>
        <span className={styles.stack}>
          <span className={styles.deadline}>{deadline.main}</span>
          <span className={styles.note}>{deadline.note}</span>
        </span>
      </td>
      <td>
        <span className={[styles.status, styles[status.toLowerCase()]].join(' ')}>
          <span className={styles.statusDot} aria-hidden="true" />
          {STATUS_LABEL[status]}
        </span>
      </td>
      <td>
        <span className={styles.actions}>
          {status !== 'DRAFT' && (
            <Link to={`/company/postings/${job.jobId}/pipeline`} className={styles.action}>
              Pipeline
            </Link>
          )}
          {/* A closed posting keeps Edit as well, since editing is how it is
              reopened. An expired one stays as it ended. */}
          {status !== 'EXPIRED' && (
            <Link to={`/company/postings/${job.jobId}/edit`} className={styles.action}>
              {status === 'DRAFT' ? 'Continue editing' : 'Edit'}
            </Link>
          )}
          {status === 'PUBLISHED' && (
            <button type="button" className={styles.close} onClick={close} disabled={update.isPending}>
              Close
            </button>
          )}
        </span>
      </td>
    </tr>
  )
}
