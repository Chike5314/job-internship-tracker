import type { DocumentRequirement } from '@/api/types'
import { FileDrop } from '@/ui/FileDrop'
import { ALLOWED_DOCUMENT_EXTENSIONS } from '@/api/enums'
import type { FieldUpload } from './applyForm'
import { toFileDropStatus } from './uploadStatus'

interface FileRequirementFieldProps {
  requirement: DocumentRequirement
  upload: FieldUpload
  onSelect: (file: File) => void
}

export function FileRequirementField({ requirement, upload, onSelect }: FileRequirementFieldProps) {
  return (
    <div>
      <p className="t-body-sm" style={{ fontWeight: 600, marginBottom: 'var(--space-1)' }}>
        {requirement.label}
        {!requirement.required && (
          <span className="t-caption" style={{ color: 'var(--color-text-subtle)' }}>
            {' '}
            (optional)
          </span>
        )}
      </p>
      <FileDrop
        id={`field-${requirement.key}`}
        accept={ALLOWED_DOCUMENT_EXTENSIONS.map((extension) => `.${extension}`).join(',')}
        help={`${[...ALLOWED_DOCUMENT_EXTENSIONS].join(', ').toUpperCase()}, up to 10 MB.`}
        status={toFileDropStatus(upload)}
        onSelect={onSelect}
        onRetry={upload.kind === 'failed' ? () => onSelect(upload.file) : undefined}
      />
    </div>
  )
}
