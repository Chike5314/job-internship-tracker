import { http } from './http'
import type { VerificationStatus } from './enums'
import type { AdminOverview, CompanyFull } from './types'

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
