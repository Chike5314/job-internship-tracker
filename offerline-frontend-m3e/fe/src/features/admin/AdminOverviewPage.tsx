import { useState } from 'react'
import { Link } from 'react-router-dom'
import { COMPANY_PAGE_LIMIT } from '@/api/admin'
import { VERIFICATION_STATUSES, type VerificationStatus } from '@/api/enums'
import type { CompanyFull } from '@/api/types'
import { ErrorState } from '@/ui/ErrorState'
import { Icon, type IconName } from '@/ui/Icon'
import { Skeleton } from '@/ui/Skeleton'
import { formatLongDate } from '@/lib/formatDate'
import { host, waitingFor } from './adminFormat'
import { CompanyMark, VerificationTag } from './VerificationTag'
import { useAdminOverview, useCompaniesByStatus } from './useAdmin'
import pageStyles from './AdminPage.module.css'
import styles from './AdminOverviewPage.module.css'

/** How many waiting companies the overview lists before pointing to the rest. */
const QUEUE_ROWS = 6
const NUMBER = new Intl.NumberFormat('en')

function queueLine(waiting: number | undefined): string {
  if (waiting === undefined) return ' '
  if (waiting === 0) return 'No company is waiting for verification.'
  if (waiting === 1) return 'One company is waiting for verification.'
  return `${NUMBER.format(waiting)} companies are waiting for verification.`
}

/**
 * The admin's home (FR-9.5): how the platform stands, how the companies divide
 * by standing, and the queue, which is the part an admin acts on.
 */
export function AdminOverviewPage() {
  const overview = useAdminOverview()
  const pending = useCompaniesByStatus('PENDING_VERIFICATION')
  const verified = useCompaniesByStatus('VERIFIED')
  const rejected = useCompaniesByStatus('REJECTED')
  const suspended = useCompaniesByStatus('SUSPENDED')
  // Read once on arrival, so a wait does not tick over under the reader.
  const [now] = useState(() => Date.now())

  const counts = overview.data?.approximateCounts
  const waiting = overview.data?.awaitingVerification ?? pending.data?.count
  const byStatus: Record<VerificationStatus, typeof pending> = {
    PENDING_VERIFICATION: pending,
    VERIFIED: verified,
    REJECTED: rejected,
    SUSPENDED: suspended,
  }

  return (
    <div className={pageStyles.page}>
      <header className={pageStyles.head}>
        <div className={pageStyles.titles}>
          <h1 className={pageStyles.title}>Overview</h1>
          <p className={pageStyles.subtitle}>{queueLine(waiting)}</p>
        </div>
        <p className={styles.today}>{formatLongDate(new Date(now))}</p>
      </header>

      {overview.isError ? (
        <ErrorState />
      ) : (
        <div className={styles.figures}>
          <div className={styles.tiles}>
            <Tile icon="person" label="Users" value={counts?.users} foot="Applicants and administrators" />
            <Tile
              icon="company"
              label="Companies"
              value={counts?.companies}
              foot={
                waiting
                  ? `${NUMBER.format(waiting)} waiting for verification`
                  : waiting === 0
                    ? 'None waiting for verification'
                    : ' '
              }
              attention={Boolean(waiting)}
              to={waiting ? '/admin/companies?status=PENDING_VERIFICATION' : undefined}
            />
            <Tile icon="posting" label="Postings" value={counts?.postings} foot="Drafts, live and closed" />
            <Tile icon="applications" label="Applications" value={counts?.applications} foot="Across every posting" />
          </div>
          <p className={styles.approximate}>
            <Icon name="info" size={14} />
            These four are approximate and catch up within about six hours. The number waiting for verification is
            exact.
          </p>
        </div>
      )}

      <div className={styles.columns}>
        <section className={['glass-soft', styles.card].join(' ')} aria-labelledby="queue-title">
          <header className={styles.cardHead}>
            <div className={styles.cardTitles}>
              <h2 id="queue-title" className={styles.cardTitle}>
                Waiting for verification
              </h2>
              <p className={styles.cardNote}>
                Longest waiting first. A company can write drafts, but publishes nothing until it is approved.
              </p>
            </div>
            <Link to="/admin/companies?status=PENDING_VERIFICATION" className={styles.more}>
              All companies
            </Link>
          </header>
          <Queue query={pending} now={now} />
        </section>

        <section className={['glass-soft', styles.card].join(' ')} aria-labelledby="standing-title">
          <header className={styles.cardHead}>
            <div className={styles.cardTitles}>
              <h2 id="standing-title" className={styles.cardTitle}>
                Companies by standing
              </h2>
              <p className={styles.cardNote}>Exact counts, each from its own list.</p>
            </div>
          </header>
          <Standing byStatus={byStatus} />
        </section>
      </div>
    </div>
  )
}

function Tile({
  icon,
  label,
  value,
  foot,
  attention = false,
  to,
}: {
  icon: IconName
  label: string
  value?: number
  foot: string
  attention?: boolean
  to?: string
}) {
  return (
    <div className={['glass-soft', styles.tile].join(' ')}>
      <p className={styles.tileLabel}>
        <Icon name={icon} size={16} />
        {label}
      </p>
      {value === undefined ? (
        <Skeleton width={84} height={30} />
      ) : (
        <p className={styles.tileValue}>{NUMBER.format(value)}</p>
      )}
      {to ? (
        <Link to={to} className={[styles.tileFoot, attention ? styles.tileUrgent : ''].join(' ')}>
          {foot}
          <Icon name="chevron-right" size={14} />
        </Link>
      ) : (
        <p className={styles.tileFoot}>{foot}</p>
      )}
    </div>
  )
}

function Queue({
  query,
  now,
}: {
  query: ReturnType<typeof useCompaniesByStatus>
  now: number
}) {
  if (query.isPending) {
    return (
      <div className={styles.loading}>
        <Skeleton height={56} radius="var(--radius-md)" />
        <Skeleton height={56} radius="var(--radius-md)" />
        <Skeleton height={56} radius="var(--radius-md)" />
      </div>
    )
  }
  if (query.isError) return <ErrorState />

  const all = [...(query.data?.companies ?? [])].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )
  if (all.length === 0) {
    return (
      <p className={styles.empty}>
        <Icon name="confirm" size={18} />
        Nobody is waiting. Every company that has registered has a decision.
      </p>
    )
  }

  const shown = all.slice(0, QUEUE_ROWS)
  const more = all.length - shown.length
  return (
    <>
      <ul className={styles.queue}>
        {shown.map((company) => (
          <QueueRow key={company.companyId} company={company} now={now} />
        ))}
      </ul>
      {more > 0 && (
        <Link to="/admin/companies?status=PENDING_VERIFICATION" className={styles.queueMore}>
          And {more} more waiting
          <Icon name="chevron-right" size={14} />
        </Link>
      )}
    </>
  )
}

function QueueRow({ company, now }: { company: CompanyFull; now: number }) {
  const site = host(company.companyWebsiteUrl)
  return (
    <li className={styles.row}>
      <CompanyMark name={company.companyName} logoUrl={company.logoUrl} />
      <span className={styles.rowName}>
        <span className={styles.name}>{company.companyName}</span>
        <span className={styles.rowSub}>{[site, company.contactEmail].filter(Boolean).join(' · ')}</span>
      </span>
      <span className={styles.waiting}>{waitingFor(company.createdAt, now)}</span>
      <Link
        to={`/admin/companies?status=PENDING_VERIFICATION&company=${encodeURIComponent(company.companyId)}`}
        className={styles.review}
        aria-label={`Review ${company.companyName}`}
      >
        Review
      </Link>
    </li>
  )
}

function Standing({ byStatus }: { byStatus: Record<VerificationStatus, ReturnType<typeof useCompaniesByStatus>> }) {
  const loaded = VERIFICATION_STATUSES.every((status) => byStatus[status].data)
  if (!loaded && VERIFICATION_STATUSES.some((status) => byStatus[status].isError)) return <ErrorState />

  const count = (status: VerificationStatus) => byStatus[status].data?.count ?? 0
  const total = VERIFICATION_STATUSES.reduce((sum, status) => sum + count(status), 0)
  // A list returns at most one page, so a full page is shown as "at least".
  const full = (status: VerificationStatus) => count(status) >= COMPANY_PAGE_LIMIT

  return (
    <>
      <ul className={styles.standing}>
        {VERIFICATION_STATUSES.map((status) => {
          const n = count(status)
          return (
            <li key={status}>
              <Link to={`/admin/companies?status=${status}`} className={styles.standingRow}>
                <VerificationTag status={status} />
                <span className={styles.bar} aria-hidden="true">
                  <span
                    className={[styles.barFill, styles[`fill${status}`]].join(' ')}
                    // A small share keeps a sliver so it reads as some; none shows nothing.
                    style={{ width: n > 0 && total > 0 ? `${Math.max(2, (n / total) * 100)}%` : '0%' }}
                  />
                </span>
                <span className={styles.standingCount}>
                  {byStatus[status].data ? `${NUMBER.format(n)}${full(status) ? '+' : ''}` : '·'}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
      {loaded && (
        <p className={styles.total}>
          {NUMBER.format(total)}
          {VERIFICATION_STATUSES.some(full) ? '+' : ''} compan{total === 1 ? 'y' : 'ies'} in all
        </p>
      )}
    </>
  )
}
