import type { PostingDraft } from '@/api/company'
import type { DocumentRequirement, JobSummary } from '@/api/types'
import type { OpportunityType } from '@/api/enums'

/**
 * The default document list per opportunity type.
 *
 * It is a starting point, nothing more. The posting decides what it asks for,
 * never the type: a recruiter who removes the authorisation letter from an
 * academic internship gets applications without one, and the apply form is
 * rendered from whatever this list ends up as.
 */
export const DEFAULT_DOCUMENTS: Record<OpportunityType, DocumentRequirement[]> = {
  FULL_TIME_JOB: [
    { key: 'cv', label: 'CV', kind: 'FILE', required: true },
    { key: 'coverLetter', label: 'Cover letter', kind: 'FILE', required: true },
    { key: 'experience', label: 'Work experience', kind: 'TEXT', required: false },
    { key: 'portfolio', label: 'Portfolio links', kind: 'TEXT', required: false },
  ],
  PROFESSIONAL_INTERNSHIP: [
    { key: 'cv', label: 'CV', kind: 'FILE', required: true },
    { key: 'coverLetter', label: 'Cover letter', kind: 'FILE', required: true },
    { key: 'availability', label: 'When you can start, and for how long', kind: 'TEXT', required: true },
  ],
  ACADEMIC_INTERNSHIP: [
    { key: 'cv', label: 'CV', kind: 'FILE', required: true },
    { key: 'transcript', label: 'Transcript', kind: 'FILE', required: true },
    {
      key: 'schoolAuthorisation',
      label: "Your school's authorisation letter",
      kind: 'FILE',
      required: true,
    },
  ],
}

export function emptyDraft(): PostingDraft {
  return {
    title: '',
    description: '',
    opportunityType: 'FULL_TIME_JOB',
    workModality: 'ONSITE',
    openings: 1,
    skills: [],
    documentRequirements: DEFAULT_DOCUMENTS.FULL_TIME_JOB,
    salary: { disclosed: false },
  }
}

export function draftFromJob(job: JobSummary): PostingDraft {
  return {
    title: job.title,
    description: job.description,
    opportunityType: job.opportunityType,
    workModality: job.workModality,
    city: job.city,
    country: job.country,
    openings: job.openings,
    applicationDeadline: job.applicationDeadline,
    experienceLevel: job.experienceLevel,
    startDate: job.startDate,
    duration: job.duration,
    skills: job.skills ?? [],
    salary: job.salary ?? { disclosed: false },
    additionalDetails: job.additionalDetails ?? [],
    documentRequirements: job.documentRequirements,
  }
}

/** Every application needs a CV, so that one entry cannot be removed or made
 *  optional however the rest of the list is edited. */
export function isLocked(requirement: DocumentRequirement): boolean {
  return requirement.key === 'cv'
}

/** One line under each type, as the editor board words it. */
export const TYPE_DESCRIPTION: Record<OpportunityType, string> = {
  FULL_TIME_JOB: 'For job seekers and working professionals',
  PROFESSIONAL_INTERNSHIP: 'For students, graduates and career changers',
  ACADEMIC_INTERNSHIP: 'For enrolled students, with school approval',
}

const pad = (n: number) => String(n).padStart(2, '0')

/** "2026-10-09", the local day an instant falls on, for a select's value. */
export function dayValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/**
 * The last second of a chosen day, in local time. The editor tells the
 * recruiter the posting closes itself at the end of the day they pick, so the
 * stored instant is that end rather than the midnight that starts it.
 */
export function endOfDay(value: string): string {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year!, month! - 1, day!, 23, 59, 59).toISOString()
}

export type Blocker = { step: 1 | 2 | 3; text: string }

/**
 * What stands between a draft and a save, or a publish.
 *
 * Saving needs a title and a description, because POST /jobs refuses a
 * posting without either. Publishing also needs a place and a deadline that
 * has not passed: the board asks for a deadline so every posting closes
 * itself, and the API refuses one already past.
 */
export function blockers(draft: PostingDraft, intent: 'save' | 'publish', now = Date.now()): Blocker[] {
  const found: Blocker[] = []
  if (!draft.title.trim()) found.push({ step: 1, text: 'Add a posting title (step 1).' })
  if (intent === 'publish') {
    if (draft.workModality !== 'REMOTE' && !draft.city?.trim()) {
      found.push({ step: 1, text: 'Add a city (step 1).' })
    }
    if (!draft.applicationDeadline) {
      found.push({
        step: 1,
        text: 'Choose an application deadline (step 1). The posting closes itself when it passes.',
      })
    } else if (new Date(draft.applicationDeadline).getTime() <= now) {
      found.push({ step: 1, text: 'Choose a deadline that has not passed yet (step 1).' })
    }
  }
  if (!draft.description.trim()) {
    found.push({ step: 2, text: 'Say a few lines about the role (step 2).' })
  }
  // The API refuses a shown salary with no figure, or one that starts above
  // where it ends, so both stop a save as well as a publish.
  const salary = draft.salary
  if (salary?.disclosed) {
    if (salary.min == null && salary.max == null) {
      found.push({ step: 2, text: 'Add a salary figure, or untick Show salary to applicants (step 2).' })
    } else if (salary.min != null && salary.max != null && salary.min > salary.max) {
      found.push({ step: 2, text: 'The lower salary figure is above the upper one (step 2).' })
    }
  }
  if ((draft.additionalDetails ?? []).some((detail) => !detail.label.trim() !== !detail.value.trim())) {
    found.push({ step: 2, text: 'Give each extra detail a name and a value, or remove it (step 2).' })
  }
  if ((draft.documentRequirements ?? []).some((requirement) => !requirement.label.trim())) {
    found.push({ step: 3, text: 'Name every document, or remove it (step 3).' })
  }
  return found
}

/** The API's own limits on one posting. */
export const MAX_DETAILS = 20
export const MAX_DOCUMENTS = 15
export const MAX_SKILLS = 30

/**
 * The draft as it is sent. An extra detail left entirely empty is a row the
 * recruiter added and never used, so it is dropped rather than refused.
 */
export function toSave(draft: PostingDraft): PostingDraft {
  return {
    ...draft,
    title: draft.title.trim(),
    additionalDetails: (draft.additionalDetails ?? [])
      .filter((detail) => detail.label.trim() || detail.value.trim())
      .map((detail) => ({ label: detail.label.trim(), value: detail.value.trim() })),
    documentRequirements: (draft.documentRequirements ?? []).map((requirement) => ({
      ...requirement,
      label: requirement.label.trim(),
    })),
  }
}

/** Whether a document is one the type starts with, for the note under it. */
export function isDefaultFor(type: OpportunityType, key: string): boolean {
  return DEFAULT_DOCUMENTS[type].some((requirement) => requirement.key === key)
}
