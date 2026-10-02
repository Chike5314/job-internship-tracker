import { useState } from 'react'
import { amendApplication } from '@/api/applications'
import { ApiError, fieldErrors } from '@/api/errors'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/api/queryKeys'
import type { ApplicationDetail } from '@/api/types'
import { Button } from '@/ui/Button'
import { ErrorSummary } from '@/ui/ErrorSummary'
import { Field } from '@/ui/Field'
import { Textarea } from '@/ui/Textarea'
import { useCvs } from '@/features/profile/useProfile'
import { buildSubmitBody, deriveEditState, outstandingItems } from '@/features/apply/applyForm'
import { RequirementFields } from '@/features/apply/RequirementFields'
import { useApplyForm } from '@/features/apply/useApplyForm'

interface EditApplicationPanelProps {
  application: ApplicationDetail
  onDone: () => void
}

export function EditApplicationPanel({ application, onDone }: EditApplicationPanelProps) {
  const { data: cvData } = useCvs()
  const cvs = cvData?.cvs ?? []
  const queryClient = useQueryClient()

  const existingDocumentKeys = new Set(Object.keys(application.documentUrls))
  const initialState = deriveEditState(application.documentRequirements, application.answers, existingDocumentKeys)
  const form = useApplyForm(application.jobId, application.documentRequirements, cvs, initialState)

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const outstanding = outstandingItems(form.state, application.documentRequirements)

  async function onSave() {
    form.markSubmitAttempted()
    if (outstandingItems(form.state, application.documentRequirements).length > 0) return

    setSubmitError(null)
    setSubmitting(true)
    try {
      const body = buildSubmitBody(form.state, application.jobId)
      await amendApplication(application.applicationId, {
        documents: body.documents,
        answers: body.answers,
        ...(body.reuseCvId ? { reuseCvId: body.reuseCvId } : {}),
        ...(body.coverLetter !== undefined ? { coverLetter: body.coverLetter } : {}),
      })
      queryClient.invalidateQueries({ queryKey: queryKeys.applications.detail(application.applicationId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.applications.mine() })
      onDone()
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'APPLICATION_FROZEN') {
        setSubmitError('A recruiter has opened this application, so it is now read only.')
        queryClient.invalidateQueries({ queryKey: queryKeys.applications.detail(application.applicationId) })
      } else if (caught instanceof ApiError && caught.code === 'VALIDATION_FAILED') {
        const errors: Record<string, string> = {}
        for (const field of fieldErrors(caught)) errors[field.field] = field.message
        form.setServerFieldErrors(errors)
      } else {
        setSubmitError('Something went wrong on our side. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="glass-dense" style={{ padding: 'var(--space-5)', display: 'grid', gap: 'var(--space-5)' }}>
      <h1 className="t-heading-lg">Edit application</h1>

      <RequirementFields
        requirements={application.documentRequirements}
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
            defaultValue={application.coverLetter}
            onChange={(event) => form.setCoverLetter(event.target.value)}
          />
        )}
      </Field>

      {form.state.submitAttempted && outstanding.length > 0 && (
        <ErrorSummary heading="A few things still need attention" items={outstanding} />
      )}

      {submitError && (
        <p role="alert" className="t-body-sm" style={{ color: 'var(--color-feedback-error-text)' }}>
          {submitError}
        </p>
      )}

      <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
        <Button variant="primary" loading={submitting} onClick={onSave}>
          Save changes
        </Button>
        <Button variant="quiet" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
