import type { PostingFilters } from './jobs'

// Drops empty values and sorts keys, so two equivalent filter objects
// produce one cache entry.
function normaliseFilters(filters: PostingFilters): Record<string, string | number> {
  const normalised: Record<string, string | number> = {}
  for (const key of Object.keys(filters).sort()) {
    const value = filters[key as keyof PostingFilters]
    if (value !== undefined && value !== null && value !== '') normalised[key] = value
  }
  return normalised
}

export const queryKeys = {
  jobs: {
    // jobs.facets() shares this same key with no filters: the facet
    // source (city/country options) IS the unfiltered listing, so the key
    // collision is the point. The browse page's first load serves both
    // the list and the location filter options from one request.
    list: (filters: PostingFilters = {}) => ['jobs', 'list', normaliseFilters(filters)] as const,
    detail: (jobId: string) => ['jobs', 'detail', jobId] as const,
  },
  applications: {
    all: ['applications'] as const,
    mine: () => ['applications', 'me'] as const,
    detail: (applicationId: string) => ['applications', 'detail', applicationId] as const,
  },
  profile: {
    me: () => ['profile', 'me'] as const,
    cvs: () => ['profile', 'cvs'] as const,
  },
  notifications: {
    list: (unreadOnly: boolean) => ['notifications', 'list', unreadOnly] as const,
  },
  admin: {
    overview: () => ['admin', 'overview'] as const,
    companies: (status: string) => ['admin', 'companies', status] as const,
    companyPostings: (companyId: string) => ['admin', 'company-postings', companyId] as const,
    posting: (jobId: string) => ['admin', 'posting', jobId] as const,
  },
  company: {
    all: ['company'] as const,
    mine: () => ['company', 'mine'] as const,
    postings: () => ['company', 'postings'] as const,
    posting: (jobId: string) => ['company', 'posting', jobId] as const,
    pipeline: (jobId: string, status?: string) =>
      ['company', 'pipeline', jobId, status ?? 'all'] as const,
    application: (applicationId: string) => ['company', 'application', applicationId] as const,
    jobAnalytics: (jobId: string) => ['company', 'analytics', 'job', jobId] as const,
    analytics: (companyId: string) => ['company', 'analytics', companyId] as const,
    interviews: (companyId: string, from?: string, to?: string) =>
      ['company', 'interviews', companyId, from ?? '', to ?? ''] as const,
    applicants: (companyId: string) => ['company', 'applicants', companyId] as const,
  },
}
