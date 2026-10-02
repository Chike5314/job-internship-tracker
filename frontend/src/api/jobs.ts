import { http } from './http'
import type { CompanySnippet, JobSummary } from './types'
import type { OpportunityType, WorkModality, ExperienceLevel } from './enums'

export interface PostingFilters {
  type?: OpportunityType
  modality?: WorkModality
  city?: string
  country?: string
  experience?: ExperienceLevel
  salaryMin?: number
  salaryMax?: number
  q?: string
}

// GET /jobs is public=True at the API Gateway level (AuthorizationType.NONE),
// so it never sees a signed-in caller no matter what's sent. auth: 'none'
// here is not just an optimisation, it's what the route actually is.
export function listJobs(filters: PostingFilters = {}): Promise<{ count: number; jobs: JobSummary[] }> {
  return http.get('/jobs', { query: filters, auth: 'none' })
}

export function getJob(jobId: string): Promise<{ job: JobSummary; company: CompanySnippet }> {
  return http.get(`/jobs/${jobId}`, { auth: 'none' })
}
