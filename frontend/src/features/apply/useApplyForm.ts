import { useCallback, useReducer } from 'react'
import { createApplicationUploadUrl } from '@/api/applications'
import { confirmCvUpload, createProfileUploadUrl } from '@/api/profile'
import { resolveContentType, putToPresignedUrl } from '@/api/uploads'
import { ALLOWED_DOCUMENT_EXTENSIONS, MAX_UPLOAD_BYTES } from '@/api/enums'
import type { CvEntry, DocumentRequirement } from '@/api/types'
import { deriveInitialState, type ApplyFormState, type FieldUpload } from './applyForm'

type Action =
  | { type: 'SET_UPLOAD'; key: string; upload: FieldUpload }
  | { type: 'SET_ANSWER'; key: string; value: string }
  | { type: 'SET_CV_MODE'; mode: 'reuse' | 'upload' }
  | { type: 'SET_REUSE_CV_ID'; id: string }
  | { type: 'SET_NEW_CV_LABEL'; label: string }
  | { type: 'SET_COVER_LETTER'; value: string }
  | { type: 'SUBMIT_ATTEMPTED' }
  | { type: 'SET_SERVER_FIELD_ERRORS'; errors: Record<string, string> }

function reducer(state: ApplyFormState, action: Action): ApplyFormState {
  switch (action.type) {
    case 'SET_UPLOAD':
      return { ...state, uploads: { ...state.uploads, [action.key]: action.upload } }
    case 'SET_ANSWER':
      return { ...state, answers: { ...state.answers, [action.key]: action.value } }
    case 'SET_CV_MODE':
      return { ...state, cvMode: action.mode }
    case 'SET_REUSE_CV_ID':
      return { ...state, reuseCvId: action.id }
    case 'SET_NEW_CV_LABEL':
      return { ...state, newCvLabel: action.label }
    case 'SET_COVER_LETTER':
      return { ...state, coverLetter: action.value }
    case 'SUBMIT_ATTEMPTED':
      return { ...state, submitAttempted: true }
    case 'SET_SERVER_FIELD_ERRORS':
      return { ...state, serverFieldErrors: action.errors }
    default:
      return state
  }
}

// Matches validate_upload_request in src/common/validation.py, so the
// client-side message can never diverge from what the server would have
// said, and no network call happens for a file that will be refused.
function localValidationError(file: File): string | null {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!ALLOWED_DOCUMENT_EXTENSIONS.includes(extension)) {
    return `Allowed file types are ${[...ALLOWED_DOCUMENT_EXTENSIONS].sort().join(', ')}.`
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return 'Files must be ten megabytes or smaller.'
  }
  return null
}

/** "Field_Eng_CV_2026.pdf" becomes "Field Eng CV 2026", the label a CV
 *  starts with until the applicant names it. */
export function labelFromFileName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim()
}

export function useApplyForm(
  jobId: string,
  requirements: DocumentRequirement[],
  cvs: CvEntry[],
  initialState?: ApplyFormState,
) {
  const [state, dispatch] = useReducer(reducer, undefined, () => initialState ?? deriveInitialState(requirements, cvs))

  const setAnswer = useCallback((key: string, value: string) => dispatch({ type: 'SET_ANSWER', key, value }), [])
  const setCvMode = useCallback((mode: 'reuse' | 'upload') => dispatch({ type: 'SET_CV_MODE', mode }), [])
  const setReuseCvId = useCallback((id: string) => dispatch({ type: 'SET_REUSE_CV_ID', id }), [])
  const setNewCvLabel = useCallback((label: string) => dispatch({ type: 'SET_NEW_CV_LABEL', label }), [])
  const setCoverLetter = useCallback((value: string) => dispatch({ type: 'SET_COVER_LETTER', value }), [])
  const markSubmitAttempted = useCallback(() => dispatch({ type: 'SUBMIT_ATTEMPTED' }), [])
  const setServerFieldErrors = useCallback(
    (errors: Record<string, string>) => dispatch({ type: 'SET_SERVER_FIELD_ERRORS', errors }),
    [],
  )

  /**
   * Steps 1-2 (local validation, resolving the content type once) happen
   * before any request. Retry restarts at step 3 (a fresh presigned URL),
   * not step 4 (the PUT), because a fresh URL is cheap and an expired or
   * malformed one is a plausible cause of the earlier failure.
   */
  const uploadField = useCallback(
    async (key: string, file: File) => {
      const validationError = localValidationError(file)
      if (validationError) {
        dispatch({ type: 'SET_UPLOAD', key, upload: { kind: 'failed', file, message: validationError } })
        return
      }

      const contentType = resolveContentType(file)
      dispatch({ type: 'SET_UPLOAD', key, upload: { kind: 'uploading', file, progress: 0 } })
      // A CV is named after its file until the applicant types something else.
      if (key === 'cv' && !state.newCvLabel) {
        dispatch({ type: 'SET_NEW_CV_LABEL', label: labelFromFileName(file.name) })
      }

      try {
        const upload =
          key === 'cv'
            ? await createProfileUploadUrl({
                documentKind: 'cv',
                fileName: file.name,
                contentType,
                fileSize: file.size,
                ...(state.newCvLabel ? { label: state.newCvLabel } : {}),
              })
            : await createApplicationUploadUrl({
                jobId,
                documentKey: key,
                fileName: file.name,
                contentType,
                fileSize: file.size,
              })

        await putToPresignedUrl(upload.uploadUrl, file, contentType, (fraction) =>
          dispatch({ type: 'SET_UPLOAD', key, upload: { kind: 'uploading', file, progress: fraction } }),
        )

        dispatch({
          type: 'SET_UPLOAD',
          key,
          upload: { kind: 'uploaded', s3Key: upload.s3Key, fileName: file.name, size: file.size },
        })
      } catch {
        dispatch({
          type: 'SET_UPLOAD',
          key,
          upload: { kind: 'failed', file, message: 'That upload did not finish. Try again.' },
        })
      }
    },
    [jobId, state.newCvLabel],
  )

  /**
   * The third step for a CV uploaded here, run when the application is sent.
   * The CV goes through the profile route so it joins the library for reuse
   * later, and the library records it only once this confirms the upload
   * landed. It waits for the send rather than the upload because the label is
   * typed after the file is chosen, and a second confirm does not rename an
   * entry. The application itself needs nothing but the key, so a confirm that
   * fails costs the applicant a library entry and not the application.
   */
  const confirmCv = useCallback(async () => {
    const upload = state.uploads.cv
    if (upload?.kind !== 'uploaded') return
    try {
      await confirmCvUpload({
        s3Key: upload.s3Key,
        ...(state.newCvLabel.trim() ? { label: state.newCvLabel.trim() } : {}),
      })
    } catch {
      // Deliberately swallowed. See above.
    }
  }, [state.uploads.cv, state.newCvLabel])

  const clearUpload = useCallback(
    (key: string) => dispatch({ type: 'SET_UPLOAD', key, upload: { kind: 'idle' } }),
    [],
  )

  return {
    state,
    setAnswer,
    setCvMode,
    setReuseCvId,
    setNewCvLabel,
    setCoverLetter,
    markSubmitAttempted,
    setServerFieldErrors,
    uploadField,
    clearUpload,
    confirmCv,
  }
}
