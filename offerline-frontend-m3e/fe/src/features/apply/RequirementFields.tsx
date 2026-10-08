import type { CvEntry, DocumentRequirement } from '@/api/types'
import type { ApplyFormState } from './applyForm'
import { CvRequirementField } from './CvRequirementField'
import { FileRequirementField } from './FileRequirementField'
import { TextRequirementField } from './TextRequirementField'

interface RequirementFieldsProps {
  requirements: DocumentRequirement[]
  cvs: CvEntry[]
  state: ApplyFormState
  onUploadField: (key: string, file: File) => void
  onAnswerChange: (key: string, value: string) => void
  onCvModeChange: (mode: 'reuse' | 'upload') => void
  onReuseCvIdChange: (id: string) => void
  onNewCvLabelChange: (label: string) => void
}

// Driven entirely by the posting's documentRequirements array, rendered in
// the order the recruiter set. The only key with special handling is
// `cv`; nothing here names coverLetter, transcript, schoolAuthorisation,
// portfolio or availability specifically.
export function RequirementFields({
  requirements,
  cvs,
  state,
  onUploadField,
  onAnswerChange,
  onCvModeChange,
  onReuseCvIdChange,
  onNewCvLabelChange,
}: RequirementFieldsProps) {
  return (
    <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
      {requirements.map((requirement) => {
        if (requirement.key === 'cv') {
          return (
            <CvRequirementField
              key={requirement.key}
              requirement={requirement}
              cvs={cvs}
              mode={state.cvMode}
              reuseCvId={state.reuseCvId}
              newCvLabel={state.newCvLabel}
              upload={state.uploads.cv ?? { kind: 'idle' }}
              onModeChange={onCvModeChange}
              onReuseCvIdChange={onReuseCvIdChange}
              onNewCvLabelChange={onNewCvLabelChange}
              onSelectFile={(file) => onUploadField('cv', file)}
            />
          )
        }

        if (requirement.kind === 'FILE') {
          return (
            <FileRequirementField
              key={requirement.key}
              requirement={requirement}
              upload={state.uploads[requirement.key] ?? { kind: 'idle' }}
              onSelect={(file) => onUploadField(requirement.key, file)}
            />
          )
        }

        return (
          <TextRequirementField
            key={requirement.key}
            requirement={requirement}
            value={state.answers[requirement.key] ?? ''}
            onChange={(value) => onAnswerChange(requirement.key, value)}
            error={state.serverFieldErrors[requirement.key]}
          />
        )
      })}
    </div>
  )
}
