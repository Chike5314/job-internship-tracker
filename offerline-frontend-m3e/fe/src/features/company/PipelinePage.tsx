import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ApiError } from '@/api/errors'
import { OPPORTUNITY_TYPE_LABEL, WORK_MODALITY_LABEL, type ApplicationStatus } from '@/api/enums'
import type { ExportResult, JobSummary, PipelineRow } from '@/api/types'
import { Button } from '@/ui/Button'
import { ErrorState } from '@/ui/ErrorState'
import { Icon } from '@/ui/Icon'
import { Skeleton } from '@/ui/Skeleton'
import { useToast } from '@/ui/ToastProvider'
import { formatDateShort } from '@/lib/formatDate'
import { formatSalary } from '@/lib/formatSalary'
import { ApplicationDrawer } from './ApplicationDrawer'
import { PipelineCard } from './PipelineCard'
import { BULK_LIMIT, COLUMNS, RECRUITER_STATUS_LABEL, refusalReason } from './pipeline'
import {
  useBulkStatus,
  useExportPipeline,
  useMyCompany,
  useMyPosting,
  usePipeline,
  useUpdatePosting,
} from './useCompany'
import styles from './PipelinePage.module.css'

const POSTING_STATUS_LABEL: Record<JobSummary['postingStatus'], string> = {
  DRAFT: 'Draft',
  PUBLISHED: 'Published',
  CLOSED: 'Closed',
  EXPIRED: 'Expired',
}

/** "Full-time job · Hybrid, Douala · XAF 650k–850k / month · 2 openings · Closes 30 Sep" */
function metaLine(job: JobSummary): string {
  const where =
    job.workModality === 'REMOTE'
      ? WORK_MODALITY_LABEL.REMOTE
      : [WORK_MODALITY_LABEL[job.workModality], job.city].filter(Boolean).join(', ')
  const salary = job.salary?.disclosed ? formatSalary(job.salary, { compact: true }) : ''
  const openings = job.openings ? `${job.openings} opening${job.openings === 1 ? '' : 's'}` : ''
  const deadline = job.applicationDeadline
    ? `${new Date(job.applicationDeadline).getTime() < Date.now() ? 'Closed' : 'Closes'} ${formatDateShort(job.applicationDeadline)}`
    : ''
  return [OPPORTUNITY_TYPE_LABEL[job.opportunityType], where, salary, openings, deadline]
    .filter(Boolean)
    .join(' · ')
}

type BulkResult = { done: string; refused: string[] }

/** "2 applications moved to under review. Each applicant has been emailed." */
function bulkSummary(moved: number, target: ApplicationStatus): string {
  const where = RECRUITER_STATUS_LABEL[target].toLowerCase()
  if (moved === 0) return 'No applications were changed.'
  if (moved === 1) return `1 application moved to ${where}. The applicant has been emailed.`
  return `${moved} applications moved to ${where}. Each applicant has been emailed.`
}

export function PipelinePage() {
  const { jobId } = useParams<{ jobId: string }>()
  const [params, setParams] = useSearchParams()
  const openId = params.get('application') ?? undefined

  const posting = useMyPosting(jobId)
  const pipeline = usePipeline(jobId)
  const company = useMyCompany()
  const bulk = useBulkStatus(jobId ?? '')
  const exportCsv = useExportPipeline()
  const update = useUpdatePosting(jobId ?? '')
  const { showToast } = useToast()

  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [rejecting, setRejecting] = useState(false)
  const [bulkNote, setBulkNote] = useState('')
  const [result, setResult] = useState<BulkResult | null>(null)
  const [exported, setExported] = useState<ExportResult | null>(null)

  const rows = useMemo(() => pipeline.data?.applications ?? [], [pipeline.data])

  const byColumn = useMemo(() => {
    const where = new Map<ApplicationStatus, string>()
    for (const column of COLUMNS) {
      for (const status of column.statuses) where.set(status, column.key)
    }
    const map = new Map<string, PipelineRow[]>()
    // Newest first in every column, so the one most recently sent is on top.
    const ordered = [...rows].sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime())
    for (const row of ordered) {
      const key = where.get(row.status)
      if (!key) continue
      const bucket = map.get(key)
      if (bucket) bucket.push(row)
      else map.set(key, [row])
    }
    return map
  }, [rows])

  function toggle(applicationId: string) {
    setResult(null)
    setPicked((current) => {
      const next = new Set(current)
      if (next.has(applicationId)) next.delete(applicationId)
      else if (next.size < BULK_LIMIT) next.add(applicationId)
      return next
    })
  }

  function clearPicked() {
    setPicked(new Set())
    setRejecting(false)
    setBulkNote('')
  }

  function runBulk(status: ApplicationStatus, note?: string) {
    const applicationIds = Array.from(picked)
    if (applicationIds.length === 0) return
    bulk.mutate(
      { applicationIds, status, note: note || undefined },
      {
        onSuccess: (outcome) => {
          const byId = new Map(rows.map((row) => [row.applicationId, row]))
          clearPicked()
          setResult({
            done: bulkSummary(outcome.updated.length, status),
            refused: outcome.refused.map(
              (item) => `Not changed: ${refusalReason(byId.get(item.applicationId), status, item.reason)}`,
            ),
          })
        },
        onError: (error) =>
          showToast(error instanceof ApiError ? error.message : 'Nothing was changed. Try again.', 'error'),
      },
    )
  }

  function runExport() {
    if (!jobId) return
    exportCsv.mutate(
      { jobId },
      {
        onSuccess: setExported,
        onError: (error) =>
          showToast(error instanceof ApiError ? error.message : 'The export did not finish. Try again.', 'error'),
      },
    )
  }

  function closePosting(job: JobSummary) {
    update.mutate(
      { postingStatus: 'CLOSED' },
      {
        onSuccess: () => showToast(`${job.title} is closed.`),
        onError: (error) =>
          showToast(error instanceof ApiError ? error.message : 'The posting did not close. Try again.', 'error'),
      },
    )
  }

  // Opening adds a history entry, so Back closes the drawer; closing replaces
  // it, so Back after that does not open it again.
  function open(applicationId: string) {
    setParams((current) => {
      const next = new URLSearchParams(current)
      next.set('application', applicationId)
      return next
    })
  }

  function close() {
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        next.delete('application')
        return next
      },
      { replace: true },
    )
  }

  if (!jobId) return <ErrorState />

  const job = posting.data?.job
  const total = pipeline.data?.count ?? rows.length
  const openRow = openId ? rows.find((row) => row.applicationId === openId) : undefined

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div className={styles.titles}>
          <Link to="/company/postings" className={styles.back}>
            <span className={styles.backMark}>
              <Icon name="chevron-right" size={14} />
            </span>
            All postings
          </Link>
          {posting.isPending ? (
            <>
              <Skeleton width={320} height={34} />
              <Skeleton width={420} height={18} />
            </>
          ) : job ? (
            <>
              <div className={styles.titleRow}>
                <h1 className={styles.title}>{job.title}</h1>
                <span className={[styles.status, styles[job.postingStatus.toLowerCase()]].join(' ')}>
                  <span className={styles.statusDot} aria-hidden="true" />
                  {POSTING_STATUS_LABEL[job.postingStatus]}
                </span>
              </div>
              <p className={styles.meta}>{metaLine(job)}</p>
            </>
          ) : (
            <h1 className={styles.title}>Applications</h1>
          )}
        </div>

        <div className={styles.headActions}>
          <p className={styles.total}>
            <span className={styles.totalValue}>{total}</span>
            <span className={styles.totalLabel}>applicant{total === 1 ? '' : 's'}</span>
          </p>
          <Button variant="secondary" className={styles.headButton} loading={exportCsv.isPending} onClick={runExport}>
            <Icon name="download" size={16} />
            Export CSV
          </Button>
          <Link to={`/company/postings/${jobId}/edit`} className={styles.headLink}>
            Edit posting
          </Link>
          {job?.postingStatus === 'PUBLISHED' && (
            <button
              type="button"
              className={styles.closePosting}
              onClick={() => closePosting(job)}
              disabled={update.isPending}
            >
              Close posting
            </button>
          )}
        </div>

        {exported && (
          <div className={['glass-dense', styles.exportPanel].join(' ')} role="status">
            <div className={styles.exportHead}>
              <div>
                <p className={styles.exportTitle}>Export ready</p>
                <p className={styles.exportFile}>applications.csv</p>
              </div>
              <button type="button" className={styles.dismiss} onClick={() => setExported(null)} aria-label="Dismiss">
                <Icon name="close" size={14} />
              </button>
            </div>
            <p className={styles.exportBody}>
              Applicant, current status, key dates and full history for {exported.rows} application
              {exported.rows === 1 ? '' : 's'}. Documents are not included.
            </p>
            <div className={styles.exportFoot}>
              <span className={styles.exportExpiry}>The download link expires shortly.</span>
              <a href={exported.downloadUrl} className={styles.download} target="_blank" rel="noopener noreferrer">
                <Icon name="download" size={14} />
                Download
              </a>
            </div>
          </div>
        )}
      </header>

      {pipeline.isError ? (
        <ErrorState />
      ) : (
        <div className={styles.board}>
          {COLUMNS.map((column) => {
            const items = byColumn.get(column.key) ?? []
            return (
              <section
                key={column.key}
                className={['glass-soft', styles.column].join(' ')}
                aria-labelledby={`column-${column.key}`}
              >
                <header className={styles.columnHead}>
                  <p className={styles.columnTitleRow}>
                    <span id={`column-${column.key}`} className={styles.columnTitle}>
                      <span className={styles.dot} style={{ background: column.dot }} aria-hidden="true" />
                      {column.label}
                    </span>
                    <span className={styles.count}>{pipeline.isPending ? '' : items.length}</span>
                  </p>
                  <p className={styles.hint}>{column.hint}</p>
                </header>
                <ul className={styles.cards}>
                  {pipeline.isPending ? (
                    <>
                      <li>
                        <Skeleton height={92} radius="var(--radius-md)" />
                      </li>
                      <li>
                        <Skeleton height={92} radius="var(--radius-md)" />
                      </li>
                    </>
                  ) : items.length === 0 ? (
                    <li className={styles.none}>No one here yet</li>
                  ) : (
                    items.map((row) => (
                      <PipelineCard
                        key={row.applicationId}
                        row={row}
                        picked={picked.has(row.applicationId)}
                        current={row.applicationId === openId}
                        pickDisabled={!picked.has(row.applicationId) && picked.size >= BULK_LIMIT}
                        onToggle={() => toggle(row.applicationId)}
                        onOpen={() => open(row.applicationId)}
                      />
                    ))
                  )}
                </ul>
              </section>
            )
          })}
        </div>
      )}

      {picked.size > 0 && !result && (
        <div className={['glass-dense', styles.float].join(' ')} role="region" aria-label="Bulk actions">
          <div className={styles.bulkRow}>
            <p className={styles.bulkText}>
              <span className={styles.bulkCount}>
                {picked.size === 1 ? '1 application selected' : `${picked.size} applications selected`}
              </span>
              <span className={styles.bulkHint}>Up to {BULK_LIMIT} at a time. Each one is checked on its own.</span>
            </p>
            {!rejecting && (
              <span className={styles.bulkActions}>
                <button
                  type="button"
                  className={styles.bulkReview}
                  onClick={() => runBulk('UNDER_REVIEW')}
                  disabled={bulk.isPending}
                >
                  Mark under review
                </button>
                <button type="button" className={styles.bulkReject} onClick={() => setRejecting(true)}>
                  Reject…
                </button>
              </span>
            )}
            <button type="button" className={styles.bulkQuiet} onClick={clearPicked}>
              Clear
            </button>
          </div>
          {rejecting && (
            <div className={styles.rejectRow}>
              <label className={styles.rejectField}>
                <span className={styles.rejectLabel}>Shared note for each applicant (optional)</span>
                <input
                  type="text"
                  value={bulkNote}
                  onChange={(event) => setBulkNote(event.target.value)}
                  maxLength={500}
                  placeholder="Thank you for applying. We have chosen to move forward with other candidates."
                  className={styles.rejectInput}
                  autoFocus
                />
              </label>
              <button
                type="button"
                className={styles.rejectConfirm}
                onClick={() => runBulk('REJECTED', bulkNote.trim())}
                disabled={bulk.isPending}
              >
                Reject {picked.size}
              </button>
              <button
                type="button"
                className={styles.bulkQuiet}
                onClick={() => {
                  setRejecting(false)
                  setBulkNote('')
                }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {result && (
        <div className={['glass-dense', styles.float, styles.result].join(' ')} role="status">
          <span className={styles.resultMark} aria-hidden="true">
            <Icon name="confirm" size={16} />
          </span>
          <p className={styles.resultText}>
            <span className={styles.resultDone}>{result.done}</span>
            {result.refused.map((line) => (
              <span key={line} className={styles.refused}>
                {line}
              </span>
            ))}
          </p>
          <button type="button" className={styles.dismiss} onClick={() => setResult(null)} aria-label="Dismiss">
            <Icon name="close" size={14} />
          </button>
        </div>
      )}

      {openId && (
        <ApplicationDrawer
          key={openId}
          applicationId={openId}
          jobId={jobId}
          statusWhenOpened={openRow?.status}
          requirements={job?.documentRequirements ?? []}
          companyName={company.data?.company.companyName ?? job?.companyName ?? 'The company'}
          officeAddress={company.data?.company.officeAddress}
          onClose={close}
        />
      )}
    </div>
  )
}
