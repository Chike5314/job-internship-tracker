import { useRef, useState, type DragEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/ui/Button'
import { Icon } from '@/ui/Icon'
import type { FieldUpload } from './applyForm'
import styles from './UploadRow.module.css'

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

type Props = {
  /** Lands on the button, so a missing-item link can move focus straight to it. */
  id: string
  title: ReactNode
  hint: string
  accept: string
  upload: FieldUpload
  onSelect: (file: File) => void
  onRemove: () => void
  /** The CV's drop zone leads with an icon and a primary button; every other
   *  file is a quieter row with an outlined one. */
  prominent?: boolean
  invalid?: boolean
  /** What the file is, for the line under a file kept on the profile. */
  label?: string
}

/**
 * One file the posting asks for: a drop row until something is chosen, then
 * the file itself with a way to take it back out.
 */
export function UploadRow({ id, title, hint, accept, upload, onSelect, onRemove, prominent, invalid, label }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  function pick() {
    inputRef.current?.click()
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragOver(false)
    const file = event.dataTransfer.files?.[0]
    if (file) onSelect(file)
  }

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept={accept}
      className={styles.input}
      tabIndex={-1}
      aria-hidden="true"
      onChange={(event) => {
        const file = event.target.files?.[0]
        if (file) onSelect(file)
        event.target.value = ''
      }}
    />
  )

  // Changed where it lives, on the profile, since every application that asks
  // for it reads it from there.
  if (upload.kind === 'profile') {
    return (
      <div className={[styles.file, styles.kept].join(' ')}>
        <Icon name="file" size={20} />
        <span className={styles.text}>
          <span className={styles.name}>{upload.fileName ?? label ?? 'Your file'}</span>
          <span className={styles.keptLine}>{label ? `${label} · kept on your profile` : 'Kept on your profile'}</span>
        </span>
        <Link id={id} to="/profile" className={styles.profileLink}>
          Replace on profile
        </Link>
      </div>
    )
  }

  if (upload.kind === 'uploaded' || upload.kind === 'onFile') {
    return (
      <div className={styles.file}>
        <Icon name="file" size={20} />
        <span className={styles.text}>
          <span className={styles.name}>
            {upload.kind === 'uploaded' ? upload.fileName : 'Sent with this application'}
          </span>
          <span className={styles.done}>
            {upload.kind === 'uploaded'
              ? `Uploaded${upload.size ? ` · ${formatSize(upload.size)}` : ''}`
              : 'Kept as it is unless you replace it'}
          </span>
        </span>
        {upload.kind === 'uploaded' ? (
          <button type="button" id={id} className={styles.remove} onClick={onRemove}>
            Remove
          </button>
        ) : (
          <button type="button" id={id} className={styles.replace} onClick={pick}>
            Replace
          </button>
        )}
        {input}
      </div>
    )
  }

  if (upload.kind === 'uploading') {
    return (
      <div className={styles.file} aria-live="polite">
        <Icon name="file" size={20} />
        <span className={styles.text}>
          <span className={styles.name}>{upload.file.name}</span>
          <span className={styles.progress}>
            <span className={styles.track}>
              <span className={styles.bar} style={{ width: `${Math.round(upload.progress * 100)}%` }} />
            </span>
            <span className={styles.percent}>{Math.round(upload.progress * 100)}%</span>
          </span>
        </span>
      </div>
    )
  }

  const failed = upload.kind === 'failed'

  return (
    <div
      className={[
        styles.drop,
        prominent ? styles.prominent : '',
        dragOver ? styles.dragOver : '',
        invalid || failed ? styles.invalid : '',
      ].join(' ')}
      onDragOver={(event) => {
        event.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      {prominent && (
        <span className={styles.icon} aria-hidden="true">
          <Icon name="upload" size={22} />
        </span>
      )}
      <span className={styles.text}>
        <span className={prominent ? styles.titleLarge : styles.title}>{title}</span>
        <span className={failed ? styles.error : styles.hint} role={failed ? 'alert' : undefined}>
          {failed ? upload.message : hint}
        </span>
      </span>
      <Button
        id={id}
        variant={prominent ? 'primary' : 'secondary'}
        className={styles.choose}
        onClick={failed ? () => onSelect(upload.file) : pick}
      >
        {failed ? 'Try again' : 'Choose file'}
      </Button>
      {input}
    </div>
  )
}
