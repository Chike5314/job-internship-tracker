import type { DocumentRequirement } from '@/api/types'
import { ALLOWED_DOCUMENT_EXTENSIONS } from '@/api/enums'
import type { FieldUpload } from './applyForm'
import { UploadRow } from './UploadRow'
import styles from './RequirementField.module.css'

interface FileRequirementFieldProps {
  requirement: DocumentRequirement
  upload: FieldUpload
  onSelect: (file: File) => void
  onRemove?: () => void
  invalid?: boolean
}

export function FileRequirementField({ requirement, upload, onSelect, onRemove, invalid }: FileRequirementFieldProps) {
  return (
    <>
      <UploadRow
        id={`field-${requirement.key}`}
        title={
          requirement.required ? (
            `Upload the ${requirement.label.charAt(0).toLowerCase()}${requirement.label.slice(1)}`
          ) : (
            <>
              {requirement.label} <span className={styles.optional}>optional</span>
            </>
          )
        }
        hint={`${ALLOWED_DOCUMENT_EXTENSIONS.join(', ').toUpperCase().replace(/, (?=[^,]*$)/, ' or ')}, up to 10 MB`}
        accept={ALLOWED_DOCUMENT_EXTENSIONS.map((extension) => `.${extension}`).join(',')}
        upload={upload}
        onSelect={onSelect}
        onRemove={() => onRemove?.()}
        invalid={invalid}
        label={requirement.label}
      />
      {invalid && <p className={styles.error}>Upload the {requirement.label.toLowerCase()}.</p>}
    </>
  )
}
