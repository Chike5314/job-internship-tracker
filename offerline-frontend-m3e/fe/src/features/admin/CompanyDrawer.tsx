import { useEffect, useId, useRef, useState, type MouseEvent } from 'react'
import { ApiError } from '@/api/errors'
import { VERIFICATION_STATUS_LABEL, type VerificationStatus } from '@/api/enums'
import type { CompanyFull, JobSummary, ModerationEntry } from '@/api/types'
import { useAuth } from '@/auth/AuthProvider'
import { Button } from '@/ui/Button'
import { Icon } from '@/ui/Icon'
import { Skeleton } from '@/ui/Skeleton'
import { Textarea } from '@/ui/Textarea'
import { formatClock, formatDateShort, formatDayMonthYear } from '@/lib/formatDate'
import { host, waitingFor } from './adminFormat'
import { CompanyMark, VerificationTag } from './VerificationTag'
import { useClosePosting, useCompanyPostings, useSetCompanyStatus } from './useAdmin'
import styles from './CompanyDrawer.module.css'

type Decision = 'VERIFIED' | 'REJECTED' | 'SUSPENDED'

/** What an admin can do from each standing, as ADMIN_TRANSITIONS allows it. */
const ACTIONS: Record<VerificationStatus, { to: Decision; label: string; tone: 'primary' | 'secondary' | 'reject' }[]> = {
  PENDING_VERIFICATION: [
    { to: 'VERIFIED', label: 'Approve', tone: 'primary' },
    { to: 'REJECTED', label: 'Reject', tone: 'reject' },
  ],
  VERIFIED: [{ to: 'SUSPENDED', label: 'Suspend', tone: 'reject' }],
  REJECTED: [{ to: 'VERIFIED', label: 'Verify after all', tone: 'secondary' }],
  SUSPENDED: [{ to: 'VERIFIED', label: 'Restore', tone: 'primary' }],
}

type Confirm = {
  title: string
  body: string
  /** A rejection or a suspension has to say why: the company is told, and the
   *  history keeps the reason (FR-9.4). */
  noteRequired: boolean
  placeholder: string
  action: string
  danger: boolean
}

function confirmFor(from: VerificationStatus, to: Decision, name: string, live: number | undefined): Confirm {
  if (to === 'REJECTED') {
    return {
      title: `Reject ${name}`,
      body: 'It cannot publish anything. You can still verify it later if it puts things right.',
      noteRequired: true,
      placeholder: 'What the company needs to change',
      action: 'Reject company',
      danger: true,
    }
  }
  if (to === 'SUSPENDED') {
    const postings =
      live === undefined
        ? 'Its live postings come down at once'
        : live === 0
          ? 'It has no live postings to take down'
          : `Its ${live} live posting${live === 1 ? '' : 's'} come${live === 1 ? 's' : ''} down at once`
    return {
      title: `Suspend ${name}`,
      body: `${postings}, and it stops receiving application alerts.`,
      noteRequired: true,
      placeholder: 'Which policy it broke',
      action: 'Suspend company',
      danger: true,
    }
  }
  if (from === 'SUSPENDED') {
    return {
      title: `Restore ${name}`,
      body: 'It can publish again. Postings the suspension closed stay closed until the company publishes them.',
      noteRequired: false,
      placeholder: 'Anything the company should know',
      action: 'Restore company',
      danger: false,
    }
  }
  return {
    title: from === 'REJECTED' ? `Verify ${name}` : `Approve ${name}`,
    body: 'It can publish postings straight away.',
    noteRequired: false,
    placeholder: 'Anything the company should know',
    action: from === 'REJECTED' ? 'Verify company' : 'Approve company',
    danger: false,
  }
}

function doneLine(from: VerificationStatus, to: Decision, name: string, unpublished: number): string {
  if (to === 'REJECTED') return `${name} was rejected and has been emailed.`
  if (to === 'SUSPENDED') {
    const down = unpublished === 1 ? '1 live posting came down' : `${unpublished} live postings came down`
    return `${name} is suspended and has been emailed. ${down}.`
  }
  if (from === 'SUSPENDED') return `${name} is restored and has been emailed.`
  return `${name} is verified and has been emailed.`
}

const POSTING_LABEL: Record<JobSummary['postingStatus'], string> = {
  DRAFT: 'Draft',
  PUBLISHED: 'Published',
  CLOSED: 'Closed',
  EXPIRED: 'Expired',
}

function failure(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback
}

/**
 * One company, opened from the companies list (FR-9.1, FR-9.2, FR-9.4, FR-9.8):
 * who it is, its postings, every decision taken on it so far, and the decision
 * its standing allows next. A native <dialog>, like the pipeline's drawer.
 */
export function CompanyDrawer({
  company,
  loading,
  onClose,
}: {
  /** Absent while the lists load, or when the id matches no company. */
  company?: CompanyFull
  loading: boolean
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
    // The heading takes focus, so a screen reader announces the company and a
    // ring is not drawn round the first link as if it were wrong.
    dialog?.querySelector<HTMLElement>('h2')?.focus()
  }, [])

  function onBackdrop(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) onClose()
  }

  return (
    <dialog
      ref={ref}
      className={styles.drawer}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={onBackdrop}
    >
      {company ? (
        <DrawerContent key={company.companyId} titleId={titleId} company={company} onClose={onClose} />
      ) : (
        <div className={styles.panel}>
          <header className={styles.head}>
            <div className={styles.who}>
              {loading ? <Skeleton width={48} height={48} radius="var(--radius-md)" /> : null}
              <h2 id={titleId} className={styles.placeholder} tabIndex={-1}>
                {loading ? 'Opening the company' : 'This company could not be found'}
              </h2>
              <CloseButton onClose={onClose} />
            </div>
          </header>
          <div className={styles.body}>
            {loading ? (
              <>
                <Skeleton height={140} radius="var(--radius-md)" />
                <Skeleton height={100} radius="var(--radius-md)" />
              </>
            ) : (
              <p className={styles.quiet}>It may have been removed, or the link is out of date.</p>
            )}
          </div>
        </div>
      )}
    </dialog>
  )
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
      <Icon name="close" size={16} />
    </button>
  )
}

function DrawerContent({ titleId, company: initial, onClose }: { titleId: string; company: CompanyFull; onClose: () => void }) {
  const decide = useSetCompanyStatus()
  const postings = useCompanyPostings(initial.companyId)
  // The record the last decision sent back, so the drawer shows the new
  // standing at once rather than waiting for the lists to be read again.
  const [latest, setLatest] = useState<CompanyFull | null>(null)
  const [choosing, setChoosing] = useState<Decision | null>(null)
  const [note, setNote] = useState('')
  const [flash, setFlash] = useState('')
  const [problem, setProblem] = useState('')
  const [now] = useState(() => Date.now())

  const company = latest ?? initial
  const status = company.verificationStatus
  const name = company.companyName
  const live = postings.data?.filter((posting) => posting.postingStatus === 'PUBLISHED').length
  const confirm = choosing ? confirmFor(status, choosing, name, live) : null
  const site = host(company.companyWebsiteUrl)

  function begin(next: Decision | null) {
    setChoosing(next)
    setNote('')
    setProblem('')
    if (next) setFlash('')
  }

  function submit() {
    if (!choosing || !confirm) return
    if (confirm.noteRequired && !note.trim()) {
      setProblem('Say why. The company reads this, and the history keeps it.')
      return
    }
    const from = status
    const to = choosing
    decide.mutate(
      { companyId: company.companyId, verificationStatus: to, note: note.trim() || undefined },
      {
        onSuccess: ({ company: updated, postingsUnpublished }) => {
          setLatest(updated)
          setChoosing(null)
          setNote('')
          setFlash(doneLine(from, to, name, postingsUnpublished))
        },
        onError: (error) => setProblem(failure(error, 'That decision did not go through. Try again.')),
      },
    )
  }

  return (
    <div className={styles.panel}>
      <header className={styles.head}>
        <div className={styles.who}>
          <CompanyMark name={name} logoUrl={company.logoUrl} size="lg" />
          <div className={styles.identity}>
            <h2 id={titleId} className={styles.name} tabIndex={-1}>
              {name}
            </h2>
            {site && (
              <a href={company.companyWebsiteUrl} target="_blank" rel="noopener noreferrer" className={styles.site}>
                {site}
                <Icon name="open-external" size={13} />
              </a>
            )}
          </div>
          <CloseButton onClose={onClose} />
        </div>
        <div className={styles.statusLine}>
          <VerificationTag status={status} />
          <span className={status === 'PENDING_VERIFICATION' ? styles.waiting : styles.quietSmall}>
            {status === 'PENDING_VERIFICATION'
              ? waitingFor(company.createdAt, now)
              : company.verifiedAt
                ? `${VERIFICATION_STATUS_LABEL[status]} ${formatDateShort(company.verifiedAt)}`
                : `Registered ${formatDateShort(company.createdAt)}`}
          </span>
        </div>
      </header>

      <div className={styles.body}>
        <section className={styles.section} aria-labelledby={`${titleId}-details`}>
          <h3 id={`${titleId}-details`} className={styles.eyebrow}>
            DETAILS
          </h3>
          <dl className={styles.details}>
            <div className={styles.detail}>
              <dt>Contact</dt>
              <dd>
                <a href={`mailto:${company.contactEmail}`} className={styles.link}>
                  {company.contactEmail}
                </a>
              </dd>
            </div>
            <div className={styles.detail}>
              <dt>Website</dt>
              <dd>
                {company.companyWebsiteUrl ? (
                  <a href={company.companyWebsiteUrl} target="_blank" rel="noopener noreferrer" className={styles.link}>
                    {company.companyWebsiteUrl}
                  </a>
                ) : (
                  <span className={styles.quiet}>Not given</span>
                )}
              </dd>
            </div>
            <div className={styles.detail}>
              <dt>Office</dt>
              <dd>
                {company.officeAddress ?? <span className={styles.quiet}>Not given</span>}
                {company.googleMapsUrl && (
                  <a href={company.googleMapsUrl} target="_blank" rel="noopener noreferrer" className={styles.mapLink}>
                    Open in Google Maps
                  </a>
                )}
              </dd>
            </div>
            <div className={styles.detail}>
              <dt>Registered</dt>
              <dd>{formatDayMonthYear(new Date(company.createdAt))}</dd>
            </div>
            <div className={styles.detail}>
              <dt>Account</dt>
              <dd>{company.createdByAdmin ? 'Created by an admin' : 'Registered itself'}</dd>
            </div>
          </dl>
        </section>

        <CompanyPostings companyId={company.companyId} query={postings} />

        <section className={styles.section} aria-labelledby={`${titleId}-history`}>
          <h3 id={`${titleId}-history`} className={styles.eyebrow}>
            DECISIONS
          </h3>
          <History history={company.moderationHistory ?? []} createdAt={company.createdAt} />
        </section>
      </div>

      <footer className={styles.foot}>
        {flash && (
          <p className={styles.flash} role="status">
            <Icon name="confirm" size={16} />
            {flash}
          </p>
        )}

        {confirm ? (
          <div className={styles.confirm}>
            <p className={styles.confirmTitle}>{confirm.title}</p>
            <p className={styles.confirmBody}>{confirm.body}</p>
            <label className={styles.noteField}>
              <span className={styles.noteLabel}>
                {confirm.noteRequired ? 'Note for the company' : 'Note for the company (optional)'}
              </span>
              <Textarea
                value={note}
                onChange={(event) => {
                  setNote(event.target.value)
                  setProblem('')
                }}
                rows={3}
                maxLength={500}
                placeholder={confirm.placeholder}
                className={styles.note}
                aria-invalid={problem && confirm.noteRequired && !note.trim() ? true : undefined}
              />
            </label>
            {problem && (
              <p role="alert" className={styles.problem}>
                {problem}
              </p>
            )}
            <div className={styles.confirmActions}>
              <button
                type="button"
                className={[styles.confirmButton, confirm.danger ? styles.confirmDanger : ''].join(' ')}
                onClick={submit}
                disabled={decide.isPending}
              >
                {confirm.action}
              </button>
              <Button variant="secondary" onClick={() => begin(null)} disabled={decide.isPending}>
                Cancel
              </Button>
            </div>
            <p className={styles.confirmNote}>
              The company is emailed{confirm.noteRequired ? ', with your note.' : ', with your note if you add one.'}
            </p>
          </div>
        ) : (
          <div className={styles.next}>
            <p className={styles.nextLabel}>Decision</p>
            <div className={styles.nextActions}>
              {ACTIONS[status].map((action) => (
                <button
                  key={action.to}
                  type="button"
                  className={[styles.nextAction, styles[action.tone]].join(' ')}
                  onClick={() => begin(action.to)}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </footer>
    </div>
  )
}

type Row = { jobId: string; title: string; postingStatus: JobSummary['postingStatus']; applications: number }

/**
 * The company's postings, with a way to take a live one down on its own
 * (FR-9.2) while the company stays as it stands.
 */
function CompanyPostings({
  companyId,
  query,
}: {
  companyId: string
  query: ReturnType<typeof useCompanyPostings>
}) {
  const close = useClosePosting(companyId)
  const [asking, setAsking] = useState<string | null>(null)
  const [done, setDone] = useState('')
  const [problem, setProblem] = useState('')
  const rows: Row[] = query.data ?? []

  function confirmClose(row: Row) {
    setProblem('')
    close.mutate(row.jobId, {
      onSuccess: () => {
        setAsking(null)
        setDone(`${row.title} is closed and takes no more applications. The company sees it as closed in its postings.`)
      },
      onError: (error) => setProblem(failure(error, 'The posting did not close. Try again.')),
    })
  }

  return (
    <section className={styles.section} aria-label="Postings">
      <h3 className={styles.eyebrow}>POSTINGS</h3>
      {done && (
        <p className={styles.sectionFlash} role="status">
          <Icon name="confirm" size={14} />
          {done}
        </p>
      )}
      {query.isPending ? (
        <Skeleton height={64} radius="var(--radius-md)" />
      ) : query.isError ? (
        <p className={styles.quiet}>The postings could not be loaded.</p>
      ) : rows.length === 0 ? (
        <p className={styles.quiet}>No postings yet.</p>
      ) : (
        <ul className={styles.postings}>
          {rows.map((row) => (
            <li key={row.jobId} className={styles.posting}>
              <div className={styles.postingMain}>
                <span className={styles.postingText}>
                  <span className={styles.postingTitle}>{row.title}</span>
                  <span className={styles.postingMeta}>
                    {row.applications} application{row.applications === 1 ? '' : 's'}
                  </span>
                </span>
                <span className={[styles.postingStatus, styles[row.postingStatus.toLowerCase()]].join(' ')}>
                  {POSTING_LABEL[row.postingStatus]}
                </span>
                {row.postingStatus === 'PUBLISHED' && asking !== row.jobId && (
                  <button
                    type="button"
                    className={styles.closePosting}
                    onClick={() => {
                      setAsking(row.jobId)
                      setDone('')
                      setProblem('')
                    }}
                  >
                    Close
                  </button>
                )}
              </div>
              {asking === row.jobId && (
                <div className={styles.ask}>
                  <p className={styles.askText}>
                    Close this posting? It stops taking applications at once. The company is not emailed about it.
                  </p>
                  {problem && (
                    <p role="alert" className={styles.problem}>
                      {problem}
                    </p>
                  )}
                  <div className={styles.askActions}>
                    <button
                      type="button"
                      className={[styles.confirmButton, styles.confirmDanger, styles.small].join(' ')}
                      onClick={() => confirmClose(row)}
                      disabled={close.isPending}
                    >
                      Close posting
                    </button>
                    <Button variant="secondary" className={styles.smallButton} onClick={() => setAsking(null)}>
                      Keep it open
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/**
 * Every decision taken on the company, in the order it happened (FR-9.8). The
 * history records an admin by account id, so it names "you" when that is the
 * viewer and "an admin" otherwise.
 */
function History({ history, createdAt }: { history: ModerationEntry[]; createdAt: string }) {
  const { identity } = useAuth()

  if (history.length === 0) {
    return (
      <p className={styles.quiet}>
        No decisions yet. It registered itself on {formatDayMonthYear(new Date(createdAt))}.
      </p>
    )
  }

  return (
    <ol className={styles.history}>
      {history.map((entry, index) => {
        const last = index === history.length - 1
        const created = entry.from === 'NONE'
        const actor = entry.by === identity?.userId ? 'you' : 'an admin'
        return (
          <li key={`${entry.timestamp}-${entry.to}`} className={styles.entry}>
            <span className={styles.rail} aria-hidden="true">
              <span className={[styles.mark, last ? styles.markLast : ''].join(' ')} />
              {!last && <span className={styles.line} />}
            </span>
            <span className={styles.entryBody}>
              <span className={styles.entryHead}>
                <span className={styles.entryLabel}>
                  {created ? 'Account created' : VERIFICATION_STATUS_LABEL[entry.to]}
                </span>
                <span className={styles.entryDate}>
                  {formatDateShort(entry.timestamp)}, {formatClock(entry.timestamp)}
                </span>
              </span>
              <span className={styles.entryActor}>
                {created
                  ? `by ${actor}, ${entry.to === 'VERIFIED' ? 'already verified' : 'sent to the queue'}`
                  : `by ${actor}, from ${VERIFICATION_STATUS_LABEL[entry.from as VerificationStatus].toLowerCase()}`}
              </span>
              {entry.note && !created && <q className={styles.entryNote}>{entry.note}</q>}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
