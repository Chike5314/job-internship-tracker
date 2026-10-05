import { http } from './http'
import type { VerificationStatus } from './enums'
import type { AdminOverview, CompanyFull, CompanySnippet, JobSummary } from './types'

/**
 * The admin routes, all behind the Admins group at the gateway (FR-9). An admin
 * account is created by hand in the Cognito console, never through the API
 * (FR-9.9), so nothing here can make one.
 */

/** FR-9.5. Platform counts and the size of the verification queue. */
export function getAdminOverview(): Promise<AdminOverview> {
  return http.get('/admin/overview')
}

/** The most the list route returns for one status; a full page means there may
 *  be more. */
export const COMPANY_PAGE_LIMIT = 200

/** FR-9.3. Served off VerificationStatusIndex, one status at a time. */
export function listCompaniesByStatus(
  status: VerificationStatus,
): Promise<{ status: VerificationStatus; count: number; companies: CompanyFull[] }> {
  return http.get('/companies', { query: { status } })
}

/**
 * FR-9.1, FR-9.2 and FR-9.4. Approves, rejects, suspends or restores a company,
 * appending the decision to its history. A suspension or a rejection also
 * takes its live postings down, and the response says how many.
 */
export function setCompanyStatus(
  companyId: string,
  params: { verificationStatus: VerificationStatus; note?: string },
): Promise<{ company: CompanyFull; postingsUnpublished: number }> {
  return http.patch(`/companies/${companyId}/status`, { body: params })
}

export interface NewCompanyAccount {
  companyName: string
  contactEmail: string
  companyWebsiteUrl: string
  officeAddress?: string
  googleMapsUrl?: string
  /** True puts it straight into Verified; false sends it to the queue (FR-9.7). */
  verifyNow: boolean
}

/**
 * FR-9.6. Creates the recruiter account and its company record together, since
 * the company is keyed on the account. Cognito emails the contact address a
 * temporary password; the company sets its own at first sign in.
 */
export function createCompanyAccount(
  params: NewCompanyAccount,
): Promise<{ company: CompanyFull; accountCreated: boolean; temporaryPasswordSentTo: string }> {
  return http.post('/admin/companies', { body: params })
}

/**
 * One posting in full, in any status, with its company. GET /jobs/mine/{id}
 * answers an admin for any company's posting, as well as the owner.
 */
export function getPostingForAdmin(jobId: string): Promise<{ job: JobSummary; company: CompanySnippet }> {
  return http.get(`/jobs/mine/${jobId}`)
}
