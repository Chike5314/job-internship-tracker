import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { COMPANY_PAGE_LIMIT } from '@/api/admin'
import { VERIFICATION_STATUSES, type VerificationStatus } from '@/api/enums'
import type { CompanyFull } from '@/api/types'
import { Button } from '@/ui/Button'
import { ErrorState } from '@/ui/ErrorState'
import { Icon } from '@/ui/Icon'
import { Skeleton } from '@/ui/Skeleton'
import { formatDateShort } from '@/lib/formatDate'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { STACKED_QUERY, host, matchesCompany, waitingFor } from './adminFormat'
import { AddCompanyDrawer } from './AddCompanyDrawer'
import { CompanyDrawer } from './CompanyDrawer'
import { CompanyMark, VerificationTag } from './VerificationTag'
import { useCompaniesByStatus } from './useAdmin'
import pageStyles from './AdminPage.module.css'
import styles from './AdminCompaniesPage.module.css'

type Tab = VerificationStatus | 'ALL'

// Pending leads because it is the work. All comes last, for a search that has
// to look everywhere.
const TABS: { key: Tab; label: string }[] = [
  { key: 'PENDING_VERIFICATION', label: 'Pending' },
  { key: 'VERIFIED', label: 'Verified' },
  { key: 'REJECTED', label: 'Rejected' },
  { key: 'SUSPENDED', label: 'Suspended' },
  { key: 'ALL', label: 'All' },
]

const EMPTY: Record<Tab, string> = {
  PENDING_VERIFICATION: 'Nobody is waiting. Every company that has registered has a decision.',
  VERIFIED: 'No company has been verified yet.',
  REJECTED: 'No company has been rejected.',
  SUSPENDED: 'No company is suspended.',
  ALL: 'No company has an account yet.',
}

const DECIDED: Partial<Record<VerificationStatus, string>> = {
  VERIFIED: 'Verified',
  REJECTED: 'Rejected',
  SUSPENDED: 'Suspended',
}

function isTab(value: string | null): value is Tab {
  return value === 'ALL' || VERIFICATION_STATUSES.includes(value as VerificationStatus)
}

const time = (iso?: string) => (iso ? new Date(iso).getTime() : 0)

/**
 * The order each list reads in. The queue is longest waiting first, which is
 * the fair order to work through it; a decided list is newest decision first;
 * everything together is alphabetical, since it is reached by searching.
 */
function ordered(tab: Tab, companies: CompanyFull[]): CompanyFull[] {
  const list = [...companies]
  if (tab === 'PENDING_VERIFICATION') return list.sort((a, b) => time(a.createdAt) - time(b.createdAt))
  if (tab === 'ALL') return list.sort((a, b) => a.companyName.localeCompare(b.companyName))
  return list.sort((a, b) => time(b.verifiedAt ?? b.createdAt) - time(a.verifiedAt ?? a.createdAt))
}

/** FR-9.3: every company account, by where it stands with verification. */
export function AdminCompaniesPage() {
  const [params, setParams] = useSearchParams()
  const term = (params.get('q') ?? '').trim()
  const requested = params.get('status')
  // A search from the bar arrives with no tab chosen, and has to look in every list.
  const tab: Tab = isTab(requested) ? requested : term ? 'ALL' : 'PENDING_VERIFICATION'
  const [now] = useState(() => Date.now())
  const stacked = useMediaQuery(STACKED_QUERY)

  const pending = useCompaniesByStatus('PENDING_VERIFICATION')
  const verified = useCompaniesByStatus('VERIFIED')
  const rejected = useCompaniesByStatus('REJECTED')
  const suspended = useCompaniesByStatus('SUSPENDED')
  const lists: Record<VerificationStatus, typeof pending> = {
    PENDING_VERIFICATION: pending,
    VERIFIED: verified,
    REJECTED: rejected,
    SUSPENDED: suspended,
  }

  const statuses = tab === 'ALL' ? VERIFICATION_STATUSES : [tab]
  const loading = statuses.some((status) => lists[status].isPending)
  const failed = statuses.some((status) => lists[status].isError)

  // At most a few hundred rows, so sorting on each render costs nothing.
  const inTab = ordered(tab, statuses.flatMap((status) => lists[status].data?.companies ?? []))
  const shown = term ? inTab.filter((company) => matchesCompany(company, term)) : inTab

  // The drawer reads the company out of whichever list holds it, so a decision
  // that moves it between lists keeps it open.
  const openId = params.get('company')
  const openCompany = openId
    ? VERIFICATION_STATUSES.flatMap((status) => lists[status].data?.companies ?? []).find(
        (company) => company.companyId === openId,
      )
    : undefined
  // A company just created is not in a list until the lists are read again,
  // so a read still under way counts as loading too.
  const listsLoading = VERIFICATION_STATUSES.some((status) => lists[status].isPending || lists[status].isFetching)
  const adding = params.get('add') === '1'

  // Opening adds a history entry, so Back closes the drawer; closing replaces
  // it, so Back after that does not open it again.
  function open(companyId: string) {
    setParams((current) => {
      const copy = new URLSearchParams(current)
      copy.set('company', companyId)
      return copy
    })
  }

  function startAdding() {
    setParams((current) => {
      const copy = new URLSearchParams(current)
      copy.set('add', '1')
      copy.delete('company')
      return copy
    })
  }

  function stopAdding() {
    setParams(
      (current) => {
        const copy = new URLSearchParams(current)
        copy.delete('add')
        return copy
      },
      { replace: true },
    )
  }

  // From the new account straight to its own drawer, on the tab that holds it.
  function openCreated(company: CompanyFull) {
    setParams(
      (current) => {
        const copy = new URLSearchParams(current)
        copy.delete('add')
        copy.delete('q')
        copy.set('status', company.verificationStatus)
        copy.set('company', company.companyId)
        return copy
      },
      { replace: true },
    )
  }

  function close() {
    setParams(
      (current) => {
        const copy = new URLSearchParams(current)
        copy.delete('company')
        return copy
      },
      { replace: true },
    )
  }

  function count(key: Tab): string {
    const keys = key === 'ALL' ? VERIFICATION_STATUSES : [key]
    if (keys.some((status) => !lists[status].data)) return ''
    const n = keys.reduce((sum, status) => sum + (lists[status].data?.count ?? 0), 0)
    const full = keys.some((status) => (lists[status].data?.count ?? 0) >= COMPANY_PAGE_LIMIT)
    return `${n}${full ? '+' : ''}`
  }

  function pick(next: Tab) {
    setParams(
      (current) => {
        const copy = new URLSearchParams(current)
        copy.set('status', next)
        return copy
      },
      { replace: true },
    )
  }

  function clearSearch() {
    setParams(
      (current) => {
        const copy = new URLSearchParams(current)
        copy.delete('q')
        return copy
      },
      { replace: true },
    )
  }

  return (
    <div className={[pageStyles.page, styles.fill].join(' ')}>
      <header className={pageStyles.head}>
        <div className={pageStyles.titles}>
          <h1 className={pageStyles.title}>Companies</h1>
          <p className={pageStyles.subtitle}>Every company account, by where it stands with verification.</p>
        </div>
        <Button variant="primary" className={styles.cta} onClick={startAdding}>
          <Icon name="add" size={18} />
          Add a company
        </Button>
      </header>

      <section className={['glass-soft', styles.card].join(' ')} aria-label="Companies">
        <div className={styles.toolbar}>
          <div className={styles.tabs} role="tablist" aria-label="Standing">
            {TABS.map((item) => (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={tab === item.key}
                className={[styles.tab, tab === item.key ? styles.tabActive : ''].join(' ')}
                onClick={() => pick(item.key)}
              >
                {item.label}
                <span className={styles.tabCount}>{count(item.key)}</span>
              </button>
            ))}
          </div>
          {term && (
            <p className={styles.searching}>
              {shown.length === 1 ? '1 match' : `${shown.length} matches`} for “{term}”
              <button type="button" className={styles.clear} onClick={clearSearch}>
                Clear search
              </button>
            </p>
          )}
        </div>

        {failed ? (
          <div className={styles.state}>
            <ErrorState />
          </div>
        ) : loading ? (
          <div className={styles.loading}>
            {[0, 1, 2, 3].map((row) => (
              <Skeleton key={row} height={52} radius="var(--radius-md)" />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <div className={styles.state}>
            <p className={styles.empty}>{term ? `No company in this list matches “${term}”.` : EMPTY[tab]}</p>
            {term && tab !== 'ALL' && (
              <button type="button" className={styles.clear} onClick={() => pick('ALL')}>
                Search every list
              </button>
            )}
          </div>
        ) : stacked ? (
          <ul className={styles.list}>
            {shown.map((company) => (
              <CompanyItem
                key={company.companyId}
                company={company}
                now={now}
                current={company.companyId === openId}
                onOpen={() => open(company.companyId)}
              />
            ))}
          </ul>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <colgroup>
                <col />
                <col className={styles.colContact} />
                <col className={styles.colRegistered} />
                <col className={styles.colStanding} />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">COMPANY</th>
                  <th scope="col">CONTACT</th>
                  <th scope="col">REGISTERED</th>
                  <th scope="col">STANDING</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((company) => (
                  <CompanyRow
                    key={company.companyId}
                    company={company}
                    now={now}
                    current={company.companyId === openId}
                    onOpen={() => open(company.companyId)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {openId && <CompanyDrawer key={openId} company={openCompany} loading={listsLoading} onClose={close} />}
      {adding && <AddCompanyDrawer onClose={stopAdding} onOpenCompany={openCreated} />}
    </div>
  )
}

/** The line under a company that says where it stands in time. */
function standingNote(company: CompanyFull, now: number): { text: string; urgent: boolean } | null {
  const status = company.verificationStatus
  if (status === 'PENDING_VERIFICATION') return { text: waitingFor(company.createdAt, now), urgent: true }
  const decided = DECIDED[status]
  if (decided && company.verifiedAt) return { text: `${decided} ${formatDateShort(company.verifiedAt)}`, urgent: false }
  return null
}

/** One company as a stacked row, for widths where the table does not fit. */
function CompanyItem({
  company,
  now,
  current,
  onOpen,
}: {
  company: CompanyFull
  now: number
  current: boolean
  onOpen: () => void
}) {
  const site = host(company.companyWebsiteUrl)
  const note = standingNote(company, now)
  return (
    <li>
      <button
        type="button"
        className={[styles.item, current ? styles.itemCurrent : ''].join(' ')}
        onClick={onOpen}
        aria-haspopup="dialog"
      >
        <CompanyMark name={company.companyName} logoUrl={company.logoUrl} size="sm" />
        <span className={styles.itemMain}>
          <span className={styles.itemTop}>
            <span className={styles.itemName}>{company.companyName}</span>
            <VerificationTag status={company.verificationStatus} />
          </span>
          <span className={styles.itemSub}>{[company.contactEmail, site].filter(Boolean).join(' · ')}</span>
          <span className={styles.itemMeta}>
            Registered {formatDateShort(company.createdAt)}
            {company.createdByAdmin ? ' by an admin' : ''}
            {note && (
              <>
                {' · '}
                <span className={note.urgent ? styles.waiting : undefined}>{note.text}</span>
              </>
            )}
          </span>
        </span>
      </button>
    </li>
  )
}

function CompanyRow({
  company,
  now,
  current,
  onOpen,
}: {
  company: CompanyFull
  now: number
  current: boolean
  onOpen: () => void
}) {
  const status = company.verificationStatus
  const decided = DECIDED[status]
  const site = host(company.companyWebsiteUrl)
  // The whole row opens the company for a pointer; the name is the button a
  // keyboard and a screen reader reach.
  return (
    <tr className={[styles.row, current ? styles.rowCurrent : ''].join(' ')} onClick={onOpen}>
      <th scope="row">
        <span className={styles.company}>
          <CompanyMark name={company.companyName} logoUrl={company.logoUrl} size="sm" />
          <span className={styles.stack}>
            <button
              type="button"
              className={styles.name}
              onClick={(event) => {
                event.stopPropagation()
                onOpen()
              }}
              aria-haspopup="dialog"
            >
              {company.companyName}
            </button>
            {site && <span className={styles.note}>{site}</span>}
          </span>
        </span>
      </th>
      <td>
        <span className={styles.contact}>{company.contactEmail}</span>
      </td>
      <td>
        <span className={styles.stack}>
          <span className={styles.figure}>{formatDateShort(company.createdAt)}</span>
          {status === 'PENDING_VERIFICATION' ? (
            <span className={styles.waiting}>{waitingFor(company.createdAt, now)}</span>
          ) : company.createdByAdmin ? (
            <span className={styles.note}>Added by an admin</span>
          ) : null}
        </span>
      </td>
      <td>
        <span className={styles.stack}>
          <VerificationTag status={status} />
          {decided && company.verifiedAt && (
            <span className={styles.note}>
              {decided} {formatDateShort(company.verifiedAt)}
            </span>
          )}
        </span>
      </td>
    </tr>
  )
}
