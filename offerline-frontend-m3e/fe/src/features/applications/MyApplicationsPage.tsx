import { useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { ApplicationSummary } from '@/api/types'
import { FINAL_STATUSES } from '@/api/enums'
import { ButtonLink } from '@/ui/ButtonLink'
import { Button } from '@/ui/Button'
import { EmptyState } from '@/ui/EmptyState'
import { ErrorState } from '@/ui/ErrorState'
import { Icon } from '@/ui/Icon'
import { Skeleton } from '@/ui/Skeleton'
import { ApplicationRow } from './ApplicationRow'
import { ApplicationDetailPanel } from './ApplicationDetailPanel'
import { useApplication, useMyApplications } from './useApplications'
import styles from './MyApplicationsPage.module.css'

type Tab = 'all' | 'active' | 'closed'

const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'In progress' },
  { key: 'closed', label: 'Closed' },
]

const isClosed = (application: ApplicationSummary) => FINAL_STATUSES.includes(application.status)

const appliedAt = (application: ApplicationSummary) => new Date(application.appliedAt).getTime()

/**
 * The applications list and one application side by side.
 *
 * The selected id lives in the URL, so a row stays addressable, the back button
 * works, and a notification can link straight to the application it is about.
 * The search term lives there too, written by the bar's search field. Below the
 * split the panel takes the whole width and the list steps aside, because two
 * panes do not fit on a narrow screen.
 */
export function MyApplicationsPage() {
  const { applicationId } = useParams<{ applicationId: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q') ?? ''
  const { data, isLoading, isError } = useMyApplications()
  const [tab, setTab] = useState<Tab>('all')

  // Newest first. The list carries when each application was sent but not
  // when it last moved, so sending is the order it can honestly keep.
  const applications = useMemo(
    () => [...(data?.applications ?? [])].sort((a, b) => appliedAt(b) - appliedAt(a)),
    [data],
  )

  const counts = {
    all: applications.length,
    active: applications.filter((a) => !isClosed(a)).length,
    closed: applications.filter(isClosed).length,
  }

  const term = query.trim().toLowerCase()
  const rows = applications
    .filter((a) => (tab === 'all' ? true : tab === 'closed' ? isClosed(a) : !isClosed(a)))
    .filter((a) => (term ? `${a.jobTitle} ${a.companyName}`.toLowerCase().includes(term) : true))

  // With no id in the URL the first row of the current view is shown, so the
  // panel is never empty while there is something to put in it.
  const selectedId = applicationId ?? rows[0]?.applicationId ?? applications[0]?.applicationId
  const offer = applications.find((a) => a.status === 'OFFER_EXTENDED')
  const keepSearch = query ? `?q=${encodeURIComponent(query)}` : ''

  function reviewOffer(id: string) {
    setTab('all')
    navigate(`/applications/${id}`)
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div className={styles.titles}>
          <h1 className={styles.title}>Applications</h1>
          <p className={styles.subtitle}>Everything you have applied to, and where each one stands.</p>
        </div>
        <ButtonLink variant="primary" to="/postings" className={styles.cta}>
          Browse opportunities
        </ButtonLink>
      </header>

      {/* The bar's search is gone on a phone, so the page carries its own,
          writing the same ?q the bar would. */}
      <form className={['glass-soft', styles.phoneSearch].join(' ')} role="search" onSubmit={(event) => event.preventDefault()}>
        <Icon name="search" size={18} />
        <input
          type="search"
          value={query}
          onChange={(event) =>
            setSearchParams(
              (params) => {
                if (event.target.value) params.set('q', event.target.value)
                else params.delete('q')
                return params
              },
              { replace: true },
            )
          }
          placeholder="Search your applications"
          aria-label="Search your applications"
          className={styles.phoneSearchField}
        />
      </form>

      {offer && (
        <div className={styles.offer}>
          <span className={styles.offerDot} aria-hidden="true" />
          <p className={styles.offerText}>
            <strong>{offer.companyName} has made you an offer</strong>
            <span>
              {' '}
              · {offer.jobTitle} · waiting for your answer
            </span>
          </p>
          <Button variant="primary" onClick={() => reviewOffer(offer.applicationId)}>
            Review offer
          </Button>
        </div>
      )}

      {isError && <ErrorState body="Could not load your applications." />}

      {isLoading && (
        <div className={styles.split}>
          <Skeleton height={420} radius="var(--radius-lg)" />
        </div>
      )}

      {data && applications.length === 0 && (
        <EmptyState
          heading="No applications yet"
          body="Browse postings and apply to the ones that fit."
          action={
            <ButtonLink variant="primary" to="/postings">
              Browse opportunities
            </ButtonLink>
          }
        />
      )}

      {data && applications.length > 0 && (
        <div className={[styles.split, applicationId ? styles.detailOpen : ''].join(' ')}>
          <section className={['glass-soft', styles.list].join(' ')} aria-label="Your applications">
            <div className={styles.toolbar}>
              <div className={styles.tabs} role="tablist" aria-label="Filter applications">
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
                    <span className={styles.tabCount}>{counts[item.key]}</span>
                  </button>
                ))}
              </div>
              <p className={styles.order}>Newest first</p>
            </div>

            <div className={styles.columns} aria-hidden="true">
              <span>ROLE</span>
              <span>STATUS</span>
              <span className={styles.end}>APPLIED</span>
            </div>

            <div className={styles.rows}>
              {rows.length === 0 ? (
                <div className={styles.nothing}>
                  <p className={styles.nothingTitle}>Nothing matches that search</p>
                  <p className={styles.nothingBody}>
                    Try a different role or company name, or clear the search.
                  </p>
                </div>
              ) : (
                <ul className={styles.rowList}>
                  {rows.map((application) => (
                    <li key={application.applicationId}>
                      <ApplicationRow
                        application={application}
                        to={`/applications/${application.applicationId}${keepSearch}`}
                        selected={application.applicationId === selectedId}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <aside className={['glass-soft', styles.detail].join(' ')} aria-label="Selected application">
            {applicationId && (
              <button
                type="button"
                className={styles.back}
                onClick={() => navigate(`/applications${keepSearch}`)}
              >
                <Icon name="back" size={15} />
                All applications
              </button>
            )}
            {selectedId ? <SelectedApplication applicationId={selectedId} /> : null}
          </aside>
        </div>
      )}
    </div>
  )
}

function SelectedApplication({ applicationId }: { applicationId: string }) {
  const { data, isLoading, isError } = useApplication(applicationId)

  if (isLoading) {
    return (
      <div className={styles.pending}>
        <Skeleton height={420} radius="var(--radius-md)" />
      </div>
    )
  }
  if (isError || !data) {
    return (
      <div className={styles.pending}>
        <ErrorState body="Could not load this application." />
      </div>
    )
  }

  // Keyed by application, so state such as an open edit form never carries
  // over to the next one selected.
  return <ApplicationDetailPanel key={applicationId} application={data.application} />
}
