import { useState } from 'react'
import type { CvEntry, DocumentRequirement } from '@/api/types'
import { ALLOWED_DOCUMENT_EXTENSIONS } from '@/api/enums'
import { Input } from '@/ui/Input'
import { formatDateShort } from '@/lib/formatDate'
import { nameFromKey } from '@/lib/fileNames'
import type { FieldUpload } from './applyForm'
import { UploadRow } from './UploadRow'
import styles from './CvRequirementField.module.css'

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
  onRemoveFile?: () => void
  invalid?: boolean
}

const ACCEPT = ALLOWED_DOCUMENT_EXTENSIONS.map((extension) => `.${extension}`).join(',')

// The only requirement key with special handling in this tree: this is
// the CV-reuse feature (FR-2.7/5.10), not a hardcoded requirement. Every
// posting is guaranteed to have a `cv` entry (normalise_requirements in
// common/documents.py), so this branch is always reachable.
export function CvRequirementField(props: CvRequirementFieldProps) {
  const { upload } = props
  // Edit mode only: the application already carries a CV, untouched this
  // session. Shown as kept, with an explicit way to replace it, since showing
  // the reuse or upload choice by default would suggest something needs
  // picking when nothing does.
  const [replacing, setReplacing] = useState(upload.kind !== 'onFile')

  if (upload.kind === 'onFile' && !replacing) {
    return (
      <UploadRow
        id={`field-${props.requirement.key}`}
        title="Your CV"
        hint=""
        accept={ACCEPT}
        upload={upload}
        onSelect={(file) => {
          setReplacing(true)
          props.onSelectFile(file)
        }}
        onRemove={() => setReplacing(true)}
      />
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
  onRemoveFile,
  invalid,
}: CvRequirementFieldProps) {
  // With nothing to reuse there is no choice to offer, so the upload is shown
  // whatever mode is nominally selected.
  const canReuse = cvs.length > 0
  const showUpload = mode === 'upload' || !canReuse
  const library = [...cvs].sort(
    (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
  )

  return (
    <>
      {canReuse && (
        <div className={styles.modes} role="group" aria-label="How to add your CV">
          <button
            type="button"
            aria-pressed={showUpload}
            className={[styles.mode, showUpload ? styles.modeOn : ''].join(' ')}
            onClick={() => onModeChange('upload')}
          >
            Upload a new CV
          </button>
          <button
            type="button"
            aria-pressed={!showUpload}
            className={[styles.mode, !showUpload ? styles.modeOn : ''].join(' ')}
            onClick={() => onModeChange('reuse')}
          >
            Reuse an earlier CV
          </button>
        </div>
      )}

      {showUpload ? (
        <>
          <UploadRow
            id={`field-${requirement.key}`}
            title="Drop your CV here"
            hint="PDF, DOC or DOCX, up to 10 MB"
            accept={ACCEPT}
            upload={upload}
            onSelect={onSelectFile}
            onRemove={() => onRemoveFile?.()}
            prominent
            invalid={invalid}
          />
          {upload.kind === 'uploaded' && (
            <label className={styles.label}>
              <span className={styles.labelText}>
                Label <span className={styles.labelHint}>so you can find it again later</span>
              </span>
              <Input
                className={styles.labelInput}
                value={newCvLabel}
                maxLength={120}
                onChange={(event) => onNewCvLabelChange(event.target.value)}
              />
            </label>
          )}
        </>
      ) : (
        <fieldset className={styles.library}>
          <legend className={styles.legend}>Your ten most recent uploads, newest first.</legend>
          <div className={styles.grid}>
            {library.map((cv, index) => {
              const checked = cv.cvId === reuseCvId
              return (
                <label key={cv.cvId} className={[styles.cv, checked ? styles.cvOn : ''].join(' ')}>
                  <input
                    type="radio"
                    name="cv-reuse"
                    id={index === 0 ? `field-${requirement.key}` : undefined}
                    checked={checked}
                    onChange={() => onReuseCvIdChange(cv.cvId)}
                    className={styles.radio}
                  />
                  <span className={styles.cvText}>
                    <span className={styles.cvLabel}>{cv.label}</span>
                    <span className={styles.cvMeta}>
                      {nameFromKey(cv.s3Key) ?? cv.label} · {formatDateShort(cv.uploadedAt)}
                    </span>
                  </span>
                </label>
              )
            })}
          </div>
        </fieldset>
      )}

      {invalid && <p className={styles.error}>Add a CV to send with this application.</p>}
    </>
  )
}
