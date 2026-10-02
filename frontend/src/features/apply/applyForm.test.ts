import { describe, expect, it } from 'vitest'
import type { CvEntry, DocumentRequirement } from '@/api/types'
import {
  buildSubmitBody,
  canSubmit,
  deriveEditState,
  deriveInitialState,
  outstandingItems,
  type ApplyFormState,
} from './applyForm'

// The three seeded postings' default requirement sets, from
// src/common/documents.py's DEFAULT_REQUIREMENTS, proving the form logic
// is genuinely driven by whatever shape a posting carries rather than one
// hardcoded case.
const FULL_TIME_JOB: DocumentRequirement[] = [
  { key: 'cv', label: 'CV or resume', kind: 'FILE', required: true },
  { key: 'coverLetter', label: 'Cover letter', kind: 'FILE', required: true },
  { key: 'portfolio', label: 'Portfolio links', kind: 'TEXT', required: false },
]

const PROFESSIONAL_INTERNSHIP: DocumentRequirement[] = [
  { key: 'cv', label: 'CV or resume', kind: 'FILE', required: true },
  { key: 'coverLetter', label: 'Cover letter', kind: 'FILE', required: true },
  { key: 'availability', label: 'Availability window', kind: 'TEXT', required: true },
]

const ACADEMIC_INTERNSHIP: DocumentRequirement[] = [
  { key: 'cv', label: 'CV or resume', kind: 'FILE', required: true },
  { key: 'coverLetter', label: 'Cover letter', kind: 'FILE', required: true },
  { key: 'transcript', label: 'Academic transcript', kind: 'FILE', required: true },
  { key: 'schoolAuthorisation', label: 'School authorisation letter', kind: 'FILE', required: true },
]

const ONE_CV: CvEntry[] = [
  { cvId: 'cv_1', label: 'Seed resume', s3Key: 'cvs/user/1-resume.pdf', uploadedAt: '2026-09-29T00:00:00.000Z', downloadUrl: 'https://example.com/cv' },
]

function pdf(name: string): File {
  return new File(['%PDF-1.4'], name, { type: 'application/pdf' })
}

describe('deriveInitialState', () => {
  it('defaults CV mode to reuse when a CV exists, and preselects the newest one', () => {
    const state = deriveInitialState(FULL_TIME_JOB, ONE_CV)
    expect(state.cvMode).toBe('reuse')
    expect(state.reuseCvId).toBe('cv_1')
  })

  it('defaults CV mode to upload when there is nothing to reuse', () => {
    const state = deriveInitialState(FULL_TIME_JOB, [])
    expect(state.cvMode).toBe('upload')
    expect(state.reuseCvId).toBeNull()
  })

  it('seeds an idle upload slot for every non-cv FILE requirement, and an empty answer for every TEXT one', () => {
    const state = deriveInitialState(ACADEMIC_INTERNSHIP, [])
    expect(state.uploads.coverLetter).toEqual({ kind: 'idle' })
    expect(state.uploads.transcript).toEqual({ kind: 'idle' })
    expect(state.uploads.schoolAuthorisation).toEqual({ kind: 'idle' })
    expect(state.uploads.cv).toBeUndefined() // cv is handled separately, not as a plain upload slot
    expect(state.answers).toEqual({})
  })
})

describe('canSubmit / outstandingItems, across the three seeded requirement shapes', () => {
  it('Full time job: blocks on the required cv and cover letter, portfolio is optional', () => {
    let state = deriveInitialState(FULL_TIME_JOB, [])
    expect(canSubmit(state, FULL_TIME_JOB, true)).toBe(false)
    expect(outstandingItems(state, FULL_TIME_JOB).map((i) => i.fieldId)).toEqual(
      expect.arrayContaining(['field-cv', 'field-coverLetter']),
    )

    state = {
      ...state,
      uploads: {
        ...state.uploads,
        cv: { kind: 'uploaded', s3Key: 'cvs/x/cv.pdf', fileName: 'cv.pdf' },
        coverLetter: { kind: 'uploaded', s3Key: 'cover-letters/x/cl.pdf', fileName: 'cl.pdf' },
      },
    }
    expect(canSubmit(state, FULL_TIME_JOB, true)).toBe(true)
  })

  it('Professional internship: the text requirement is required, not optional', () => {
    const cvAndLetterDone: Partial<ApplyFormState> = {
      uploads: {
        cv: { kind: 'uploaded', s3Key: 'cvs/x/cv.pdf', fileName: 'cv.pdf' },
        coverLetter: { kind: 'uploaded', s3Key: 'cover-letters/x/cl.pdf', fileName: 'cl.pdf' },
      },
    }
    const missingAnswer = { ...deriveInitialState(PROFESSIONAL_INTERNSHIP, []), ...cvAndLetterDone, answers: { availability: '' } }
    expect(canSubmit(missingAnswer, PROFESSIONAL_INTERNSHIP, true)).toBe(false)

    const withAnswer = { ...missingAnswer, answers: { availability: 'Weekdays, 9 to 5.' } }
    expect(canSubmit(withAnswer, PROFESSIONAL_INTERNSHIP, true)).toBe(true)
  })

  it('Academic internship: all four file requirements are required, there is no text field at all', () => {
    const state = deriveInitialState(ACADEMIC_INTERNSHIP, [])
    expect(Object.keys(state.answers)).toEqual([])
    const outstanding = outstandingItems(state, ACADEMIC_INTERNSHIP).map((i) => i.fieldId)
    expect(outstanding).toEqual(
      expect.arrayContaining(['field-cv', 'field-coverLetter', 'field-transcript', 'field-schoolAuthorisation']),
    )
  })

  it('a job that is no longer open blocks submission even with every field satisfied', () => {
    const state: ApplyFormState = {
      ...deriveInitialState(FULL_TIME_JOB, []),
      uploads: {
        cv: { kind: 'uploaded', s3Key: 'cvs/x/cv.pdf', fileName: 'cv.pdf' },
        coverLetter: { kind: 'uploaded', s3Key: 'cover-letters/x/cl.pdf', fileName: 'cl.pdf' },
      },
    }
    expect(canSubmit(state, FULL_TIME_JOB, false)).toBe(false)
  })

  it('blocks while any upload is in flight or has failed', () => {
    const uploading: ApplyFormState = {
      ...deriveInitialState(FULL_TIME_JOB, []),
      uploads: {
        cv: { kind: 'uploaded', s3Key: 'cvs/x/cv.pdf', fileName: 'cv.pdf' },
        coverLetter: { kind: 'uploading', file: pdf('cl.pdf'), progress: 0.5 },
      },
    }
    expect(canSubmit(uploading, FULL_TIME_JOB, true)).toBe(false)

    const failed: ApplyFormState = {
      ...deriveInitialState(FULL_TIME_JOB, []),
      uploads: {
        cv: { kind: 'uploaded', s3Key: 'cvs/x/cv.pdf', fileName: 'cv.pdf' },
        coverLetter: { kind: 'failed', file: pdf('cl.pdf'), message: 'oops' },
      },
    }
    expect(canSubmit(failed, FULL_TIME_JOB, true)).toBe(false)
  })
})

describe('CV reuse vs fresh upload branches', () => {
  it('reuse mode with a chosen CV satisfies the cv requirement without an upload', () => {
    const state: ApplyFormState = { ...deriveInitialState(FULL_TIME_JOB, ONE_CV) }
    expect(state.cvMode).toBe('reuse')
    const body = buildSubmitBody(
      {
        ...state,
        uploads: { ...state.uploads, coverLetter: { kind: 'uploaded', s3Key: 'k', fileName: 'cl.pdf' } },
      },
      'job_1',
    )
    expect(body.reuseCvId).toBe('cv_1')
    expect(body.documents.cv).toBeUndefined()
  })

  it('upload mode with a fresh file satisfies the cv requirement and is sent as documents.cv', () => {
    const state: ApplyFormState = {
      ...deriveInitialState(FULL_TIME_JOB, []),
      cvMode: 'upload',
      uploads: {
        cv: { kind: 'uploaded', s3Key: 'cvs/x/new-cv.pdf', fileName: 'new-cv.pdf' },
        coverLetter: { kind: 'uploaded', s3Key: 'cover-letters/x/cl.pdf', fileName: 'cl.pdf' },
      },
    }
    const body = buildSubmitBody(state, 'job_1')
    expect(body.documents.cv).toBe('cvs/x/new-cv.pdf')
    expect(body.reuseCvId).toBeUndefined()
  })
})

describe('buildSubmitBody', () => {
  it('only includes requirement keys, trims answers, and omits an empty cover letter', () => {
    const state: ApplyFormState = {
      ...deriveInitialState(PROFESSIONAL_INTERNSHIP, ONE_CV),
      answers: { availability: '  Weekdays only.  ' },
      uploads: { coverLetter: { kind: 'uploaded', s3Key: 'k', fileName: 'cl.pdf' } },
      coverLetter: '   ',
    }
    const body = buildSubmitBody(state, 'job_2')
    expect(body).toEqual({
      jobId: 'job_2',
      documents: { coverLetter: 'k' },
      answers: { availability: 'Weekdays only.' },
      reuseCvId: 'cv_1',
    })
  })

  it('includes a non-empty message to the recruiter, trimmed', () => {
    const state: ApplyFormState = {
      ...deriveInitialState(FULL_TIME_JOB, ONE_CV),
      coverLetter: '  I would love to join the team.  ',
    }
    const body = buildSubmitBody(state, 'job_3')
    expect(body.coverLetter).toBe('I would love to join the team.')
  })
})

describe('deriveEditState (edit mode)', () => {
  it('marks a FILE requirement already on the application as onFile, satisfying it without a fresh upload', () => {
    const state = deriveEditState(ACADEMIC_INTERNSHIP, {}, new Set(['cv', 'coverLetter', 'transcript', 'schoolAuthorisation']))
    expect(state.uploads.cv).toEqual({ kind: 'onFile' })
    expect(state.uploads.coverLetter).toEqual({ kind: 'onFile' })
    expect(canSubmit(state, ACADEMIC_INTERNSHIP, true)).toBe(true)
  })

  it('prefills existing text answers', () => {
    const state = deriveEditState(PROFESSIONAL_INTERNSHIP, { availability: 'Weekends only.' }, new Set(['cv', 'coverLetter']))
    expect(state.answers.availability).toBe('Weekends only.')
  })

  it('an onFile cv is never resubmitted as a fake document key', () => {
    const state = deriveEditState(FULL_TIME_JOB, {}, new Set(['cv', 'coverLetter']))
    const body = buildSubmitBody(state, 'job_4')
    expect(body.documents.cv).toBeUndefined()
    expect(body.reuseCvId).toBeUndefined()
  })
})
