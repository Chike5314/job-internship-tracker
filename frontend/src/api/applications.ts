import { http } from './http'
import type {
  ApplicationDetail,
  ApplicationStatusView,
  ApplicationSummary,
  Interview,
  RecruiterApplication,
  UploadUrlResponse,
} from './types'
import type { InterviewMode } from './enums'

export function listMyApplications(): Promise<{ count: number; applications: ApplicationSummary[] }> {
  return http.get('/applications/me')
}

export function getApplication(applicationId: string): Promise<{ application: ApplicationDetail }> {
  return http.get(`/applications/${applicationId}`)
}

/**
 * The same route as getApplication, read by the company. Opening a SUBMITTED
 * application this way is what moves it to UNDER_REVIEW and freezes it, so
 * this read changes the pipeline.
 */
export function getApplicationForRecruiter(
  applicationId: string,
): Promise<{ application: RecruiterApplication }> {
  return http.get(`/applications/${applicationId}`)
}

export function createApplicationUploadUrl(params: {
  jobId: string
  documentKey: string
  fileName: string
  contentType: string
  fileSize: number
}): Promise<UploadUrlResponse & { documentKey: string }> {
  return http.post('/applications/upload-url', { body: params })
}

export function submitApplication(params: {
  jobId: string
  documents: Record<string, string>
  answers: Record<string, string>
  reuseCvId?: string
  coverLetter?: string
}): Promise<{ application: ApplicationSummary; message: string }> {
  return http.post('/applications', { body: params })
}

export function amendApplication(
  applicationId: string,
  params: {
    documents?: Record<string, string>
    answers?: Record<string, string>
    reuseCvId?: string
    coverLetter?: string
  },
): Promise<{ application: ApplicationDetail }> {
  return http.patch(`/applications/${applicationId}`, { body: params })
}

export function changeApplicationStatus(
  applicationId: string,
  params: { status: string; note?: string },
): Promise<{ application: ApplicationStatusView }> {
  return http.patch(`/applications/${applicationId}/status`, { body: params })
}

export function respondToInterview(
  applicationId: string,
  action: 'CONFIRM' | 'DECLINE',
): Promise<{ interviews: Interview[] }> {
  return http.patch(`/applications/${applicationId}/interview`, { body: { action } })
}

export function scheduleInterview(
  applicationId: string,
  params: { scheduledAt: string; mode: InterviewMode; durationMinutes: number; locationOrLink: string },
): Promise<{ interview: Interview; status: string }> {
  return http.post(`/applications/${applicationId}/interview`, { body: params })
}

/** The company moves a time that still stands. The old entry is kept, marked
 *  CANCELLED, and the new one names it in replacesInterviewId. */
export function rescheduleInterview(
  applicationId: string,
  params: { scheduledAt: string; mode: InterviewMode; durationMinutes: number; locationOrLink: string },
): Promise<{ interviews: Interview[] }> {
  return http.patch(`/applications/${applicationId}/interview`, { body: { action: 'RESCHEDULE', ...params } })
}
