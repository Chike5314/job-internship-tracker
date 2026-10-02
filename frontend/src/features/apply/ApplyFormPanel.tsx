import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { submitApplication } from '@/api/applications'
import { ApiError, fieldErrors, missingDocuments } from '@/api/errors'
import { queryKeys } from '@/api/queryKeys'
import type { ApplicationSummary, CvEntry, JobSummary } from '@/api/types'
import { BackLink } from '@/ui/BackLink'
import { Button } from '@/ui/Button'
import { ErrorSummary } from '@/ui/ErrorSummary'
import { Field } from '@/ui/Field'
import { Textarea } from '@/ui/Textarea'
import { useToast } from '@/ui/ToastProvider'
import { buildSubmitBody, canSubmit, outstandingItems } from './applyForm'
import { RequirementFields } from './RequirementFields'
import { useApplyForm } from './useApplyForm'

interface ApplyFormPanelProps {
  job: JobSummary
  cvs: CvEntry[]
  existingApplications: ApplicationSummary[]
}

// Mounted only once the job and cvs queries have both resolved (see
// ApplyPage), so useApplyForm's one-time initializer sees the real CV
// list on its first render rather than an empty array from a still
// loading query. Named ApplyFormPanel, not ApplyForm, to avoid colliding
// with applyForm.ts (the pure logic module) on a case-insensitive
// filesystem, where the two would otherwise resolve to the same path.
export function ApplyFormPanel({ job, cvs, existingApplications }: ApplyFormPanelProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showToast } = useToast()

  const requirements = job.documentRequirements
  const form = useApplyForm(job.jobId, requirements, cvs)

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const outstanding = outstandingItems(form.state, requirements)
  const ready = canSubmit(form.state, requirements, job.isOpen)

  async function onSubmit() {
    form.markSubmitAttempted()
    const current = outstandingItems(form.state, requirements)
    if (current.length > 0) {
      document.getElementById(current[0]!.fieldId)?.focus()
      return
    }

    setSubmitError(null)
    setSubmitting(true)
    try {
      const body = buildSubmitBody(form.state, job.jobId)
      const result = await submitApplication(body)
      queryClient.invalidateQueries({ queryKey: queryKeys.applications.all })
      showToast(result.message)
      navigate(`/applications/${result.application.applicationId}`)
    } catch (caught) {
      if (caught instanceof ApiError) {
        if (caught.code === 'REQUIRED_DOCUMENTS_MISSING') {
          const details = missingDocuments(caught)
          console.error('Client and server disagreed on what is missing.', details)
          setSubmitError('This posting still needs some of the items below.')
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

  return (
    <div>
      <BackLink to={`/postings/${job.jobId}`}>{job.title}</BackLink>
      <h1 className="t-display-md">Apply</h1>
      <p className="t-body-sm" style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-6)' }}>
        {job.title} at {job.companyName}
      </p>

      <div className="glass-dense" style={{ padding: 'var(--space-5)', display: 'grid', gap: 'var(--space-5)' }}>
        <RequirementFields
          requirements={requirements}
          cvs={cvs}
          state={form.state}
          onUploadField={form.uploadField}
          onAnswerChange={form.setAnswer}
          onCvModeChange={form.setCvMode}
          onReuseCvIdChange={form.setReuseCvId}
          onNewCvLabelChange={form.setNewCvLabel}
        />

        <Field label="Message to the recruiter" help="Optional.">
          {(props) => (
            <Textarea
              {...props}
              value={form.state.coverLetter}
              onChange={(event) => form.setCoverLetter(event.target.value)}
            />
          )}
        </Field>

        {form.state.submitAttempted && outstanding.length > 0 && (
          <ErrorSummary heading="This posting still needs a few things" items={outstanding} />
        )}

        {submitError && (
          <p role="alert" className="t-body-sm" style={{ color: 'var(--color-feedback-error-text)' }}>
            {submitError}
          </p>
        )}

        <Button
          variant="primary"
          onClick={onSubmit}
          loading={submitting}
          disabled={form.state.submitAttempted && !ready}
          title={!ready && outstanding.length > 0 ? outstanding.map((item) => item.message).join(' ') : undefined}
        >
          Submit application
        </Button>
      </div>
    </div>
  )
}
