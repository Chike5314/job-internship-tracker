import { useState } from 'react'
import type { CvEntry, DocumentRequirement } from '@/api/types'
import { Select } from '@/ui/Select'
import { Input } from '@/ui/Input'
import { FileDrop } from '@/ui/FileDrop'
import { ALLOWED_DOCUMENT_EXTENSIONS } from '@/api/enums'
import { formatDate } from '@/lib/formatDate'
import type { FieldUpload } from './applyForm'
import { toFileDropStatus } from './uploadStatus'

interface CvRequirementFieldProps {
  requirement: DocumentRequirement
  cvs: CvEntry[]
  mode: 'reuse' | 'upload'
  reuseCvId: string | null
  newCvLabel: string
  upload: FieldUpload
  onModeChange: (mode: 'reuse' | 'upload') => void
  onReuseCvIdChange: (id: string) => void
  onNewCvLabelChange: (label: string) => void
  onSelectFile: (file: File) => void
}

// The only requirement key with special handling in this tree: this is
// the CV-reuse feature (FR-2.7/5.10), not a hardcoded requirement. Every
// posting is guaranteed to have a `cv` entry (normalise_requirements in
// common/documents.py), so this branch is always reachable.
export function CvRequirementField(props: CvRequirementFieldProps) {
  const { requirement, upload } = props
  // Edit mode only: the application already carries a CV, untouched this
  // session. Shown as a plain "kept as is" state rather than the
  // reuse/upload choice, with an explicit opt-in to change it, since
  // showing that choice by default would suggest something needs picking
  // when nothing does.
  const [replacing, setReplacing] = useState(upload.kind !== 'onFile')

  if (upload.kind === 'onFile' && !replacing) {
    return (
      <div id={`field-${requirement.key}`}>
        <p className="t-body-sm" style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>
          {requirement.label}
        </p>
        <p className="t-body-sm" style={{ color: 'var(--color-text-muted)' }}>
          Your CV on file will be kept.
        </p>
        <button
          type="button"
          className="t-body-sm"
          style={{ color: 'var(--color-text-link)', textDecoration: 'underline', marginTop: 'var(--space-1)' }}
          onClick={() => setReplacing(true)}
        >
          Replace it
        </button>
      </div>
    )
  }

  return <CvChoice {...props} />
}

function CvChoice({
  requirement,
  cvs,
  mode,
  reuseCvId,
  newCvLabel,
  upload,
  onModeChange,
  onReuseCvIdChange,
  onNewCvLabelChange,
  onSelectFile,
}: CvRequirementFieldProps) {
  // A reuse choice with nothing to reuse, or an upload choice, both land
  // here: whenever there is genuinely nothing to pick from, the upload
  // field is what's shown, regardless of which mode is nominally
  // selected. Without this, mode='reuse' with an empty cvs list (a CV
  // library query still loading, or edit mode's default before the user
  // has chosen anything) would render neither the picker nor the upload
  // field: a blank gap with no way forward.
  const showUpload = mode === 'upload' || cvs.length === 0

  return (
    <div id={`field-${requirement.key}`}>
      <p className="t-body-sm" style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>
        {requirement.label}
      </p>

      {cvs.length > 0 && (
        <div role="radiogroup" aria-label="CV source" style={{ display: 'grid', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
          <label className="t-body-sm" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <input type="radio" checked={mode === 'reuse'} onChange={() => onModeChange('reuse')} />
            Use a CV you uploaded before
          </label>
          {mode === 'reuse' && (
            <Select
              aria-label="Choose a CV"
              placeholder="Choose a CV"
              value={reuseCvId ?? ''}
              onChange={(event) => onReuseCvIdChange(event.target.value)}
              options={cvs.map((cv) => ({ value: cv.cvId, label: `${cv.label}, uploaded ${formatDate(cv.uploadedAt)}` }))}
              style={{ marginLeft: 'var(--space-5)', maxWidth: '360px' }}
            />
          )}

          <label className="t-body-sm" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <input type="radio" checked={mode === 'upload'} onChange={() => onModeChange('upload')} />
            Upload a new CV
          </label>
        </div>
      )}

      {showUpload && (
        <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
          <Input
            placeholder="Label, e.g. Backend roles (optional)"
            value={newCvLabel}
            onChange={(event) => onNewCvLabelChange(event.target.value)}
          />
          <FileDrop
            accept={ALLOWED_DOCUMENT_EXTENSIONS.map((extension) => `.${extension}`).join(',')}
            help={`${[...ALLOWED_DOCUMENT_EXTENSIONS].join(', ').toUpperCase()}, up to 10 MB.`}
            status={toFileDropStatus(upload)}
            onSelect={onSelectFile}
            onRetry={upload.kind === 'failed' ? () => onSelectFile(upload.file) : undefined}
          />
        </div>
      )}
    </div>
  )
}
