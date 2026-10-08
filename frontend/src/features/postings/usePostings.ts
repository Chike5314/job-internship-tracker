import { useQuery } from '@tanstack/react-query'
import { ApiError } from '@/api/errors'
import { getAppliedJob, getJob, listJobs, type PostingFilters } from '@/api/jobs'
import { queryKeys } from '@/api/queryKeys'
import { useAuth } from '@/auth/AuthProvider'

export function usePostingsList(filters: PostingFilters) {
  return useQuery({
    queryKey: queryKeys.jobs.list(filters),
    queryFn: () => listJobs(filters),
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  })
}

/**
 * The unfiltered listing IS the facet source, so this shares the same
 * query key as usePostingsList({}) and costs nothing extra on the first
 * load of the browse page.
 */
export function useLocationFacets() {
  const { data } = useQuery({
    queryKey: queryKeys.jobs.list({}),
    queryFn: () => listJobs({}),
    staleTime: 60_000,
  })

  const cities = new Set<string>()
  const countries = new Set<string>()
  for (const job of data?.jobs ?? []) {
    if (job.city) cities.add(job.city)
    if (job.country) countries.add(job.country)
  }
  return {
    cities: Array.from(cities).sort(),
    countries: Array.from(countries).sort(),
  }
}

/**
 * One posting. The public route answers 403 once a posting has closed or
 * expired, and it can never see who is asking. A signed in applicant who
 * applied to it is then asked for it again through GET /jobs/{id}/applied,
 * which checks exactly that; anyone else keeps the original 403.
 */
export function usePosting(jobId: string) {
  const { status } = useAuth()
  const signedIn = status === 'signedIn'
  return useQuery({
    queryKey: [...queryKeys.jobs.detail(jobId), signedIn],
    queryFn: async () => {
      try {
        return await getJob(jobId)
      } catch (error) {
        if (!signedIn || !(error instanceof ApiError) || error.status !== 403) throw error
        try {
          return await getAppliedJob(jobId)
        } catch {
          throw error
        }
      }
    },
    staleTime: 5 * 60_000,
  })
}
