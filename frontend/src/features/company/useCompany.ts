import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  bulkUpdateStatus,
  createJob,
  exportPipeline,
  getCompanyAnalytics,
  getJobAnalytics,
  getMyCompany,
  getMyJob,
  listCompanyInterviews,
  listJobApplications,
  listMyJobs,
  updateCompany,
  updateJob,
  type PostingDraft,
} from '@/api/company'
import { queryKeys } from '@/api/queryKeys'
import { useAuth } from '@/auth/AuthProvider'
import type { ApplicationStatus } from '@/api/enums'
import type { JobSummary } from '@/api/types'

/**
 * A recruiter account is the company: the Cognito subject is the companyId, so
 * nothing here has to be told which company it is working on.
 */
export function useCompanyId(): string | undefined {
  const { identity } = useAuth()
  return identity?.userId
}

export function useMyCompany() {
  const { status } = useAuth()
  return useQuery({
    queryKey: queryKeys.company.mine(),
    queryFn: () => getMyCompany(),
    enabled: status === 'signedIn',
    staleTime: 5 * 60_000,
    // A recruiter who has signed up but not registered yet has no record, and
    // the 404 that produces is an answer rather than a failure to retry.
    retry: false,
  })
}

export function useUpdateCompany() {
  const queryClient = useQueryClient()
  const companyId = useCompanyId()
  return useMutation({
    mutationFn: (changes: Parameters<typeof updateCompany>[1]) =>
      updateCompany(companyId ?? '', changes),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.company.mine() }),
  })
}

export function useMyPostings() {
  const { status } = useAuth()
  return useQuery({
    queryKey: queryKeys.company.postings(),
    queryFn: () => listMyJobs(),
    enabled: status === 'signedIn',
    staleTime: 30_000,
  })
}

export function useMyPosting(jobId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.company.posting(jobId ?? ''),
    queryFn: () => getMyJob(jobId as string),
    enabled: Boolean(jobId),
    staleTime: 30_000,
  })
}

export function useCreatePosting() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (draft: PostingDraft) => createJob(draft),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.company.postings() }),
  })
}

export function useUpdatePosting(jobId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (changes: Partial<PostingDraft> & { postingStatus?: JobSummary['postingStatus'] }) =>
      updateJob(jobId, changes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.company.postings() })
      queryClient.invalidateQueries({ queryKey: queryKeys.company.posting(jobId) })
      // The public listing shows this posting too once it is published.
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
    },
  })
}

export function usePipeline(jobId: string | undefined, status?: ApplicationStatus) {
  return useQuery({
    queryKey: queryKeys.company.pipeline(jobId ?? '', status),
    queryFn: () => listJobApplications(jobId as string, status),
    enabled: Boolean(jobId),
    staleTime: 15_000,
  })
}

export function useBulkStatus(jobId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (params: { applicationIds: string[]; status: ApplicationStatus; note?: string }) =>
      bulkUpdateStatus(jobId, params),
    // Invalidated whether or not every row moved: a run that refused some and
    // updated others still changed the board.
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['company', 'pipeline', jobId] })
      queryClient.invalidateQueries({ queryKey: ['company', 'analytics'] })
    },
  })
}

export function useJobAnalytics(jobId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.company.jobAnalytics(jobId ?? ''),
    queryFn: () => getJobAnalytics(jobId as string),
    enabled: Boolean(jobId),
    staleTime: 60_000,
  })
}

export function useCompanyAnalytics() {
  const companyId = useCompanyId()
  return useQuery({
    queryKey: queryKeys.company.analytics(companyId ?? ''),
    queryFn: () => getCompanyAnalytics(companyId as string),
    enabled: Boolean(companyId),
    staleTime: 60_000,
  })
}

export function useCompanyInterviews(window: { from?: string; to?: string } = {}) {
  const companyId = useCompanyId()
  return useQuery({
    queryKey: queryKeys.company.interviews(companyId ?? '', window.from, window.to),
    queryFn: () => listCompanyInterviews(companyId as string, window),
    enabled: Boolean(companyId),
    staleTime: 30_000,
  })
}

export function useExportPipeline() {
  const companyId = useCompanyId()
  return useMutation({
    mutationFn: (params: { jobId?: string } = {}) => exportPipeline(companyId ?? '', params),
  })
}
