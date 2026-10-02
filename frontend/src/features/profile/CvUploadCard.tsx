import { useState } from 'react'
import { Input } from '@/ui/Input'
import { FileDrop, type FileDropStatus } from '@/ui/FileDrop'
import { useToast } from '@/ui/ToastProvider'
import { useUploadCv } from './useProfile'

export function CvUploadCard() {
  const [label, setLabel] = useState('')
  const [status, setStatus] = useState<FileDropStatus>({ kind: 'idle' })
  const upload = useUploadCv()
  const { showToast } = useToast()

  async function onSelect(file: File) {
    setStatus({ kind: 'uploading', fileName: file.name, progress: 0 })
    try {
      await upload.mutateAsync({ file, label: label || undefined })
      setStatus({ kind: 'done', fileName: file.name })
      setLabel('')
      showToast('CV uploaded.')
    } catch {
      setStatus({ kind: 'failed', fileName: file.name, message: 'That upload did not finish. Try again.' })
    }
  }

  return (
    <div className="glass-dense" style={{ padding: 'var(--space-4)', display: 'grid', gap: 'var(--space-2)' }}>
      <label className="t-body-sm" htmlFor="cv-label">
        Label
      </label>
      <Input
        id="cv-label"
        placeholder="e.g. Backend roles"
        value={label}
        onChange={(event) => setLabel(event.target.value)}
      />
      <p className="t-caption" style={{ color: 'var(--color-text-subtle)' }}>
        Give it a label so you can recognise it later.
      </p>
      {/* No onRetry: FileDropStatus's 'failed' variant only carries a
          fileName and message, not the File itself, so there is nothing to
          retry with. Choosing the file again through the drop zone (which
          always works, failed state or not) is the retry path here. */}
      <FileDrop accept=".pdf,.doc,.docx" help="PDF, DOC or DOCX, up to 10 MB." status={status} onSelect={onSelect} />
    </div>
  )
}
