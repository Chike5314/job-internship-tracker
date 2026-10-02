import type { FileDropStatus } from '@/ui/FileDrop'
import type { FieldUpload } from './applyForm'

/** FieldUpload (the reducer's shape) has a 'selected' state FileDrop
 * doesn't need to render separately; everything else maps 1:1. */
export function toFileDropStatus(upload: FieldUpload): FileDropStatus {
  switch (upload.kind) {
    case 'uploading':
      return { kind: 'uploading', fileName: upload.file.name, progress: upload.progress }
    case 'uploaded':
      return { kind: 'done', fileName: upload.fileName }
    case 'failed':
      return { kind: 'failed', fileName: upload.file.name, message: upload.message }
    case 'onFile':
      return { kind: 'onFile' }
    default:
      return { kind: 'idle' }
  }
}
