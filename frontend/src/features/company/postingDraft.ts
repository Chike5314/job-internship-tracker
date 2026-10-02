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
