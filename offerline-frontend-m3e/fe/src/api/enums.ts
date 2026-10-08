// Transcribed from src/common/validation.py. Keep these unions and labels
// in step with that file, not the other way around: the backend is the
// authority on what values it accepts.
export type OpportunityType = 'FULL_TIME_JOB' | 'PROFESSIONAL_INTERNSHIP' | 'ACADEMIC_INTERNSHIP'
export type WorkModality = 'ONSITE' | 'HYBRID' | 'REMOTE'
export type ExperienceLevel = 'ENTRY' | 'MID' | 'SENIOR'
export type DegreeLevel = 'HND' | 'BACHELORS' | 'MASTERS' | 'DOCTORATE' | 'OTHER'
export type InterviewMode = 'ONSITE' | 'ONLINE'
export type SalaryPeriod = 'HOUR' | 'MONTH' | 'YEAR'
export type InterviewState = 'PROPOSED' | 'CONFIRMED' | 'DECLINED' | 'CANCELLED'

// Matches ALL_STATUSES in src/common/state_machine.py.
export type ApplicationStatus =
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'INTERVIEW_SCHEDULED'
  | 'OFFER_EXTENDED'
  | 'OFFER_ACCEPTED'
  | 'OFFER_DECLINED'
  | 'REJECTED'
  | 'WITHDRAWN'

export const ALL_STATUSES: ApplicationStatus[] = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'INTERVIEW_SCHEDULED',
  'OFFER_EXTENDED',
  'OFFER_ACCEPTED',
  'OFFER_DECLINED',
  'REJECTED',
  'WITHDRAWN',
]

export const FINAL_STATUSES: ApplicationStatus[] = [
  'OFFER_ACCEPTED',
  'OFFER_DECLINED',
  'REJECTED',
  'WITHDRAWN',
]

// REJECTED -> "Not taken forward" matches STATUS_WORDING in
// notification_service/handler.py exactly, so an applicant never reads a
// softer word on screen than the one already emailed to them.
export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under review',
  INTERVIEW_SCHEDULED: 'Interview scheduled',
  OFFER_EXTENDED: 'Offer extended',
  OFFER_ACCEPTED: 'Offer accepted',
  OFFER_DECLINED: 'Offer declined',
  REJECTED: 'Not taken forward',
  WITHDRAWN: 'Withdrawn',
}

export type VerificationStatus = 'PENDING_VERIFICATION' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED'

/** Where a company account stands with verification, in the order an admin
 *  works through them. */
export const VERIFICATION_STATUSES: VerificationStatus[] = ['PENDING_VERIFICATION', 'VERIFIED', 'REJECTED', 'SUSPENDED']

export const VERIFICATION_STATUS_LABEL: Record<VerificationStatus, string> = {
  PENDING_VERIFICATION: 'Waiting for verification',
  VERIFIED: 'Verified',
  REJECTED: 'Rejected',
  SUSPENDED: 'Suspended',
}

export const OPPORTUNITY_TYPE_LABEL: Record<OpportunityType, string> = {
  FULL_TIME_JOB: 'Full-time job',
  PROFESSIONAL_INTERNSHIP: 'Professional internship',
  ACADEMIC_INTERNSHIP: 'Academic internship',
}

export const WORK_MODALITY_LABEL: Record<WorkModality, string> = {
  ONSITE: 'On site',
  HYBRID: 'Hybrid',
  REMOTE: 'Remote',
}

export const EXPERIENCE_LEVEL_LABEL: Record<ExperienceLevel, string> = {
  ENTRY: 'Entry level',
  MID: 'Mid level',
  SENIOR: 'Senior',
}

export const DEGREE_LEVEL_LABEL: Record<DegreeLevel, string> = {
  HND: 'HND',
  BACHELORS: 'Bachelors',
  MASTERS: 'Masters',
  DOCTORATE: 'Doctorate',
  OTHER: 'Other',
}

export const INTERVIEW_MODE_LABEL: Record<InterviewMode, string> = {
  ONSITE: 'In person',
  ONLINE: 'Online',
}

// Matches ALLOWED_DOCUMENT_EXTENSIONS / ALLOWED_IMAGE_EXTENSIONS and
// MAX_UPLOAD_BYTES in src/common/validation.py and src/common/config.py.
export const ALLOWED_DOCUMENT_EXTENSIONS = ['pdf', 'doc', 'docx']
export const ALLOWED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png']
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
