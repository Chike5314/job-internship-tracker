import type { ApplicationStatus } from './enums'

// Mirrors APPLICANT_TRANSITIONS in src/common/state_machine.py. This only
// decides which action buttons render; the backend stays the actual
// authority and refuses anything wrong with INVALID_STATUS_TRANSITION.
// Where the API also supplies a decision flag directly on the response
// (canEdit, isFinal), that flag wins over re-deriving it here.
const APPLICANT_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  SUBMITTED: ['WITHDRAWN'],
  UNDER_REVIEW: ['WITHDRAWN'],
  INTERVIEW_SCHEDULED: ['WITHDRAWN'],
  OFFER_EXTENDED: ['OFFER_ACCEPTED', 'OFFER_DECLINED', 'WITHDRAWN'],
  OFFER_ACCEPTED: [],
  OFFER_DECLINED: [],
  REJECTED: [],
  WITHDRAWN: [],
}

export function applicantActions(status: ApplicationStatus): ApplicationStatus[] {
  return APPLICANT_TRANSITIONS[status]
}
