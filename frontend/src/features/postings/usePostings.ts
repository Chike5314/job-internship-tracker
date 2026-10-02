import { useQuery } from '@tanstack/react-query'
import { getJob, listJobs, type PostingFilters } from '@/api/jobs'
import { queryKeys } from '@/api/queryKeys'

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

export function usePosting(jobId: string) {
  return useQuery({
    queryKey: queryKeys.jobs.detail(jobId),
    queryFn: () => getJob(jobId),
    staleTime: 5 * 60_000,
  })
}
