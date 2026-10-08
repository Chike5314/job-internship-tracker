import { describe, expect, it } from 'vitest'
import { applicantActions } from './stateMachine'
import type { ApplicationStatus } from './enums'

// Mirrors APPLICANT_TRANSITIONS in src/common/state_machine.py exactly.
const EXPECTED: Record<ApplicationStatus, ApplicationStatus[]> = {
  SUBMITTED: ['WITHDRAWN'],
  UNDER_REVIEW: ['WITHDRAWN'],
  INTERVIEW_SCHEDULED: ['WITHDRAWN'],
  OFFER_EXTENDED: ['OFFER_ACCEPTED', 'OFFER_DECLINED', 'WITHDRAWN'],
  OFFER_ACCEPTED: [],
  OFFER_DECLINED: [],
  REJECTED: [],
  WITHDRAWN: [],
}

describe('applicantActions', () => {
  for (const [status, expected] of Object.entries(EXPECTED)) {
    it(`matches the backend's transition table for ${status}`, () => {
      expect(applicantActions(status as ApplicationStatus)).toEqual(expected)
    })
  }
})
