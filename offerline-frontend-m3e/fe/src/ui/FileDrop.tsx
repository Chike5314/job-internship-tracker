import { useId, useRef, useState, type DragEvent } from 'react'
import { Spinner } from './Spinner'
import styles from './FileDrop.module.css'

export type FileDropStatus =
  | { kind: 'idle' }
  | { kind: 'uploading'; fileName: string; progress: number }
  | { kind: 'done'; fileName: string }
  | { kind: 'failed'; fileName: string; message: string }
  // Edit mode only: a file already on the record from an earlier
  // submission, not replaced this session.
  | { kind: 'onFile' }

interface FileDropProps {
  accept: string
  help: string
  status: FileDropStatus
  onSelect: (file: File) => void
  onRetry?: () => void
  id?: string
  'aria-describedby'?: string
  'aria-invalid'?: true
}

/**
 * Presentational only: reports a chosen file up and renders whatever
 * upload-state it's given. The actual upload state machine lives in the
 * feature that owns it (e.g. useUploadRequirementFile), because different
 * callers upload to different endpoints.
 */
export function FileDrop({ accept, help, status, onSelect, onRetry, id, ...aria }: FileDropProps) {
  const generatedId = useId()
  const zoneId = id ?? generatedId
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  function handleFiles(files: FileList | null) {
    const file = files?.[0]
    if (file) onSelect(file)
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragOver(false)
    handleFiles(event.dataTransfer.files)
  }

  return (
    <div>
      <div
        className={[styles.zone, dragOver && styles.dragOver].filter(Boolean).join(' ')}
        onDragOver={(event) => {
          event.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        id={zoneId}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            inputRef.current?.click()
          }
        }}
        {...aria}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className={styles.input}
          onChange={(event) => handleFiles(event.target.files)}
        />

        {status.kind === 'idle' && (
          <p className="t-body-sm" style={{ color: 'var(--color-text-muted)' }}>
            Drop a file here, or click to choose one.
          </p>
        )}

        {status.kind === 'onFile' && (
          <p className="t-body-sm" style={{ color: 'var(--color-text-muted)' }}>
            On file. Drop a file here, or click to replace it.
          </p>
        )}

        {status.kind === 'uploading' && (
          <p className="t-body-sm" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Spinner label="Uploading" />
            Uploading {status.fileName}
          </p>
        )}

        {status.kind === 'done' && (
          <p className="t-body-sm" style={{ color: 'var(--color-feedback-ok-text)' }}>
            {status.fileName} uploaded.
          </p>
        )}

        {status.kind === 'failed' && (
          <p className="t-body-sm" style={{ color: 'var(--color-feedback-error-text)' }}>
            {status.message}
          </p>
        )}
      </div>

      {status.kind === 'failed' && onRetry && (
        <button
          type="button"
          className="t-body-sm"
          style={{ color: 'var(--color-text-link)', textDecoration: 'underline', marginTop: 'var(--space-1)' }}
          onClick={onRetry}
        >
          Retry
        </button>
      )}

      <p aria-live="polite" className={styles.visuallyHiddenLive}>
        {status.kind === 'uploading' && 'Uploading'}
        {status.kind === 'done' && 'Uploaded'}
        {status.kind === 'failed' && 'Upload failed'}
      </p>

      <p className="t-caption" style={{ color: 'var(--color-text-subtle)', marginTop: 'var(--space-1)' }}>
        {help}
      </p>
    </div>
  )
}
