import { useState } from 'react'
import type { Profile } from '@/api/types'
import { FileDrop, type FileDropStatus } from '@/ui/FileDrop'
import { useUploadTranscript } from './useProfile'

export function TranscriptCard({ profile }: { profile: Profile }) {
  const upload = useUploadTranscript()
  const [status, setStatus] = useState<FileDropStatus>(profile.hasTranscript ? { kind: 'onFile' } : { kind: 'idle' })

  async function onSelect(file: File) {
    setStatus({ kind: 'uploading', fileName: file.name, progress: 0 })
    try {
      await upload.mutateAsync(file)
      setStatus({ kind: 'done', fileName: file.name })
    } catch {
      setStatus({ kind: 'failed', fileName: file.name, message: 'That upload did not finish. Try again.' })
    }
  }

  return (
    <div className="glass-dense" style={{ padding: 'var(--space-4)' }}>
      <p className="t-heading-sm" style={{ marginBottom: 'var(--space-2)' }}>
        Transcript
      </p>
      {profile.hasTranscript && profile.transcriptUrl && status.kind === 'onFile' && (
        <a
          href={profile.transcriptUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="t-body-sm"
          style={{ color: 'var(--color-text-link)', textDecoration: 'underline', display: 'block', marginBottom: 'var(--space-2)' }}
        >
          Open
        </a>
      )}
      <FileDrop accept=".pdf,.doc,.docx" help="PDF, DOC or DOCX, up to 10 MB." status={status} onSelect={onSelect} />
    </div>
  )
}
