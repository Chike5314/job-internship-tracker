import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  APPLICATION_STATUS_LABEL,
  OPPORTUNITY_TYPE_LABEL,
  WORK_MODALITY_LABEL,
  type ApplicationStatus,
} from '@/api/enums'
import type { PipelineRow } from '@/api/types'
import { BackLink } from '@/ui/BackLink'
import { Button } from '@/ui/Button'
import { ButtonLink } from '@/ui/ButtonLink'
import { Checkbox } from '@/ui/Checkbox'
import { Dialog } from '@/ui/Dialog'
import { EmptyState } from '@/ui/EmptyState'
import { ErrorState } from '@/ui/ErrorState'
import { Icon } from '@/ui/Icon'
import { Skeleton } from '@/ui/Skeleton'
import { StatusTag } from '@/ui/StatusTag'
import { Textarea } from '@/ui/Textarea'
import { useToast } from '@/ui/ToastProvider'
import { formatDate, formatDateShort } from '@/lib/formatDate'
import { useBulkStatus, useExportPipeline, useMyPosting, usePipeline } from './useCompany'
import styles from './PipelinePage.module.css'

/**
 * The board's columns, in the order an application moves through them.
 *
 * The column is not the status: every decided application shares the last
 * column, because a decision is one place on a board even though the state
 * machine records four different ones. A column per ending would read as four
 * more places still to go.
 */
const COLUMNS: { key: string; label: string; hint: string; statuses: ApplicationStatus[] }[] = [
  { key: 'new', label: 'New', hint: 'Not opened yet', statuses: ['SUBMITTED'] },
  {
    key: 'review',
    label: 'Under review',
    hint: 'Opened and being read',
    statuses: ['UNDER_REVIEW'],
  },
  {
    key: 'interview',
    label: 'Interview',
    hint: 'Interview booked',
    statuses: ['INTERVIEW_SCHEDULED'],
  },
  {
    key: 'offer',
    label: 'Offer extended',
    hint: 'Waiting on the applicant',
    statuses: ['OFFER_EXTENDED'],
  },
  {
    key: 'decided',
    label: 'Decided',
    hint: 'Closed, kept for records',
    statuses: ['OFFER_ACCEPTED', 'REJECTED', 'OFFER_DECLINED', 'WITHDRAWN'],
  },
]

/** Fifty is the API's own limit on one bulk call. */
const BULK_LIMIT = 50

export function PipelinePage() {
  const { jobId } = useParams<{ jobId: string }>()
  const posting = useMyPosting(jobId)
  const pipeline = usePipeline(jobId)
  const bulk = useBulkStatus(jobId ?? '')
  const exportCsv = useExportPipeline()
  const { showToast } = useToast()

  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [rejecting, setRejecting] = useState(false)
  const [note, setNote] = useState('')

  const rows = useMemo(() => pipeline.data?.applications ?? [], [pipeline.data])

  const byColumn = useMemo(() => {
    const where = new Map<ApplicationStatus, string>()
    for (const column of COLUMNS) {
      for (const status of column.statuses) where.set(status, column.key)
    }
    const map = new Map<string, PipelineRow[]>()
    for (const row of rows) {
      const key = where.get(row.status)
      if (!key) continue
      const bucket = map.get(key)
      if (bucket) bucket.push(row)
      else map.set(key, [row])
    }
    return map
  }, [rows])

  function toggle(applicationId: string) {
    setPicked((current) => {
      const next = new Set(current)
      if (next.has(applicationId)) next.delete(applicationId)
      else if (next.size < BULK_LIMIT) next.add(applicationId)
      return next
    })
  }

  async function run(status: ApplicationStatus, withNote?: string) {
    const applicationIds = Array.from(picked)
    if (applicationIds.length === 0) return
    const result = await bulk.mutateAsync({ applicationIds, status, note: withNote || undefined })
    setPicked(new Set())
    setRejecting(false)
    setNote('')
    if (result.refused.length === 0) {
      showToast(`${result.updated.length} moved to ${APPLICATION_STATUS_LABEL[status].toLowerCase()}.`)
    } else {
      showToast(
        `${result.updated.length} moved, ${result.refused.length} left where they were. Each one is checked on its own.`,
      )
    }
  }

  if (!jobId) return <ErrorState />

  const job = posting.data?.job
  const place = [job?.city, job?.country].filter(Boolean).join(', ')

  return (
    <div className={styles.page}>
      <BackLink to="/company/postings">All postings</BackLink>

      <header className={styles.head}>
        <div className={styles.headText}>
          {posting.isPending ? (
            <Skeleton width={320} height={34} />
          ) : (
            <>
              <h1 className="t-display-md">{job?.title}</h1>
              <p className={['t-body-sm', styles.muted].join(' ')}>
                {job && OPPORTUNITY_TYPE_LABEL[job.opportunityType]}
                {job && ` · ${WORK_MODALITY_LABEL[job.workModality]}`}
                {place && ` · ${place}`}
                {job?.openings ? ` · ${job.openings} opening${job.openings === 1 ? '' : 's'}` : ''}
                {job?.applicationDeadline ? ` · Closes ${formatDate(job.applicationDeadline)}` : ''}
              </p>
            </>
          )}
        </div>

        <div className={styles.headActions}>
          <span className={['t-figure', styles.total].join(' ')}>
            {pipeline.data?.count ?? 0}
            <span className={['t-caption', styles.muted].join(' ')}> applicants</span>
          </span>
          <Button
            variant="secondary"
            loading={exportCsv.isPending}
            onClick={async () => {
              const result = await exportCsv.mutateAsync({ jobId })
              window.open(result.downloadUrl, '_blank', 'noopener')
              showToast(`${result.rows} rows exported. The link expires shortly.`)
            }}
          >
            <Icon name="export" size={16} />
            Export CSV
          </Button>
          <ButtonLink variant="secondary" to={`/company/postings/${jobId}/edit`}>
            Edit posting
          </ButtonLink>
        </div>
      </header>

      {picked.size > 0 && (
        <div className={['glass-dense', styles.bulk].join(' ')} role="region" aria-label="Bulk actions">
          <p className="t-body-sm">
            <strong>{picked.size} selected.</strong> Up to {BULK_LIMIT} at a time. Each one is
            checked on its own, so some may stay where they are.
          </p>
          <div className={styles.bulkActions}>
            <Button variant="secondary" loading={bulk.isPending} onClick={() => void run('UNDER_REVIEW')}>
              Mark under review
            </Button>
            <Button variant="danger" onClick={() => setRejecting(true)}>
              Reject
            </Button>
            <Button variant="quiet" onClick={() => setPicked(new Set())}>
              Clear
            </Button>
          </div>
        </div>
      )}

      {pipeline.isPending ? (
        <div className={styles.board}>
          {COLUMNS.map((column) => (
            <Skeleton key={column.key} height={220} />
          ))}
        </div>
      ) : pipeline.isError ? (
        <ErrorState />
      ) : rows.length === 0 ? (
        <EmptyState
          heading="No applications yet"
          body="They appear here as they arrive, newest in the first column."
        />
      ) : (
        <>
          <div className={styles.board}>
            {COLUMNS.map((column) => {
              const items = byColumn.get(column.key) ?? []
              return (
                <section key={column.key} className={styles.column}>
                  <header className={styles.columnHead}>
                    <p className="t-heading-sm">{column.label}</p>
                    <span className={['t-figure', styles.count].join(' ')}>{items.length}</span>
                    <p className={['t-caption', styles.muted].join(' ')}>{column.hint}</p>
                  </header>
                  <ul className={styles.cards}>
                    {items.map((row) => (
                      <ApplicantCard
                        key={row.applicationId}
                        row={row}
                        decided={column.key === 'decided'}
                        picked={picked.has(row.applicationId)}
                        onToggle={() => toggle(row.applicationId)}
                      />
                    ))}
                    {items.length === 0 && (
                      <li className={['t-body-sm', styles.none].join(' ')}>No one here yet</li>
                    )}
                  </ul>
                </section>
              )
            })}
          </div>

        </>
      )}

      <Dialog
        open={rejecting}
        onClose={() => setRejecting(false)}
        title={`Reject ${picked.size} application${picked.size === 1 ? '' : 's'}`}
        footer={
          <div className={styles.dialogActions}>
            <Button variant="quiet" onClick={() => setRejecting(false)}>
              Cancel
            </Button>
            <Button variant="danger" loading={bulk.isPending} onClick={() => void run('REJECTED', note)}>
              Reject {picked.size}
            </Button>
          </div>
        }
      >
        <p className={['t-body-sm', styles.muted].join(' ')}>
          Each applicant is told, and the note below is sent to all of them. An application that
          cannot move is left exactly where it is.
        </p>
        <Textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Shared note, sent to each applicant (optional)"
          aria-label="Shared note sent to each applicant"
          rows={4}
        />
      </Dialog>
    </div>
  )
}

/** How long the application has sat where it is, in the board's shorthand. */
function timeInStage(iso: string): string {
  const hours = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000)
  if (hours < 1) return 'just now'
  if (hours < 24) return `${hours}h in stage`
  return `${Math.floor(hours / 24)}d in stage`
}

const CHIP_TIME = new Intl.DateTimeFormat('en', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/** "4 Oct, 01:43" reads as one unit on a card; the comma earns nothing here. */
function chipTime(iso: string): string {
  return CHIP_TIME.format(new Date(iso)).replace(',', '')
}

function ApplicantCard({
  row,
  decided,
  picked,
  onToggle,
}: {
  row: PipelineRow
  decided: boolean
  picked: boolean
  onToggle: () => void
}) {
  const initials = (row.applicantName || row.applicantEmail || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')

  // Opening an application is what moves it off SUBMITTED, so sitting at that
  // status is exactly what "nobody has read this yet" means.
  const unread = row.status === 'SUBMITTED'
  const interview = row.nextInterview
  const awaiting = interview?.state === 'PROPOSED'

  return (
    <li className={['glass-dense', styles.card, picked ? styles.cardPicked : ''].join(' ')}>
      {/* The label names the applicant so a screen reader hears which row the
          checkbox belongs to; it is hidden visually because the name is already
          beside it. */}
      <Checkbox
        checked={picked}
        onChange={onToggle}
        label={`Select ${row.applicantName || row.applicantEmail}`}
        className={styles.pick}
      />
      <span className={styles.avatar} aria-hidden="true">
        {initials}
      </span>
      <span className={styles.cardText}>
        <span className={styles.nameRow}>
          {/* The applicant's own detail route, which a recruiter may read.
              Opening it is what moves a SUBMITTED application to UNDER_REVIEW
              and freezes it, so this link is the act, not just a view. */}
          <Link to={`/applications/${row.applicationId}`} className="t-body">
            {row.applicantName || row.applicantEmail}
          </Link>
          {unread && <span className={styles.unread} aria-label="Not opened yet" role="img" />}
        </span>

        {interview && (
          <span className={[styles.chip, awaiting ? styles.chipAwaiting : styles.chipConfirmed].join(' ')}>
            {chipTime(interview.scheduledAt)} · {awaiting ? 'Awaiting' : 'Confirmed'}
          </span>
        )}

        {decided && (
          <span className={styles.decidedTag}>
            <StatusTag status={row.status} />
          </span>
        )}

        <span className={styles.cardFoot}>
          <span className={['t-caption', styles.muted].join(' ')}>
            Applied {formatDateShort(row.appliedAt)}
          </span>
          {!decided && (
            <span className={['t-caption', styles.muted].join(' ')}>
              {timeInStage(row.statusChangedAt)}
            </span>
          )}
        </span>
      </span>
    </li>
  )
}
