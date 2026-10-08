import { http } from './http'
import type {
  BulkStatusResult,
  CompanyAnalytics,
  CompanyFull,
  CompanyApplicant,
  CompanyInterview,
  ExportResult,
  JobAnalytics,
  JobSummary,
  PipelineRow,
  UploadUrlResponse,
} from './types'
import type { ApplicationStatus, ExperienceLevel, OpportunityType, WorkModality } from './enums'

/**
 * The company's own record, in full.
 *
 * Not GET /companies/{id}: that route is public, so it has no authorizer, so it
 * never sees who is calling and can only ever serve the public view. The
 * company reads itself here instead, where the identifier comes from the token.
 */
export function getMyCompany(): Promise<{ company: CompanyFull }> {
  return http.get('/companies/mine')
}

export function registerCompany(params: {
  companyName: string
  contactEmail: string
  companyWebsiteUrl: string
  officeAddress?: string
  googleMapsUrl?: string
}): Promise<{ company: CompanyFull }> {
  return http.post('/companies', { body: params })
}

export function updateCompany(
  companyId: string,
  params: Partial<{
    companyName: string
    companyWebsiteUrl: string
    contactEmail: string
    officeAddress: string
    googleMapsUrl: string
    /** The key from createLogoUploadUrl, sent back only once the PUT has
     *  landed. The API hands the logo back as `logoUrl`, never as a key. */
    logoS3Key: string
  }>,
): Promise<{ company: CompanyFull }> {
  return http.patch(`/companies/${companyId}`, { body: params })
}

/** A presigned PUT for the company's logo. Recording it on the company is a
 *  separate call, made after the upload actually lands. */
export function createLogoUploadUrl(params: {
  fileName: string
  contentType: string
  fileSize: number
}): Promise<UploadUrlResponse> {
  return http.post('/companies/logo-upload-url', { body: params })
}

/** The company's own postings, drafts included. */
export function listMyJobs(): Promise<{ count: number; jobs: JobSummary[] }> {
  return http.get('/jobs/mine')
}

/** One of the company's own postings, in any status. The public
 *  GET /jobs/{id} serves published postings only. */
export function getMyJob(jobId: string): Promise<{ job: JobSummary }> {
  return http.get(`/jobs/mine/${jobId}`)
}

export interface PostingDraft {
  title: string
  description: string
  opportunityType: OpportunityType
  workModality: WorkModality
  city?: string
  country?: string
  openings?: number
  applicationDeadline?: string
  experienceLevel?: ExperienceLevel
  startDate?: string
  duration?: string
  skills?: string[]
  salary?: {
    disclosed: boolean
    min?: number
    max?: number
    currency?: string
    period?: 'HOUR' | 'MONTH' | 'YEAR'
  }
  additionalDetails?: { label: string; value: string }[]
  documentRequirements?: { key: string; label: string; kind: 'FILE' | 'TEXT'; required: boolean }[]
}

export function createJob(draft: PostingDraft): Promise<{ job: JobSummary }> {
  return http.post('/jobs', { body: draft })
}

export function updateJob(
  jobId: string,
  changes: Partial<PostingDraft> & { postingStatus?: JobSummary['postingStatus'] },
): Promise<{ job: JobSummary }> {
  return http.patch(`/jobs/${jobId}`, { body: changes })
}

export function listJobApplications(
  jobId: string,
  status?: ApplicationStatus,
): Promise<{ job: { jobId: string; title: string }; count: number; applications: PipelineRow[] }> {
  return http.get(`/jobs/${jobId}/applications`, { query: status ? { status } : {} })
}

/**
 * Up to fifty at a time. Each one is checked against the state machine on its
 * own, so the result comes back split: `updated` carries the ones that moved and
 * `refused` the ones that could not, each with its reason. A partial success is
 * the normal case, not an error.
 */
export function bulkUpdateStatus(
  jobId: string,
  params: { applicationIds: string[]; status: ApplicationStatus; note?: string },
): Promise<BulkStatusResult> {
  return http.patch(`/jobs/${jobId}/applications/bulk-status`, { body: params })
}

export function getJobAnalytics(jobId: string): Promise<JobAnalytics> {
  return http.get(`/jobs/${jobId}/analytics`)
}

export function getCompanyAnalytics(companyId: string): Promise<CompanyAnalytics> {
  return http.get(`/companies/${companyId}/analytics`)
}

/** The calendar, served off the sparse GSI. `from` and `to` are ISO instants.
 *
 * Two lists, not one. `interviews` is what is coming up; `awaitingOutcome` is
 * what has already happened with nothing recorded since, which is a job of work
 * rather than a calendar entry and has no lower bound in time.
 */
export function listCompanyInterviews(
  companyId: string,
  window: { from?: string; to?: string } = {},
): Promise<{
  from: string
  to: string
  count: number
  interviews: CompanyInterview[]
  awaitingOutcome: CompanyInterview[]
}> {
  return http.get(`/companies/${companyId}/interviews`, { query: window })
}

/** Everyone who has applied to this company, gathered by person.
 *
 * Assembled on read by walking the account's postings, so it answers the one
 * question no other recruiter route can: whether this is somebody you have
 * seen before, and what happened last time.
 */
export function listCompanyApplicants(
  companyId: string,
): Promise<{ companyId: string; applicants: CompanyApplicant[] }> {
  return http.get(`/companies/${companyId}/applicants`)
}

/** Writes a CSV to the documents bucket and hands back a presigned link to it.
 *  The link expires, so it is used immediately rather than stored. */
export function exportPipeline(
  companyId: string,
  params: { jobId?: string } = {},
): Promise<ExportResult> {
  return http.post(`/companies/${companyId}/export`, { body: params })
}
