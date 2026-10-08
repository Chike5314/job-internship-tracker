import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { PostingDraft } from '@/api/company'
import { ApiError } from '@/api/errors'
import type { OpportunityType } from '@/api/enums'
import type { JobSummary } from '@/api/types'
import { Button } from '@/ui/Button'
import { ErrorState } from '@/ui/ErrorState'
import { Icon } from '@/ui/Icon'
import { Skeleton } from '@/ui/Skeleton'
import { useToast } from '@/ui/ToastProvider'
import { formatDateShort } from '@/lib/formatDate'
import { BasicsStep } from './BasicsStep'
import { DetailsStep } from './DetailsStep'
import { DocumentsStep } from './DocumentsStep'
import { PostingPreview } from './PostingPreview'
import { PublishStep } from './PublishStep'
import { DEFAULT_DOCUMENTS, blockers, draftFromJob, emptyDraft, toSave } from './postingDraft'
import { useMyCompany, useMyPosting, useSavePosting } from './useCompany'
import styles from './PostingEditorPage.module.css'

type Step = 1 | 2 | 3 | 4

const STATUS_LABEL: Record<JobSummary['postingStatus'], string> = {
  DRAFT: 'Draft',
  PUBLISHED: 'Published',
  CLOSED: 'Closed',
  EXPIRED: 'Expired',
}

function toStep(value: string | null): Step {
  const n = Number(value)
  return n === 2 || n === 3 || n === 4 ? n : 1
}

/** "Saved 2 days ago", for the line beside the title. */
function savedAgo(iso: string, now = Date.now()): string {
  const minutes = Math.floor((now - new Date(iso).getTime()) / 60_000)
  if (minutes < 1) return 'Saved just now'
  if (minutes < 60) return `Saved ${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Saved ${hours} h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `Saved ${days} day${days === 1 ? '' : 's'} ago`
  return `Saved ${formatDateShort(iso)}`
}

/**
 * Loads the posting first, then mounts the editor with it, so the editor can
 * take its starting draft once from data that is already there.
 */
export function PostingEditorPage() {
  const { jobId } = useParams<{ jobId: string }>()
  const existing = useMyPosting(jobId)

  if (jobId && existing.isPending) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>
          <Skeleton height={40} width={320} />
          <Skeleton height={420} radius="var(--radius-lg)" />
        </div>
      </div>
    )
  }

  if (jobId && !existing.data) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>
          <ErrorState />
          <Link to="/company/postings" className={styles.failedBack}>
            Back to postings
          </Link>
        </div>
      </div>
    )
  }

  return <PostingEditor key={jobId ?? 'new'} job={existing.data?.job} />
}

function PostingEditor({ job }: { job?: JobSummary }) {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const step = toStep(params.get('step'))
  const company = useMyCompany()
  const save = useSavePosting()
  const { showToast } = useToast()
  const mainRef = useRef<HTMLElement>(null)

  const baseline = useMemo(() => (job ? draftFromJob(job) : emptyDraft()), [job])
  const [draft, setDraft] = useState<PostingDraft>(baseline)
  const [typeReset, setTypeReset] = useState(false)
  const [tried, setTried] = useState<null | 'save' | 'publish'>(null)
  const [justSaved, setJustSaved] = useState(false)

  // Each step starts at its own top, not wherever the last one was scrolled to.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 })
  }, [step])

  const status = job?.postingStatus
  const live = status === 'PUBLISHED'
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline)
  const title = draft.title.trim() || 'New posting'
  const saveBlockers = blockers(draft, 'save')
  const publishBlockers = blockers(draft, 'publish')
  const basicsDone = !publishBlockers.some((blocker) => blocker.step === 1)

  function change(changes: Partial<PostingDraft>) {
    setDraft((current) => ({ ...current, ...changes }))
    setJustSaved(false)
  }

  /** The type sets the starting document list, so changing it resets that list
   *  and step 3 says so, since an edited list would otherwise vanish unseen. */
  function changeType(next: OpportunityType) {
    change({ opportunityType: next, documentRequirements: DEFAULT_DOCUMENTS[next] })
    setTypeReset(true)
  }

  function goTo(next: Step) {
    setParams(
      (current) => {
        const copy = new URLSearchParams(current)
        if (next === 1) copy.delete('step')
        else copy.set('step', String(next))
        return copy
      },
      { replace: true },
    )
  }

  function submit(publish: boolean) {
    if ((publish ? publishBlockers : saveBlockers).length > 0) {
      setTried(publish ? 'publish' : 'save')
      return
    }
    save.mutate(
      { jobId: job?.jobId, draft: toSave(draft), publish },
      {
        onSuccess: ({ job: saved, publishError }) => {
          setDraft(draftFromJob(saved))
          setJustSaved(true)
          setTried(null)
          if (publishError) {
            showToast(
              publishError instanceof ApiError
                ? `Saved as a draft. ${publishError.message}`
                : 'Saved as a draft, but it did not publish. Try again.',
              'error',
            )
          }
          if (!job) {
            navigate(`/company/postings/${saved.jobId}/edit${step === 1 ? '' : `?step=${step}`}`, { replace: true })
          }
        },
        onError: (error) =>
          showToast(error instanceof ApiError ? error.message : 'The posting did not save. Try again.', 'error'),
      },
    )
  }

  const savedNote = dirty
    ? 'Unsaved changes'
    : !job
      ? 'Not saved yet'
      : justSaved
        ? live
          ? 'Changes saved just now'
          : 'Draft saved just now'
        : savedAgo(job.updatedAt ?? job.createdAt)

  const steps: { n: Step; label: string; hint: string; done: boolean }[] = [
    { n: 1, label: 'The basics', hint: 'Title, type, place, deadline', done: basicsDone },
    // Two and three carry nothing a posting must have beyond the description,
    // which the blockers name, so they are ticked once the recruiter has moved
    // past them, as the board does.
    { n: 2, label: 'Details', hint: 'Salary, level, skills', done: step > 2 },
    { n: 3, label: 'Documents', hint: `${draft.documentRequirements?.length ?? 0} asked for`, done: step > 3 },
    { n: 4, label: 'Review and publish', hint: live ? 'Published' : 'Not published yet', done: live },
  ]

  const showSaveErrors = tried === 'save'
  const showPublishErrors = tried === 'publish'

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div className={styles.headLeft}>
          <Link to="/company/postings" className={['glass-soft', styles.backButton].join(' ')} aria-label="Back to postings">
            <span className={styles.backMark}>
              <Icon name="chevron-right" size={18} />
            </span>
          </Link>
          <div className={styles.headText}>
            <p className={styles.crumb}>Postings / {title}</p>
            <div className={styles.titleRow}>
              <span className={styles.title}>{title}</span>
              <span className={[styles.status, styles[(status ?? 'DRAFT').toLowerCase()]].join(' ')}>
                <span className={styles.statusDot} aria-hidden="true" />
                {STATUS_LABEL[status ?? 'DRAFT']}
              </span>
              <span className={styles.saved} aria-live="polite">
                {savedNote}
              </span>
            </div>
          </div>
        </div>
        <div className={styles.headActions}>
          <Button variant="secondary" className={styles.headButton} loading={save.isPending} onClick={() => submit(false)}>
            {status === undefined || status === 'DRAFT' ? 'Save draft' : 'Save changes'}
          </Button>
          {step < 4 && (
            <Button variant="primary" className={[styles.headButton, styles.continue].join(' ')} onClick={() => goTo((step + 1) as Step)}>
              Continue
            </Button>
          )}
        </div>
      </header>

      <div className={styles.body}>
        <nav aria-label="Steps" className={styles.steps}>
          <ol className={styles.stepList}>
            {steps.map((item) => {
              const current = item.n === step
              return (
                <li key={item.n}>
                  <button
                    type="button"
                    className={[styles.stepButton, current ? styles.stepCurrent : ''].join(' ')}
                    aria-current={current ? 'step' : undefined}
                    onClick={() => goTo(item.n)}
                  >
                    <span
                      className={[styles.mark, current ? styles.markCurrent : item.done ? styles.markDone : ''].join(' ')}
                      aria-hidden="true"
                    >
                      {item.done && !current ? <Icon name="confirm" size={14} /> : item.n}
                    </span>
                    <span className={styles.stepText}>
                      <span className={styles.stepLabel}>{item.label}</span>
                      <span className={styles.stepHint}>{item.hint}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
          <p className={styles.note}>
            {live
              ? 'This posting is live. Saved changes reach applicants straight away.'
              : 'Drafts are saved to your company and only you can see them. Nothing reaches applicants until you publish.'}
          </p>
        </nav>

        <main id="main" ref={mainRef} className={styles.main}>
          {showSaveErrors && saveBlockers.length > 0 && (
            <div role="alert" className={styles.blockers}>
              <p className={styles.blockersTitle}>Before you can save</p>
              <ul>
                {saveBlockers.map((blocker) => (
                  <li key={blocker.text}>
                    ·{' '}
                    {blocker.step === step ? (
                      blocker.text
                    ) : (
                      <button type="button" className={styles.blockerLink} onClick={() => goTo(blocker.step)}>
                        {blocker.text}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {step === 1 && (
            <BasicsStep
              draft={draft}
              onChange={change}
              onTypeChange={changeType}
              typeLocked={Boolean(job)}
              showSaveErrors={showSaveErrors}
              showPublishErrors={showPublishErrors}
            />
          )}
          {step === 2 && (
            <DetailsStep draft={draft} onChange={change} showErrors={showSaveErrors || showPublishErrors} />
          )}
          {step === 3 && (
            <DocumentsStep
              draft={draft}
              onChange={change}
              typeReset={typeReset}
              showErrors={showSaveErrors || showPublishErrors}
            />
          )}
          {step === 4 && (
            <PublishStep
              draft={draft}
              onEdit={goTo}
              status={status}
              verification={company.data?.company.verificationStatus}
              companyName={company.data?.company.companyName ?? 'your company'}
              deadline={draft.applicationDeadline}
              blockers={publishBlockers}
              showBlockers={showPublishErrors}
              pending={save.isPending}
              onPublish={() => submit(true)}
              onSave={() => submit(false)}
            />
          )}
        </main>

        <PostingPreview draft={draft} company={company.data?.company} />
      </div>
    </div>
  )
}
