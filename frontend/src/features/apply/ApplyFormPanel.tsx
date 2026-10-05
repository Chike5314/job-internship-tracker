import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { submitApplication } from '@/api/applications'
import { ApiError, fieldErrors, missingDocuments } from '@/api/errors'
import { queryKeys } from '@/api/queryKeys'
import type { ApplicationSummary, CompanySnippet, CvEntry, DocumentRequirement, JobSummary, Profile } from '@/api/types'
import { Spinner } from '@/ui/Spinner'
import { Textarea } from '@/ui/Textarea'
import { useToast } from '@/ui/ToastProvider'
import { nameFromUrl } from '@/lib/fileNames'
import {
  buildSubmitBody,
  deriveInitialState,
  outstandingItems,
  requirementChecklist,
  requiredProgress,
  type ApplyFormState,
} from './applyForm'
import { ApplyPostingSummary } from './ApplyPostingSummary'
import { ApplySubmitted, type SentLine } from './ApplySubmitted'
import { CvRequirementField } from './CvRequirementField'
import { FileRequirementField } from './FileRequirementField'
import { TextRequirementField } from './TextRequirementField'
import { YourDetailsStep, YourStudiesStep } from './ProfileRecapSteps'
import { StepCard } from './StepCard'
import { useApplyForm } from './useApplyForm'
import styles from './ApplyFormPanel.module.css'

interface ApplyFormPanelProps {
  job: JobSummary
  company?: CompanySnippet
  profile?: Profile
  cvs: CvEntry[]
  existingApplications: ApplicationSummary[]
}

/** What a step says about itself. The posting names every requirement and
 *  the recruiter may rename one, so these only add a line of help for the
 *  standard keys (src/common/documents.py) and fall back to who asked. */
function describe(requirement: DocumentRequirement, companyName: string): string {
  switch (requirement.key) {
    case 'coverLetter':
      return 'Written for this posting only.'
    case 'schoolAuthorisation':
      return 'From your school, for this placement.'
    case 'transcript':
      return 'Your latest academic results.'
    case 'availability':
      return 'When you can start, and for how long.'
    case 'portfolio':
      return 'Links to work you have done.'
    default:
      return `Asked for by ${companyName}.`
  }
}

/** A text answer that is one line by nature gets a one line field. */
const SHORT_TEXT = new Set(['availability', 'portfolio'])

const HELP: Record<string, string> = {
  availability: 'For example, 3 months from 1 November.',
  portfolio: 'Paste one or more links.',
}

/** What went out, for the confirmation: files by the name they were chosen
 *  under, short answers as themselves, long ones by their label. */
function sentLines(
  state: ApplyFormState,
  requirements: DocumentRequirement[],
  cvs: CvEntry[],
  companyName: string,
): SentLine[] {
  const lines: SentLine[] = []
  for (const requirement of requirements) {
    if (requirement.key === 'cv') {
      const upload = state.uploads.cv
      if (upload?.kind === 'uploaded') {
        lines.push({ name: state.newCvLabel.trim() || upload.fileName, kind: 'CV' })
      } else if (state.cvMode === 'reuse') {
        const cv = cvs.find((entry) => entry.cvId === state.reuseCvId)
        if (cv) lines.push({ name: cv.label, kind: 'CV' })
      }
      continue
    }
    if (requirement.kind === 'FILE') {
      const upload = state.uploads[requirement.key]
      if (upload?.kind === 'uploaded') lines.push({ name: upload.fileName, kind: requirement.label })
      if (upload?.kind === 'profile') {
        lines.push({ name: upload.fileName ?? requirement.label, kind: `${requirement.label}, from profile` })
      }
      continue
    }
    const answer = state.answers[requirement.key]?.trim()
    if (!answer) continue
    lines.push(
      answer.length <= 60 && !answer.includes('\n')
        ? { name: answer, kind: requirement.label }
        : { name: requirement.label, kind: 'Written in the form' },
    )
  }
  if (state.coverLetter.trim()) {
    lines.push({ name: `A note to ${companyName}`, kind: 'Written in the form' })
  }
  return lines
}

/**
 * Mounted only once the job, cvs and profile queries have all resolved (see
 * ApplyPage), so useApplyForm's one-time initializer sees the real CV list
 * on its first render rather than an empty array from a still loading
 * query. Named ApplyFormPanel, not ApplyForm, to avoid colliding with
 * applyForm.ts (the pure logic module) on a case-insensitive filesystem,
 * where the two would otherwise resolve to the same path.
 */
export function ApplyFormPanel({ job, company, profile, cvs, existingApplications }: ApplyFormPanelProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showToast } = useToast()

  const requirements = job.documentRequirements
  // Read once, by the hook's one-time initializer: the transcript on the
  // profile starts out as this application's, so it need not be uploaded again.
  const form = useApplyForm(
    job.jobId,
    requirements,
    cvs,
    deriveInitialState(
      requirements,
      cvs,
      profile?.hasTranscript
        ? { fileName: nameFromUrl(profile.transcriptUrl ?? '') ?? undefined }
        : null,
    ),
  )

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [sent, setSent] = useState<{ applicationId: string; lines: SentLine[] } | null>(null)
  const bannerRef = useRef<HTMLDivElement>(null)

  const attempted = form.state.submitAttempted
  const outstanding = outstandingItems(form.state, requirements)
  const progress = requiredProgress(form.state, requirements)
  const missing = requirementChecklist(form.state, requirements).filter(
    (row) => row.requirement.required && !row.done,
  )
  const missingKeys = new Set(missing.map((row) => row.requirement.key))
  const ready = outstanding.length === 0
  const invalid = (key: string) => attempted && missingKeys.has(key)

  // On academic postings the transcript sits with the studies it belongs to.
  const isAcademic = job.opportunityType === 'ACADEMIC_INTERNSHIP'
  const cvRequirement = requirements.find((requirement) => requirement.key === 'cv')
  const transcript = isAcademic
    ? requirements.find((requirement) => requirement.key === 'transcript' && requirement.kind === 'FILE')
    : undefined
  const rest = requirements.filter((requirement) => requirement !== cvRequirement && requirement !== transcript)
  const required = rest.filter((requirement) => requirement.required)
  const optional = rest.filter((requirement) => !requirement.required)

  useEffect(() => {
    if (sent) {
      window.scrollTo({ top: 0 })
      document.getElementById('sent-heading')?.focus()
    }
  }, [sent])

  let stepNumber = 1

  function renderField(requirement: DocumentRequirement) {
    if (requirement.kind === 'FILE') {
      return (
        <FileRequirementField
          key={requirement.key}
          requirement={requirement}
          upload={form.state.uploads[requirement.key] ?? { kind: 'idle' }}
          onSelect={(file) => form.uploadField(requirement.key, file)}
          onRemove={() => form.clearUpload(requirement.key)}
          invalid={invalid(requirement.key)}
        />
      )
    }
    return (
      <TextRequirementField
        key={requirement.key}
        requirement={requirement}
        value={form.state.answers[requirement.key] ?? ''}
        onChange={(value) => form.setAnswer(requirement.key, value)}
        error={form.state.serverFieldErrors[requirement.key]}
        invalid={invalid(requirement.key)}
        help={HELP[requirement.key]}
        short={SHORT_TEXT.has(requirement.key)}
      />
    )
  }

  async function onSubmit() {
    form.markSubmitAttempted()
    if (outstanding.length > 0) {
      // The banner names everything missing; focus goes to the first field so
      // the viewer can start on it straight away.
      bannerRef.current?.scrollIntoView({ block: 'nearest' })
      document.getElementById(outstanding[0]!.fieldId)?.focus({ preventScroll: true })
      return
    }

    setSubmitError(null)
    setSubmitting(true)
    try {
      await form.confirmCv()
      const body = buildSubmitBody(form.state, job.jobId)
      const result = await submitApplication(body)
      queryClient.invalidateQueries({ queryKey: queryKeys.applications.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.cvs() })
      setSent({
        applicationId: result.application.applicationId,
        lines: sentLines(form.state, requirements, cvs, job.companyName),
      })
    } catch (caught) {
      if (caught instanceof ApiError) {
        if (caught.code === 'REQUIRED_DOCUMENTS_MISSING') {
          const details = missingDocuments(caught)
          console.error('Client and server disagreed on what is missing.', details)
          setSubmitError('This posting still needs some of the items above.')
        } else if (caught.code === 'DUPLICATE_APPLICATION') {
          showToast('You have already applied to this posting.')
          const existing = existingApplications.find((application) => application.jobId === job.jobId)
          navigate(existing ? `/applications/${existing.applicationId}` : '/applications')
        } else if (caught.code === 'POSTING_NOT_OPEN') {
          setSubmitError('This posting is no longer accepting applications.')
        } else if (caught.code === 'VALIDATION_FAILED') {
          const errors: Record<string, string> = {}
          for (const field of fieldErrors(caught)) errors[field.field] = field.message
          form.setServerFieldErrors(errors)
        } else {
          console.error(caught)
          setSubmitError('Something went wrong on our side. Please try again.')
        }
      } else {
        setSubmitError('Something went wrong on our side. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  // Missing requirements are named; anything else outstanding (an upload still
  // running or one that failed) is said as it is.
  const bannerItems = [
    ...missing.map((row) => ({ fieldId: `field-${row.requirement.key}`, text: row.requirement.label })),
    ...outstanding
      .filter((item) => !missing.some((row) => `field-${row.requirement.key}` === item.fieldId))
      .map((item) => ({ fieldId: item.fieldId, text: item.message })),
  ]

  return (
    <div className={styles.layout}>
      <ApplyPostingSummary job={job} company={company} formState={form.state} />

      <div className={styles.main}>
        {sent ? (
          <ApplySubmitted companyName={job.companyName} applicationId={sent.applicationId} sent={sent.lines} />
        ) : (
          <>
            <div className={styles.intro}>
              <h1 className={styles.title}>Apply for {job.title}</h1>
              <p className={styles.lede}>
                Your profile has filled in what it can. Add what this posting asks for below.
              </p>
            </div>

            {attempted && bannerItems.length > 0 && (
              <div ref={bannerRef} role="alert" className={styles.banner}>
                <p className={styles.bannerTitle}>
                  {missing.length === 0
                    ? 'One thing still needs finishing'
                    : missing.length === 1
                      ? 'One required item is missing'
                      : `${missing.length} required items are missing`}
                </p>
                <ul className={styles.bannerList}>
                  {bannerItems.map((item) => (
                    <li key={`${item.fieldId}-${item.text}`}>
                      <button
                        type="button"
                        className={styles.bannerLink}
                        onClick={() => document.getElementById(item.fieldId)?.focus()}
                      >
                        {item.text}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {profile && <YourDetailsStep profile={profile} number={stepNumber++} />}

            {cvRequirement && (
              <StepCard
                number={stepNumber++}
                title="CV for this role"
                description="Send the version written for this posting."
                asks
                invalid={invalid('cv')}
              >
                <CvRequirementField
                  requirement={cvRequirement}
                  cvs={cvs}
                  mode={form.state.cvMode}
                  reuseCvId={form.state.reuseCvId}
                  newCvLabel={form.state.newCvLabel}
                  upload={form.state.uploads.cv ?? { kind: 'idle' }}
                  onModeChange={form.setCvMode}
                  onReuseCvIdChange={form.setReuseCvId}
                  onNewCvLabelChange={form.setNewCvLabel}
                  onSelectFile={(file) => form.uploadField('cv', file)}
                  onRemoveFile={() => form.clearUpload('cv')}
                  invalid={invalid('cv')}
                />
              </StepCard>
            )}

            {isAcademic && profile && (
              <YourStudiesStep
                profile={profile}
                number={stepNumber++}
                invalid={transcript ? invalid(transcript.key) : false}
              >
                {transcript && renderField(transcript)}
                {transcript && form.state.uploads[transcript.key]?.kind !== 'profile' && (
                  <p className={styles.aside}>
                    Or <Link to="/profile">add it to your profile</Link> once, and it goes with every
                    academic internship application.
                  </p>
                )}
              </YourStudiesStep>
            )}

            {required.map((requirement) => (
              <StepCard
                key={requirement.key}
                number={stepNumber++}
                title={requirement.label}
                description={describe(requirement, job.companyName)}
                asks={requirement.kind === 'FILE'}
                invalid={invalid(requirement.key)}
              >
                {requirement.key === 'schoolAuthorisation' && (
                  <p className={styles.about}>
                    The letter should name <strong>{job.companyName}</strong> as the host. It is written for
                    one company, so it is asked for on each application and never kept on your profile.
                  </p>
                )}
                {renderField(requirement)}
              </StepCard>
            ))}

            {optional.length > 0 && (
              <StepCard
                number={stepNumber++}
                title="Also requested"
                description={`Added to this posting by ${job.companyName}.`}
              >
                {optional.map(renderField)}
              </StepCard>
            )}

            <StepCard
              number={stepNumber++}
              title={`A note to ${job.companyName}`}
              description="Optional. Sent with your application."
            >
              <div className={styles.noteField}>
                <label className={styles.noteLabel} htmlFor="field-note">
                  Anything you want them to read first
                </label>
                <Textarea
                  id="field-note"
                  rows={4}
                  className={styles.note}
                  value={form.state.coverLetter}
                  onChange={(event) => form.setCoverLetter(event.target.value)}
                />
              </div>
            </StepCard>

            <section className={styles.submit} aria-label="Send">
              <div className={styles.submitText}>
                <p className={styles.submitTitle}>
                  {ready
                    ? 'Everything this posting requires is here'
                    : `${progress.done} of ${progress.total} required items done`}
                </p>
                <p className={styles.submitBody}>
                  You can apply to each posting once, and edit it until {job.companyName} opens it.
                </p>
                {submitError && (
                  <p role="alert" className={styles.submitError}>
                    {submitError}
                  </p>
                )}
              </div>
              <button
                type="button"
                className={[styles.send, ready ? styles.sendReady : ''].join(' ')}
                onClick={onSubmit}
                disabled={submitting}
                aria-busy={submitting || undefined}
              >
                {submitting && <Spinner label="Sending" />}
                {submitting ? 'Sending' : 'Send application'}
              </button>
            </section>
          </>
        )}
      </div>
    </div>
  )
}
