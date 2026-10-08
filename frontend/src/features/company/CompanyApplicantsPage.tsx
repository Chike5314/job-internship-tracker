import { useMemo } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { CompanyApplicant } from '@/api/types'
import { Chip } from '@/ui/Chip'
import { EmptyState } from '@/ui/EmptyState'
import { ErrorState } from '@/ui/ErrorState'
import { Icon } from '@/ui/Icon'
import { Input } from '@/ui/Input'
import { PageHeader } from '@/ui/PageHeader'
import { Skeleton } from '@/ui/Skeleton'
import { ApplicantPanel } from './ApplicantPanel'
import { ApplicantRow } from './ApplicantRow'
import { useCompanyApplicants } from './useCompany'
import styles from './CompanyApplicantsPage.module.css'

type Lens = 'all' | 'active' | 'needsYou' | 'waiting' | 'repeat'

const LENSES: { key: Lens; label: string }[] = [
  { key: 'all', label: 'Everyone' },
  { key: 'active', label: 'Still in play' },
  { key: 'needsYou', label: 'Waiting on you' },
  { key: 'waiting', label: 'Waiting on them' },
  { key: 'repeat', label: 'Applied before' },
]

const MATCHES: Record<Lens, (person: CompanyApplicant) => boolean> = {
  all: () => true,
  active: (person) => person.isActive,
  needsYou: (person) => person.awaitingReview > 0,
  waiting: (person) => person.awaitingTheirReply > 0,
  repeat: (person) => person.applicationCount > 1,
}

/** Name, email and skills, so one field covers who they are and what they do. */
function haystack(person: CompanyApplicant): string {
  return [person.fullName, person.email, ...person.skills, ...person.applications.map((a) => a.jobTitle)]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

/**
 * The applicants directory: one row per person, not per application.
 *
 * Every other recruiter view is organised by posting, which means somebody who
 * applied to three of your openings reads as three unrelated cards on three
 * boards and nothing says they are the same person. This page is the one place
 * they are one person, so the questions it answers are the ones that need a
 * whole account to answer: have we seen them before, how far did they actually
 * get, and which side is holding things up.
 *
 * The selected person lives in the URL and so does the search term, matching
 * the applications list on the other side of the product: a row stays
 * addressable, the back button works, and a link can point at one candidate.
 */
export function CompanyApplicantsPage() {
  const { applicantId } = useParams<{ applicantId: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q') ?? ''
  const lens = (searchParams.get('lens') as Lens) || 'all'
  const { data, isPending, isError } = useCompanyApplicants()

  const people = useMemo(() => data?.applicants ?? [], [data])

  const counts = useMemo(
    () =>
      LENSES.reduce(
        (totals, { key }) => ({ ...totals, [key]: people.filter(MATCHES[key]).length }),
        {} as Record<Lens, number>,
      ),
    [people],
  )

  const term = query.trim().toLowerCase()
  const rows = useMemo(
    () => people.filter(MATCHES[lens]).filter((p) => (term ? haystack(p).includes(term) : true)),
    [people, lens, term],
  )

  // With nobody named in the URL the first row is shown, so the panel is never
  // empty while there is somebody to put in it.
  const selected =
    rows.find((p) => p.applicantId === applicantId) ??
    people.find((p) => p.applicantId === applicantId) ??
    rows[0]

  const search = (next: URLSearchParams) => `?${next.toString()}`

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    setSearchParams(next, { replace: true })
  }

  function open(person: CompanyApplicant) {
    navigate(`/company/applicants/${person.applicantId}${search(searchParams)}`)
  }

  const waitingOnYou = people.reduce((sum, p) => sum + p.awaitingReview, 0)

  return (
    <div className={[styles.page, applicantId ? styles.detailOpen : ''].join(' ')}>
      <PageHeader title="Applicants">
        <p className={['t-body', styles.muted].join(' ')}>
          Everyone who has applied to you, gathered by person. Somebody who applied to more than one
          of your postings appears once, with all of them under them.
        </p>
      </PageHeader>

      {waitingOnYou > 0 && (
        <p className={['t-body-sm', styles.banner].join(' ')}>
          <span className={styles.bannerDot} aria-hidden="true" />
          {waitingOnYou === 1
            ? 'One application has not been opened yet.'
            : `${waitingOnYou} applications have not been opened yet.`}
        </p>
      )}

      {isPending ? (
        <Skeleton height={320} />
      ) : isError ? (
        <ErrorState />
      ) : people.length === 0 ? (
        <EmptyState
          heading="Nobody has applied yet"
          body="Publish a posting and the people who apply to it gather here, each with everything they have sent you."
        />
      ) : (
        <div className={styles.split}>
          <section className={['glass-dense', styles.list].join(' ')} aria-label="Applicants">
            <div className={styles.toolbar}>
              <label className={styles.search}>
                <Icon name="search" size={16} />
                <Input
                  type="search"
                  value={query}
                  placeholder="Name, email, skill or posting"
                  aria-label="Filter applicants"
                  onChange={(event) => setParam('q', event.target.value)}
                />
              </label>
              <div className={styles.lenses}>
                {LENSES.map((option) => (
                  <Chip
                    key={option.key}
                    selected={lens === option.key}
                    onClick={() => setParam('lens', option.key === 'all' ? '' : option.key)}
                  >
                    {option.label}
                    <span className={styles.count}>{counts[option.key]}</span>
                  </Chip>
                ))}
              </div>
            </div>

            {rows.length === 0 ? (
              <p className={['t-body-sm', styles.muted, styles.noMatch].join(' ')}>
                Nobody matches that. Clear the search or choose another view.
              </p>
            ) : (
              <ul className={styles.rows}>
                {rows.map((person) => (
                  <li key={person.applicantId}>
                    <ApplicantRow
                      person={person}
                      selected={person.applicantId === selected?.applicantId}
                      onOpen={() => open(person)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={['glass-dense', styles.detail].join(' ')} aria-label="Applicant">
            <button
              type="button"
              className={['t-body-sm', styles.back].join(' ')}
              onClick={() => navigate(`/company/applicants${search(searchParams)}`)}
            >
              <Icon name="back" size={15} />
              All applicants
            </button>
            {selected ? (
              <ApplicantPanel person={selected} />
            ) : (
              <p className={['t-body-sm', styles.muted, styles.noMatch].join(' ')}>
                Choose somebody to see everything they have sent you.
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
