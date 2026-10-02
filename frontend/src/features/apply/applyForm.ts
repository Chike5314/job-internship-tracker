import type { CvEntry, DocumentRequirement } from '@/api/types'

export type FieldUpload =
  | { kind: 'idle' }
  | { kind: 'selected'; file: File }
  | { kind: 'uploading'; file: File; progress: number }
  | { kind: 'uploaded'; s3Key: string; fileName: string }
  | { kind: 'failed'; file: File; message: string }
  // Edit mode only: a file already on the application from an earlier
  // submission, not touched this session. Satisfies a required-file check
  // the same way 'uploaded' does, but never produces a documents entry in
  // the submit body, since there is no real key for it in this state (the
  // backend's PATCH merges, so leaving the key out entirely keeps the
  // existing one as it was).
  | { kind: 'onFile' }

export interface ApplyFormState {
  uploads: Record<string, FieldUpload>
  answers: Record<string, string>
  cvMode: 'reuse' | 'upload'
  reuseCvId: string | null
  newCvLabel: string
  coverLetter: string
  submitAttempted: boolean
  serverFieldErrors: Record<string, string>
}

export function deriveInitialState(requirements: DocumentRequirement[], cvs: CvEntry[]): ApplyFormState {
  const uploads: Record<string, FieldUpload> = {}
  const answers: Record<string, string> = {}
  for (const requirement of requirements) {
    if (requirement.key === 'cv') continue
    if (requirement.kind === 'FILE') uploads[requirement.key] = { kind: 'idle' }
    else answers[requirement.key] = ''
  }

  return {
    uploads,
    answers,
    // A one-option choice is worse than no choice: reuse only starts
    // selected when there is something to reuse.
    cvMode: cvs.length > 0 ? 'reuse' : 'upload',
    reuseCvId: cvs[0]?.cvId ?? null,
    newCvLabel: '',
    coverLetter: '',
    submitAttempted: false,
    serverFieldErrors: {},
  }
}

function cvSatisfied(state: ApplyFormState): boolean {
  // Checked before the mode: an 'onFile' CV (edit mode, untouched) or a
  // fresh 'uploaded' one satisfies the requirement regardless of which
  // mode is currently selected, since switching modes doesn't clear
  // whatever was already uploaded.
  const upload = state.uploads.cv
  if (upload?.kind === 'uploaded' || upload?.kind === 'onFile') return true
  return state.cvMode === 'reuse' && Boolean(state.reuseCvId)
}

/**
 * Edit mode's starting state: text answers prefilled from the existing
 * application, and any FILE requirement that already has a documentUrl
 * seeded as 'onFile' so it isn't flagged as missing without being
 * re-uploaded. CV reuse defaults to keeping what's already there.
 */
export function deriveEditState(
  requirements: DocumentRequirement[],
  existingAnswers: Record<string, string>,
  existingDocumentKeys: Set<string>,
): ApplyFormState {
  const uploads: Record<string, FieldUpload> = {}
  const answers: Record<string, string> = {}
  for (const requirement of requirements) {
    if (requirement.key === 'cv') continue
    if (requirement.kind === 'FILE') {
      uploads[requirement.key] = existingDocumentKeys.has(requirement.key) ? { kind: 'onFile' } : { kind: 'idle' }
    } else {
      answers[requirement.key] = existingAnswers[requirement.key] ?? ''
    }
  }

  return {
    uploads: { ...uploads, cv: existingDocumentKeys.has('cv') ? { kind: 'onFile' } : { kind: 'idle' } },
    answers,
    cvMode: 'reuse',
    reuseCvId: null,
    newCvLabel: '',
    coverLetter: '',
    submitAttempted: false,
    serverFieldErrors: {},
  }
}

export interface OutstandingItem {
  fieldId: string
  message: string
}

/**
 * Every requirement label is read from the posting the state was derived
 * from, so the outstanding-items list can only ever name a field the
 * posting actually asked for.
 */
export function outstandingItems(state: ApplyFormState, requirements: DocumentRequirement[]): OutstandingItem[] {
  const items: OutstandingItem[] = []

  for (const requirement of requirements) {
    if (!requirement.required) continue

    if (requirement.key === 'cv') {
      if (!cvSatisfied(state)) items.push({ fieldId: 'field-cv', message: `${requirement.label} is required.` })
      continue
    }

    if (requirement.kind === 'FILE') {
      const upload = state.uploads[requirement.key]
      if (upload?.kind !== 'uploaded' && upload?.kind !== 'onFile') {
        items.push({ fieldId: `field-${requirement.key}`, message: `${requirement.label} is required.` })
      }
    } else {
      const answer = state.answers[requirement.key]
      if (!answer || !answer.trim()) {
        items.push({ fieldId: `field-${requirement.key}`, message: `${requirement.label} is required.` })
      }
    }
  }

  const anyUploading = Object.values(state.uploads).some((upload) => upload.kind === 'uploading')
  if (anyUploading) items.push({ fieldId: 'field-cv', message: 'Wait for every upload to finish.' })

  const anyFailed = Object.entries(state.uploads).filter(([, upload]) => upload.kind === 'failed')
  for (const [key] of anyFailed) {
    items.push({ fieldId: `field-${key}`, message: 'Retry the upload that failed, or remove it.' })
  }

  return items
}

export function canSubmit(state: ApplyFormState, requirements: DocumentRequirement[], jobIsOpen: boolean): boolean {
  return jobIsOpen && outstandingItems(state, requirements).length === 0
}

export interface SubmitBody {
  jobId: string
  documents: Record<string, string>
  answers: Record<string, string>
  reuseCvId?: string
  coverLetter?: string
}

/**
 * Only requirement keys can appear in the built body, because both maps
 * are derived from the requirements list the state itself was built from.
 * The backend's strip_unknown would drop anything else anyway; this just
 * means it never has to.
 */
export function buildSubmitBody(state: ApplyFormState, jobId: string): SubmitBody {
  const documents: Record<string, string> = {}
  for (const [key, upload] of Object.entries(state.uploads)) {
    if (upload.kind === 'uploaded') documents[key] = upload.s3Key
  }

  const answers: Record<string, string> = {}
  for (const [key, value] of Object.entries(state.answers)) {
    if (value.trim()) answers[key] = value.trim()
  }

  const body: SubmitBody = { jobId, documents, answers }
  if (state.cvMode === 'reuse' && state.reuseCvId) body.reuseCvId = state.reuseCvId
  if (state.coverLetter.trim()) body.coverLetter = state.coverLetter.trim()
  return body
}
