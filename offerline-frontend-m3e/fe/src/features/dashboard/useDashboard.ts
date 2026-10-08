import { useQueries } from '@tanstack/react-query'
import { getApplication } from '@/api/applications'
import { queryKeys } from '@/api/queryKeys'
import type { ApplicationSummary, Interview } from '@/api/types'
import { interviewRound } from '@/lib/interviews'
import { useMyApplications } from '@/features/applications/useApplications'

export type UpcomingInterview = {
  application: ApplicationSummary
  interview: Interview
  /** Which round this is on its application, see `interviewRound`. */
  round: number
}

/**
 * Every interview still ahead of the viewer, soonest first, with the
 * application it belongs to.
 *
 * The list endpoint returns no interview data, so the detail of each
 * application sitting at INTERVIEW_SCHEDULED has to be read to find the times.
 * That set is small by construction: an applicant is at that status on a
 * handful of applications at most, and the queries are cached under the same
 * keys the detail page uses, so opening one afterwards costs nothing.
 */
export function useUpcomingInterviews(): {
  upcoming: UpcomingInterview[]
  next?: UpcomingInterview
  isLoading: boolean
} {
  const { data, isLoading: listLoading } = useMyApplications()
  const scheduled = (data?.applications ?? []).filter((a) => a.status === 'INTERVIEW_SCHEDULED')

  const results = useQueries({
    queries: scheduled.map((application) => ({
      queryKey: queryKeys.applications.detail(application.applicationId),
      queryFn: () => getApplication(application.applicationId),
      staleTime: 30_000,
    })),
  })

  const now = Date.now()
  const upcoming: UpcomingInterview[] = []

  results.forEach((result, index) => {
    const application = scheduled[index]
    if (!result.data || !application) return
    const interviews = result.data.application.interviews
    for (const interview of interviews) {
      // A cancelled or declined time is not something to show as next, and a
      // reschedule leaves the superseded one in the list.
      if (interview.state === 'CANCELLED' || interview.state === 'DECLINED') continue
      if (new Date(interview.scheduledAt).getTime() < now) continue
      upcoming.push({ application, interview, round: interviewRound(interviews, interview) })
    }
  })

  upcoming.sort(
    (a, b) =>
      new Date(a.interview.scheduledAt).getTime() - new Date(b.interview.scheduledAt).getTime(),
  )

  return {
    upcoming,
    next: upcoming[0],
    isLoading: listLoading || results.some((r) => r.isLoading),
  }
}

/** The counts the dashboard opens with, read off the one list it already has. */
export function useApplicationCounts(applications: ApplicationSummary[]) {
  const inProgress = applications.filter(
    (a) => a.status === 'SUBMITTED' || a.status === 'UNDER_REVIEW',
  ).length
  const interviews = applications.filter((a) => a.status === 'INTERVIEW_SCHEDULED').length
  const offers = applications.filter((a) => a.status === 'OFFER_EXTENDED').length

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const thisWeek = applications.filter((a) => new Date(a.appliedAt).getTime() >= weekAgo).length

  return { total: applications.length, inProgress, interviews, offers, thisWeek }
}
