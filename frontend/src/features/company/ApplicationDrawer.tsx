import { useEffect, useId, useRef, useState, type MouseEvent } from 'react'
import { ApiError } from '@/api/errors'
import type { ApplicationStatus } from '@/api/enums'
import type { DocumentRequirement, Interview, RecruiterApplication, StatusHistoryEntry } from '@/api/types'
import { Button } from '@/ui/Button'
import { ErrorState } from '@/ui/ErrorState'
import { Icon } from '@/ui/Icon'
import { Skeleton } from '@/ui/Skeleton'
import { StatusTag } from '@/ui/StatusTag'
import { Textarea } from '@/ui/Textarea'
import { nameFromUrl } from '@/lib/fileNames'
import { formatDateShort, formatDay, formatInterviewMoment, formatInterviewWhen } from '@/lib/formatDate'
import { initials } from '@/lib/initials'
import { currentInterview } from '@/lib/interviews'
import { InterviewForm } from './InterviewForm'
import { RECRUITER_STATUS_LABEL, recruiterShortLabel } from './pipeline'
import { useRecruiterActions, useRecruiterApplication, type InterviewSlot } from './useCompany'
import styles from './ApplicationDrawer.module.css'

/**
 * The note _open_for_review in application_service/handler.py writes on the
 * history entry it adds. It is how an opening is told apart from a bulk move
 * to the same status, which carries the recruiter's own note or none.
 */
const OPENED_NOTE = 'Opened by the recruiter.'

const INTERVIEW_STATE = {
  PROPOSED: { label: 'Awaiting reply', tone: 'awaiting' },
  CONFIRMED: { label: 'Confirmed', tone: 'confirmed' },
  DECLINED: { label: 'Declined by applicant', tone: 'declined' },
  CANCELLED: { label: 'Cancelled', tone: 'declined' },
} as const

type Mode = null | 'interview' | 'OFFER_EXTENDED' | 'REJECTED'

const CONFIRM_COPY = {
  OFFER_EXTENDED: {
    title: 'Extend an offer',
    hint: 'Start date, or where the offer letter was sent',
    action: 'Send offer',
  },
  REJECTED: {
    title: 'Reject this application',
    hint: 'A short reason helps the applicant',
    action: 'Confirm rejection',
  },
}

function failure(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback
}

/**
 * One application, opened from the board. A native <dialog>, so focus is held
 * inside it and Escape closes it the way it closes every other dialog here.
 */
export function ApplicationDrawer({
  applicationId,
  jobId,
  statusWhenOpened,
  requirements,
  companyName,
  officeAddress,
  onClose,
}: {
  applicationId: string
  jobId: string
  /** Where the board had it at the moment it was opened, if the board knew. */
  statusWhenOpened?: ApplicationStatus
  /** The posting's list, which names each document the application carries. */
  requirements: DocumentRequirement[]
  companyName: string
  officeAddress?: string
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const query = useRecruiterApplication(applicationId, jobId)
  // Read once: the board moves the card to Under review as soon as the
  // opening lands, and the note below is about this opening having moved it.
  const [openedAsNew] = useState(statusWhenOpened === 'SUBMITTED')

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  // A click on the dialog itself, outside the panel, landed on the backdrop.
  function onBackdrop(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) onClose()
  }

  const application = query.data?.application

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
      {application ? (
        <DrawerContent
          titleId={titleId}
          application={application}
          jobId={jobId}
          openedAsNew={openedAsNew}
          requirements={requirements}
          companyName={application.companyName ?? companyName}
          officeAddress={officeAddress}
          onClose={onClose}
        />
      ) : (
        <div className={styles.panel}>
          <header className={styles.head}>
            <div className={styles.who}>
              <Skeleton width={48} height={48} radius="50%" />
              <div className={styles.identity}>
                <h2 id={titleId} className={styles.loadingTitle}>
                  {query.isError ? 'Application' : 'Opening the application'}
                </h2>
              </div>
              <CloseButton onClose={onClose} />
            </div>
          </header>
          <div className={styles.body}>
            {query.isError ? (
              <ErrorState />
            ) : (
              <>
                <Skeleton height={120} radius="var(--radius-md)" />
                <Skeleton height={64} radius="var(--radius-md)" />
                <Skeleton height={140} radius="var(--radius-md)" />
              </>
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

function DrawerContent({
  titleId,
  application,
  jobId,
  openedAsNew,
  requirements,
  companyName,
  officeAddress,
  onClose,
}: {
  titleId: string
  application: RecruiterApplication
  jobId: string
  openedAsNew: boolean
  requirements: DocumentRequirement[]
  companyName: string
  officeAddress?: string
  onClose: () => void
}) {
  const { move, schedule, reschedule } = useRecruiterActions(application.applicationId, jobId)
  const [mode, setMode] = useState<Mode>(null)
  const [note, setNote] = useState('')
  const [flash, setFlash] = useState('')
  const [problem, setProblem] = useState('')

  const { applicant, status } = application
  const name = applicant.fullName || applicant.email || 'Applicant'
  const first = name.split(/\s+/)[0] ?? name
  const isFinal = ['OFFER_ACCEPTED', 'OFFER_DECLINED', 'REJECTED', 'WITHDRAWN'].includes(status)
  const interview = status === 'INTERVIEW_SCHEDULED' ? currentInterview(application.interviews) : undefined
  // A time the applicant turned down is not open any more, so the next one is
  // a fresh invitation; a time that still stands is moved.
  const moving = interview && (interview.state === 'PROPOSED' || interview.state === 'CONFIRMED')
  const autoMoved = openedAsNew && status === 'UNDER_REVIEW'

  function begin(next: Mode) {
    setMode(next)
    setNote('')
    setFlash('')
    setProblem('')
  }

  function sendSlot(slot: InterviewSlot) {
    setProblem('')
    const mutation = moving ? reschedule : schedule
    mutation.mutate(slot, {
      onSuccess: () => {
        setMode(null)
        setFlash(
          moving
            ? `New time sent to ${first} and to you, with a calendar file.`
            : `Invitation sent to ${first} and to you, with a calendar file.`,
        )
      },
      onError: (error) => setProblem(failure(error, 'The invitation did not go through. Try again.')),
    })
  }

  function confirm(target: 'OFFER_EXTENDED' | 'REJECTED') {
    setProblem('')
    move.mutate(
      { status: target, note: note.trim() || undefined },
      {
        onSuccess: () => {
          setMode(null)
          setNote('')
          setFlash(`${first} has been emailed: ${RECRUITER_STATUS_LABEL[target].toLowerCase()}.`)
        },
        onError: (error) => setProblem(failure(error, 'That change did not go through. Try again.')),
      },
    )
  }

  const actions: { label: string; tone: 'primary' | 'secondary' | 'reject'; to: Mode }[] =
    status === 'UNDER_REVIEW'
      ? [
          { label: 'Schedule interview', tone: 'primary', to: 'interview' },
          { label: 'Extend offer', tone: 'secondary', to: 'OFFER_EXTENDED' },
          { label: 'Reject', tone: 'reject', to: 'REJECTED' },
        ]
      : status === 'INTERVIEW_SCHEDULED'
        ? [
            { label: 'Extend offer', tone: 'primary', to: 'OFFER_EXTENDED' },
            { label: 'Reject', tone: 'reject', to: 'REJECTED' },
          ]
        : status === 'SUBMITTED'
          ? [{ label: 'Reject', tone: 'reject', to: 'REJECTED' }]
          : []

  return (
    <div className={styles.panel}>
      <header className={styles.head}>
        <div className={styles.who}>
          <span className={styles.avatar} aria-hidden="true">
            {initials(name)}
          </span>
          <div className={styles.identity}>
            <h2 id={titleId} className={styles.name}>
              {name}
            </h2>
            <p className={styles.contact}>
              {applicant.email}
              {applicant.email && applicant.phone && ' · '}
              {applicant.phone && <span className={styles.phone}>{applicant.phone}</span>}
            </p>
          </div>
          <CloseButton onClose={onClose} />
        </div>
        <div className={styles.statusLine}>
          <StatusTag status={status} label={recruiterShortLabel(status)} />
          <span className={styles.edited}>
            {application.lastEditedAt
              ? `Last edited by applicant ${formatDateShort(application.lastEditedAt)}`
              : `Not edited since it was sent ${formatDateShort(application.appliedAt)}`}
          </span>
        </div>
        {autoMoved && (
          <p className={styles.moved}>
            Opening this moved it to Under review. {first} can no longer edit it, so you are
            reading exactly what was sent.
          </p>
        )}
      </header>

      <div className={styles.body}>
        {interview && (
          <InterviewCard
            interview={interview}
            interviews={application.interviews}
            onMove={() => begin('interview')}
            moving={Boolean(moving)}
          />
        )}

        <Documents application={application} requirements={requirements} />

        <section className={styles.section} aria-labelledby={`${titleId}-history`}>
          <h3 id={`${titleId}-history`} className={styles.eyebrow}>
            HISTORY
          </h3>
          <History
            history={application.statusHistory}
            isFinal={isFinal}
            applicantId={applicant.userId}
            applicantName={name}
            companyName={companyName}
          />
        </section>
      </div>

      <footer className={styles.foot}>
        {flash && (
          <p className={styles.flash} role="status">
            <Icon name="confirm" size={16} />
            {flash}
          </p>
        )}

        {mode === null && actions.length > 0 && (
          <div className={styles.next}>
            <p className={styles.nextLabel}>Next step</p>
            <div className={styles.nextActions}>
              {actions.map((action) => (
                <button
                  key={action.label}
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

        {mode === 'interview' && (
          <InterviewForm
            title={moving ? 'Reschedule the interview' : interview ? 'Propose a new time' : 'Schedule an interview'}
            first={first}
            from={interview}
            officeAddress={officeAddress}
            pending={schedule.isPending || reschedule.isPending}
            onSubmit={sendSlot}
            onCancel={() => begin(null)}
          />
        )}

        {(mode === 'OFFER_EXTENDED' || mode === 'REJECTED') && (
          <div className={styles.confirm}>
            <label className={styles.control}>
              <span className={styles.formTitle}>{CONFIRM_COPY[mode].title}</span>
              <span className={styles.controlLabel}>
                Optional note. {first} sees it in the history of this application.
              </span>
              <Textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                maxLength={500}
                placeholder={CONFIRM_COPY[mode].hint}
                className={styles.note}
              />
            </label>
            <div className={styles.formActions}>
              <button
                type="button"
                className={[styles.confirmAction, mode === 'REJECTED' ? styles.confirmReject : ''].join(' ')}
                onClick={() => confirm(mode)}
                disabled={move.isPending}
              >
                {CONFIRM_COPY[mode].action}
              </button>
              <Button variant="secondary" onClick={() => begin(null)} disabled={move.isPending}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {problem && (
          <p role="alert" className={styles.problem}>
            {problem}
          </p>
        )}

        {mode === null && status === 'OFFER_EXTENDED' && (
          <p className={styles.waiting}>
            Waiting for {first} to accept or decline the offer.
          </p>
        )}
        {mode === null && isFinal && (
          <p className={styles.waiting}>This application is closed. Its history stays for your records.</p>
        )}
      </footer>
    </div>
  )
}

function InterviewCard({
  interview,
  interviews,
  moving,
  onMove,
}: {
  interview: Interview
  interviews: Interview[]
  moving: boolean
  onMove: () => void
}) {
  const state = INTERVIEW_STATE[interview.state]
  const replaced = interview.replacesInterviewId
    ? interviews.find((other) => other.interviewId === interview.replacesInterviewId)
    : undefined

  return (
    <section className={styles.interview} aria-label="Interview">
      <div className={styles.interviewHead}>
        <span className={styles.interviewEyebrow}>INTERVIEW</span>
        <span className={[styles.interviewState, styles[state.tone]].join(' ')}>{state.label}</span>
      </div>
      <p className={styles.interviewWhen}>
        {formatInterviewWhen(interview.scheduledAt, interview.durationMinutes)}
      </p>
      <p className={styles.interviewWhere}>
        {interview.durationMinutes} min · {interview.mode === 'ONLINE' ? 'Online' : 'Onsite'} ·{' '}
        {interview.locationOrLink}
      </p>
      <div className={styles.interviewFoot}>
        <span className={styles.interviewEarlier}>
          {replaced ? `Moved from ${formatInterviewMoment(replaced.scheduledAt)}` : 'First invitation'}
        </span>
        <Button variant="secondary" className={styles.small} onClick={onMove}>
          {moving ? 'Reschedule' : 'Propose a new time'}
        </Button>
      </div>
    </section>
  )
}

/**
 * The files exactly as they were sent, named after the posting's own list, and
 * the written answers after them. The cover letter is stored on its own field
 * rather than among the answers, so it is read from there.
 */
function Documents({
  application,
  requirements,
}: {
  application: RecruiterApplication
  requirements: DocumentRequirement[]
}) {
  const labelled = new Map(requirements.map((requirement) => [requirement.key, requirement.label]))
  // A key the posting no longer lists still has a file behind it, so it is
  // shown under its own key rather than dropped.
  const files = Object.entries(application.documentUrls).map(([key, url]) => {
    const label = labelled.get(key) ?? key
    return { key, url, name: nameFromUrl(url) ?? label, label }
  })
  const order = new Map(requirements.map((requirement, index) => [requirement.key, index]))
  files.sort((a, b) => (order.get(a.key) ?? 99) - (order.get(b.key) ?? 99))

  const answers = requirements
    .filter((requirement) => requirement.kind === 'TEXT' && requirement.key !== 'coverLetter')
    .map((requirement) => ({ ...requirement, text: application.answers[requirement.key] }))
    .filter((answer): answer is DocumentRequirement & { text: string } => Boolean(answer.text))

  return (
    <>
      {files.length > 0 && (
        <section className={styles.section} aria-label="Submitted documents">
          <h3 className={styles.eyebrow}>SUBMITTED DOCUMENTS</h3>
          <ul className={styles.documents}>
            {files.map((file) => (
              <li key={file.key}>
                <a href={file.url} target="_blank" rel="noopener noreferrer" className={styles.document}>
                  <Icon name="file" size={18} />
                  <span className={styles.documentText}>
                    <span className={styles.documentName}>{file.name}</span>
                    <span className={styles.documentKind}>{file.label} · as submitted</span>
                  </span>
                  <span className={styles.documentOpen}>Open</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {answers.map((answer) => (
        <section key={answer.key} className={styles.section} aria-label={answer.label}>
          <h3 className={styles.eyebrow}>{answer.label.toUpperCase()}</h3>
          <p className={styles.letter}>{answer.text}</p>
        </section>
      ))}

      {application.coverLetter && (
        <section className={styles.section} aria-label="Cover letter">
          <h3 className={styles.eyebrow}>COVER LETTER</h3>
          <p className={styles.letter}>{application.coverLetter}</p>
        </section>
      )}
    </>
  )
}

function History({
  history,
  isFinal,
  applicantId,
  applicantName,
  companyName,
}: {
  history: StatusHistoryEntry[]
  isFinal: boolean
  applicantId: string
  applicantName: string
  companyName: string
}) {
  function actor(entry: StatusHistoryEntry): string {
    if (entry.changedBy === applicantId) return applicantName
    if (entry.status === 'UNDER_REVIEW' && entry.note === OPENED_NOTE) return `${companyName}, on opening it`
    return companyName
  }

  return (
    <ol className={styles.history}>
      {history.map((entry, index) => {
        const last = index === history.length - 1
        const mark = last ? (isFinal ? styles.markClosed : styles.markLive) : styles.markPast
        const note = entry.note && entry.note !== OPENED_NOTE ? entry.note : ''
        return (
          <li key={`${entry.status}-${entry.timestamp}`} className={styles.entry}>
            <span className={styles.rail} aria-hidden="true">
              <span className={[styles.mark, mark].join(' ')} />
              {!last && <span className={styles.line} />}
            </span>
            <span className={styles.entryBody}>
              <span className={styles.entryHead}>
                <span className={styles.entryLabel}>
                  {RECRUITER_STATUS_LABEL[entry.status as ApplicationStatus]}
                </span>
                <span className={styles.entryDate}>{formatDay(entry.timestamp)}</span>
              </span>
              <span className={styles.entryActor}>by {actor(entry)}</span>
              {note && <q className={styles.entryNote}>{note}</q>}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
