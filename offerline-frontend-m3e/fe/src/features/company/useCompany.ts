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
import {
  changeApplicationStatus,
  getApplicationForRecruiter,
  rescheduleInterview,
  scheduleInterview,
} from '@/api/applications'
import { queryKeys } from '@/api/queryKeys'
import { useAuth } from '@/auth/AuthProvider'
import type { ApplicationStatus, InterviewMode } from '@/api/enums'
import type { JobSummary, RecruiterApplication } from '@/api/types'

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

/**
 * Saves the editor's draft, and publishes it when asked. A new posting is
 * created first, since the API only ever creates drafts. An expired posting
 * goes back through Closed, the one way the API lets it be published again.
 *
 * Publishing can fail after the save has landed, most often because the
 * company is not verified yet. That comes back as `publishError` beside the
 * saved posting rather than as a failure, so the editor still moves to the
 * posting that now exists and a retry cannot create a second one.
 */
export function useSavePosting() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      jobId,
      draft,
      publish,
    }: {
      jobId?: string
      draft: PostingDraft
      publish: boolean
    }): Promise<{ job: JobSummary; publishError?: unknown }> => {
      let job = jobId ? (await updateJob(jobId, draft)).job : (await createJob(draft)).job
      if (!publish) return { job }
      try {
        if (job.postingStatus === 'EXPIRED') job = (await updateJob(job.jobId, { postingStatus: 'CLOSED' })).job
        job = (await updateJob(job.jobId, { postingStatus: 'PUBLISHED' })).job
        return { job }
      } catch (publishError) {
        return { job, publishError }
      }
    },
    onSuccess: ({ job }) => {
      queryClient.setQueryData(queryKeys.company.posting(job.jobId), { job })
      queryClient.invalidateQueries({ queryKey: queryKeys.company.postings() })
      queryClient.invalidateQueries({ queryKey: ['company', 'analytics'] })
      // The public listing shows it too once it is published.
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

/**
 * One application, as the company reads it. The first read of a SUBMITTED
 * application is what moves it to UNDER_REVIEW, so this read is an action: it
 * runs when the drawer opens and never as a retry nobody asked for. Reads
 * after that one move nothing.
 */
export function useRecruiterApplication(applicationId: string | undefined, jobId: string) {
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: queryKeys.company.application(applicationId ?? ''),
    queryFn: async () => {
      const result = await getApplicationForRecruiter(applicationId as string)
      // The board still shows it as New until it is told otherwise.
      queryClient.invalidateQueries({ queryKey: ['company', 'pipeline', jobId] })
      return result
    },
    enabled: Boolean(applicationId),
    retry: false,
  })
}

export interface InterviewSlot {
  scheduledAt: string
  mode: InterviewMode
  durationMinutes: number
  locationOrLink: string
}

/**
 * Every change made from the drawer: a status move, a new interview, or a new
 * time for one that still stands. Each refreshes the application it touched
 * and the board it sits on.
 */
export function useRecruiterActions(applicationId: string, jobId: string) {
  const queryClient = useQueryClient()
  const key = queryKeys.company.application(applicationId)

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ['company', 'pipeline', jobId] })
    queryClient.invalidateQueries({ queryKey: ['company', 'analytics'] })
    queryClient.invalidateQueries({ queryKey: ['company', 'interviews'] })
  }

  const move = useMutation({
    mutationFn: (params: { status: ApplicationStatus; note?: string }) =>
      changeApplicationStatus(applicationId, params),
    onSuccess: ({ application }) => {
      queryClient.setQueryData<{ application: RecruiterApplication }>(key, (current) =>
        current
          ? {
              application: {
                ...current.application,
                status: application.status as ApplicationStatus,
                statusHistory: application.statusHistory,
              },
            }
          : current,
      )
      refresh()
    },
  })

  // The application is past SUBMITTED by now, so reading it again moves nothing.
  const reread = () => queryClient.invalidateQueries({ queryKey: key })

  const schedule = useMutation({
    mutationFn: (slot: InterviewSlot) => scheduleInterview(applicationId, slot),
    onSuccess: () => {
      void reread()
      refresh()
    },
  })

  const reschedule = useMutation({
    mutationFn: (slot: InterviewSlot) => rescheduleInterview(applicationId, slot),
    onSuccess: () => {
      void reread()
      refresh()
    },
  })

  return { move, schedule, reschedule }
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
