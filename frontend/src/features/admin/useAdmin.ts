import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createCompanyAccount,
  getAdminOverview,
  getPostingForAdmin,
  listCompaniesByStatus,
  setCompanyStatus,
  type NewCompanyAccount,
} from '@/api/admin'
import { getCompanyAnalytics, updateJob } from '@/api/company'
import type { CompanySnippet, JobSummary } from '@/api/types'
import type { VerificationStatus } from '@/api/enums'
import { queryKeys } from '@/api/queryKeys'
import { useAuth } from '@/auth/AuthProvider'

/** True only for an account in the Admins group, which every admin route needs. */
export function useIsAdmin(): boolean {
  const { identity } = useAuth()
  return Boolean(identity?.groups.includes('Admins'))
}

/** The overview, which the rail also reads for the size of the queue. */
export function useAdminOverview() {
  const isAdmin = useIsAdmin()
  return useQuery({
    queryKey: queryKeys.admin.overview(),
    queryFn: () => getAdminOverview(),
    enabled: isAdmin,
    staleTime: 60_000,
  })
}

/** Every company at one standing. The overview and the companies page share
 *  these, so moving between them costs no second request. */
export function useCompaniesByStatus(status: VerificationStatus) {
  const isAdmin = useIsAdmin()
  return useQuery({
    queryKey: queryKeys.admin.companies(status),
    queryFn: () => listCompaniesByStatus(status),
    enabled: isAdmin,
    staleTime: 30_000,
  })
}

/**
 * One company's postings. There is no admin route that lists them, but the
 * company's analytics carries one row per posting, and an admin may read any
 * company's analytics (assert_owns_company lets an admin through).
 */
export function useCompanyPostings(companyId: string | undefined) {
  const isAdmin = useIsAdmin()
  return useQuery({
    queryKey: queryKeys.admin.companyPostings(companyId ?? ''),
    queryFn: () => getCompanyAnalytics(companyId as string),
    enabled: isAdmin && Boolean(companyId),
    staleTime: 30_000,
    select: (analytics) => analytics.perPosting,
  })
}

/** A decision on a company. Every admin list and count may move, so all of
 *  them are read again. */
export function useSetCompanyStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ companyId, ...params }: { companyId: string; verificationStatus: VerificationStatus; note?: string }) =>
      setCompanyStatus(companyId, params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin'] })
      // A suspension takes postings off the public listing.
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
    },
  })
}

/** FR-9.2: one posting taken down, leaving the company as it stands. */
export function useClosePosting(companyId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (jobId: string) => updateJob(jobId, { postingStatus: 'CLOSED' }),
    onSuccess: ({ job }) => {
      // A posting open in the drawer shows its new status at once.
      queryClient.setQueryData<{ job: JobSummary; company: CompanySnippet }>(queryKeys.admin.posting(job.jobId), (current) =>
        current ? { ...current, job } : current,
      )
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.companyPostings(companyId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.overview() })
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
    },
  })
}

/** FR-9.6 and FR-9.7. The new company joins a list and the counts, so they are read again. */
export function useCreateCompany() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (params: NewCompanyAccount) => createCompanyAccount(params),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin'] }),
  })
}

/** One posting in full, for the postings drawer. */
export function useAdminPosting(jobId: string | undefined) {
  const isAdmin = useIsAdmin()
  return useQuery({
    queryKey: queryKeys.admin.posting(jobId ?? ''),
    queryFn: () => getPostingForAdmin(jobId as string),
    enabled: isAdmin && Boolean(jobId),
    staleTime: 30_000,
    retry: false,
  })
}
