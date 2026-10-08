import { useId, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { ApplicationStatus } from '@/api/enums'
import type { DocumentRequirement, PipelineRow, RecruiterApplication } from '@/api/types'
import { ErrorState } from '@/ui/ErrorState'
import { Icon } from '@/ui/Icon'
import { Skeleton } from '@/ui/Skeleton'
import { nameFromUrl } from '@/lib/fileNames'
import { DrawerContent } from './ApplicationDrawer'
import { COLUMNS, applicantName } from './pipeline'
import { useMyCompany, useMyPosting, usePipeline, useRecruiterApplication } from './useCompany'
import styles from './ApplicationReviewPage.module.css'

/** The stored key's path, which ends in the name the file was uploaded under. */
function pathOf(url: string): string {
  try {
    return decodeURIComponent(new URL(url).pathname)
  } catch {
    return url
  }
}

/** Files a browser can show in a frame. Anything else is offered as a download. */
const SHOWABLE = /\.(pdf|png|jpe?g|gif|webp)$/i
const IMAGE = /\.(png|jpe?g|gif|webp)$/i

type Tab =
  | { kind: 'file'; key: string; label: string; name: string; preview: string; download: string }
  | { kind: 'text'; key: string; label: string; text: string }

/** The board's own order: by column, then newest first inside each. */
function boardOrder(rows: PipelineRow[]): PipelineRow[] {
  const rank = new Map<ApplicationStatus, number>()
  COLUMNS.forEach((column, index) => column.statuses.forEach((status) => rank.set(status, index)))
  return [...rows].sort(
    (a, b) =>
      (rank.get(a.status) ?? 99) - (rank.get(b.status) ?? 99) ||
      new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime(),
  )
}

function tabsFor(application: RecruiterApplication, requirements: DocumentRequirement[]): Tab[] {
  const labelled = new Map(requirements.map((requirement) => [requirement.key, requirement.label]))
  const order = new Map(requirements.map((requirement, index) => [requirement.key, index]))
  const previews = application.documentPreviewUrls ?? {}
  const files: Tab[] = Object.entries(application.documentUrls)
    .sort(([a], [b]) => (order.get(a) ?? 99) - (order.get(b) ?? 99))
    .map(([key, download]) => {
      const label = labelled.get(key) ?? key
      return { kind: 'file', key, label, name: nameFromUrl(download) ?? label, preview: previews[key] ?? download, download }
    })
  const texts: Tab[] = requirements
    .filter((requirement) => requirement.kind === 'TEXT' && requirement.key !== 'coverLetter')
    .flatMap((requirement) => {
      const text = application.answers[requirement.key]
      return text ? [{ kind: 'text' as const, key: requirement.key, label: requirement.label, text }] : []
    })
  if (application.coverLetter) {
    texts.unshift({ kind: 'text', key: 'coverLetter', label: 'Cover letter', text: application.coverLetter })
  }
  return [...files, ...texts]
}

/**
 * One application on a page of its own, for reading it properly: the documents
 * open in the page on the left, and everything the drawer offers sits on the
 * right. Previous and next step through the posting's applications in the
 * board's order, so a recruiter can work down a column without going back.
 */
export function ApplicationReviewPage() {
  const { jobId = '', applicationId = '' } = useParams<{ jobId: string; applicationId: string }>()
  const navigate = useNavigate()
  const titleId = useId()
  const posting = useMyPosting(jobId)
  const pipeline = usePipeline(jobId)
  const company = useMyCompany()
  const query = useRecruiterApplication(applicationId, jobId)

  const ordered = useMemo(() => boardOrder(pipeline.data?.applications ?? []), [pipeline.data])
  const at = ordered.findIndex((row) => row.applicationId === applicationId)
  const previous = at > 0 ? ordered[at - 1] : undefined
  const next = at >= 0 && at < ordered.length - 1 ? ordered[at + 1] : undefined
  // Read once, from the board's copy, before this read moves it to review.
  const [openedAsNew] = useState(() => ordered[at]?.status === 'SUBMITTED')

  const board = `/company/postings/${jobId}/pipeline`
  const job = posting.data?.job
  const application = query.data?.application
  const go = (row: PipelineRow) => navigate(`/company/postings/${jobId}/applications/${row.applicationId}`)

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <Link to={board} className={styles.back}>
          <span className={styles.backMark}>
            <Icon name="chevron-right" size={14} />
          </span>
          {job ? `${job.title} board` : 'Back to the board'}
        </Link>
        <div className={styles.stepper}>
          {at >= 0 && (
            <span className={styles.position}>
              {at + 1} of {ordered.length}
            </span>
          )}
          <button type="button" className={styles.step} disabled={!previous} onClick={() => previous && go(previous)}>
            Previous{previous ? `: ${applicantName(previous)}` : ''}
          </button>
          <button type="button" className={styles.step} disabled={!next} onClick={() => next && go(next)}>
            Next{next ? `: ${applicantName(next)}` : ''}
          </button>
        </div>
      </header>

      {query.isError ? (
        <ErrorState />
      ) : !application ? (
        <div className={styles.layout}>
          <Skeleton height={640} radius="var(--radius-lg)" />
          <Skeleton height={640} radius="var(--radius-lg)" />
        </div>
      ) : (
        <div className={styles.layout}>
          <DocumentViewer
            key={application.applicationId}
            tabs={tabsFor(application, job?.documentRequirements ?? [])}
          />
          <aside className={['glass-dense', styles.side].join(' ')} aria-labelledby={titleId}>
            <DrawerContent
              key={application.applicationId}
              titleId={titleId}
              application={application}
              jobId={jobId}
              openedAsNew={openedAsNew}
              requirements={job?.documentRequirements ?? []}
              companyName={company.data?.company.companyName ?? job?.companyName ?? 'The company'}
              officeAddress={company.data?.company.officeAddress}
              onClose={() => navigate(board)}
              layout="page"
            />
          </aside>
        </div>
      )}
    </div>
  )
}

function DocumentViewer({ tabs }: { tabs: Tab[] }) {
  const [current, setCurrent] = useState(tabs[0]?.key)
  const tab = tabs.find((item) => item.key === current) ?? tabs[0]

  if (!tab) {
    return (
      <section className={['glass-soft', styles.viewer, styles.empty].join(' ')}>
        <p>This application carries no documents or written answers.</p>
      </section>
    )
  }

  return (
    <section className={['glass-soft', styles.viewer].join(' ')} aria-label="Documents">
      <div className={styles.tabs} role="tablist" aria-label="Documents">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={item.key === tab.key}
            className={[styles.tab, item.key === tab.key ? styles.tabOn : ''].join(' ')}
            onClick={() => setCurrent(item.key)}
          >
            <Icon name={item.kind === 'file' ? 'file' : 'edit'} size={16} />
            {item.label}
          </button>
        ))}
      </div>

      {tab.kind === 'text' ? (
        <div className={styles.text} role="tabpanel">
          <h2 className={styles.textTitle}>{tab.label}</h2>
          <p className={styles.letter}>{tab.text}</p>
        </div>
      ) : (
        <div className={styles.file} role="tabpanel">
          <div className={styles.fileBar}>
            <span className={styles.fileName}>{tab.name}</span>
            <a href={tab.preview} target="_blank" rel="noopener noreferrer" className={styles.fileAction}>
              Open in a new tab
            </a>
            <a href={tab.download} className={styles.fileAction}>
              Download
            </a>
          </div>
          {SHOWABLE.test(pathOf(tab.download)) ? (
            IMAGE.test(pathOf(tab.download)) ? (
              <img src={tab.preview} alt={tab.label} className={styles.image} />
            ) : (
              <iframe src={tab.preview} title={tab.label} className={styles.frame} />
            )
          ) : (
            <div className={styles.noPreview}>
              <Icon name="file" size={32} />
              <p>
                {tab.name} cannot be shown in the browser. Download it to read it, exactly as the
                applicant sent it.
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
