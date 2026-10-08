import { Link } from 'react-router-dom'
import { APPLICATION_STATUS_LABEL, OPPORTUNITY_TYPE_LABEL, type ApplicationStatus } from '@/api/enums'
import type { FunnelCounts } from '@/api/types'
import { EmptyState } from '@/ui/EmptyState'
import { ErrorState } from '@/ui/ErrorState'
import { PageHeader } from '@/ui/PageHeader'
import { Skeleton } from '@/ui/Skeleton'
import { useCompanyAnalytics } from './useCompany'
import styles from './CompanyAnalyticsPage.module.css'

/**
 * The funnel in the order an application actually moves through, which is not
 * the alphabetical order the API returns the counts in. The three ways an
 * application ends are read separately, below, because they are outcomes rather
 * than stages and stacking them on the same axis would imply a sequence that
 * does not exist.
 */
const STAGES: ApplicationStatus[] = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'INTERVIEW_SCHEDULED',
  'OFFER_EXTENDED',
  'OFFER_ACCEPTED',
]

const ENDINGS: ApplicationStatus[] = ['REJECTED', 'OFFER_DECLINED', 'WITHDRAWN']

export function CompanyAnalyticsPage() {
  const analytics = useCompanyAnalytics()

  if (analytics.isPending) {
    return (
      <div className={styles.page}>
        <PageHeader title="Analytics" />
        <Skeleton height={320} />
      </div>
    )
  }

  if (analytics.isError) {
    return (
      <div className={styles.page}>
        <PageHeader title="Analytics" />
        <ErrorState />
      </div>
    )
  }

  const data = analytics.data
  const total = data.totalApplications

  if (total === 0) {
    return (
      <div className={styles.page}>
        <PageHeader title="Analytics" />
        <EmptyState
          heading="Nothing to measure yet"
          body="These figures are computed from application history, so they appear once applications start arriving."
        />
      </div>
    )
  }

  const byType = Object.entries(data.byOpportunityType).sort((a, b) => b[1] - a[1])
  const perPosting = [...data.perPosting].sort((a, b) => b.applications - a.applications)
  const busiest = perPosting[0]?.applications ?? 1

  return (
    <div className={styles.page}>
      <PageHeader title="Analytics">
        <p className={['t-body', styles.muted].join(' ')}>
          Computed from the status history of every application, every time this page is opened.
          Nothing is stored separately, so these figures cannot drift from the records behind them.
        </p>
      </PageHeader>

      <section className={styles.tiles}>
        <Tile label="Postings" value={String(data.postings)} foot="Published and closed" />
        <Tile label="Applications" value={String(total)} foot="Across every posting" />
        <Tile
          label="Offer acceptance"
          value={data.offerAcceptanceRate === null ? 'Not yet' : `${Math.round(data.offerAcceptanceRate * 100)}%`}
          foot={data.offerAcceptanceRate === null ? 'No offer answered yet' : 'Of offers answered'}
        />
        <Tile
          label="Applicants per offer"
          value={
            data.funnel.OFFER_EXTENDED + data.funnel.OFFER_ACCEPTED + data.funnel.OFFER_DECLINED > 0
              ? String(
                  Math.round(
                    (total /
                      (data.funnel.OFFER_EXTENDED +
                        data.funnel.OFFER_ACCEPTED +
                        data.funnel.OFFER_DECLINED)) *
                      10,
                  ) / 10,
                )
              : 'Not yet'
          }
          foot="How many applied per offer made"
        />
      </section>

      <section className={styles.block}>
        <h2 className="t-heading-lg">The funnel</h2>
        <Funnel funnel={data.funnel} total={total} />
      </section>

      <div className={styles.columns}>
        <section className={styles.block}>
          <h2 className="t-heading-lg">How applications ended</h2>
          <ul className={styles.endings}>
            {ENDINGS.map((status) => (
              <li key={status} className={styles.ending}>
                <span className={['t-figure', styles.figure].join(' ')}>{data.funnel[status]}</span>
                <span className={['t-body-sm', styles.muted].join(' ')}>
                  {APPLICATION_STATUS_LABEL[status]}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.block}>
          <h2 className="t-heading-lg">By opportunity type</h2>
          <ul className={styles.types}>
            {byType.map(([type, count]) => (
              <li key={type} className={styles.typeRow}>
                <span className="t-body-sm">
                  {OPPORTUNITY_TYPE_LABEL[type as keyof typeof OPPORTUNITY_TYPE_LABEL] ?? type}
                </span>
                <span className={['t-figure', styles.figure].join(' ')}>{count}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className={styles.block}>
        <h2 className="t-heading-lg">Applications per posting</h2>
        <ul className={styles.postings}>
          {perPosting.map((row) => (
            <li key={row.jobId} className={styles.postingRow}>
              <Link to={`/company/postings/${row.jobId}/pipeline`} className={styles.postingTitle}>
                {row.title}
              </Link>
              <span className={styles.barTrack}>
                <span
                  className={styles.bar}
                  style={{ inlineSize: `${Math.max(2, (row.applications / busiest) * 100)}%` }}
                />
              </span>
              <span className={['t-figure', styles.figure].join(' ')}>{row.applications}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function Tile({ label, value, foot }: { label: string; value: string; foot: string }) {
  return (
    <div className={['glass-dense', styles.tile].join(' ')}>
      <p className={['t-eyebrow', styles.tileLabel].join(' ')}>{label}</p>
      <p className="t-figure-xl">{value}</p>
      <p className={['t-caption', styles.muted].join(' ')}>{foot}</p>
    </div>
  )
}

/**
 * Bars rather than a tapering shape: each stage is measured against the same
 * baseline, so the lengths are comparable and the drop between two stages is
 * readable as a length rather than as an angle.
 */
function Funnel({ funnel, total }: { funnel: FunnelCounts; total: number }) {
  return (
    <ol className={styles.funnel}>
      {STAGES.map((status) => {
        const count = funnel[status]
        const share = total > 0 ? count / total : 0
        return (
          <li key={status} className={styles.stage}>
            <span className={['t-body-sm', styles.stageLabel].join(' ')}>
              {APPLICATION_STATUS_LABEL[status]}
            </span>
            <span className={styles.barTrack}>
              <span
                className={[styles.bar, status === 'OFFER_EXTENDED' ? styles.barAttention : ''].join(' ')}
                style={{ inlineSize: `${Math.max(count > 0 ? 2 : 0, share * 100)}%` }}
              />
            </span>
            <span className={styles.stageFigures}>
              <span className={['t-figure', styles.figure].join(' ')}>{count}</span>
              <span className={['t-caption', styles.muted].join(' ')}>
                {Math.round(share * 100)}%
              </span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}
