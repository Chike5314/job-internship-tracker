import type { PostingFilters } from '@/api/jobs'
import type { ExperienceLevel, OpportunityType, WorkModality } from '@/api/enums'

const KEYS = ['type', 'modality', 'city', 'country', 'experience', 'salaryMin', 'salaryMax', 'q'] as const

export function fromSearchParams(params: URLSearchParams): PostingFilters {
  const filters: PostingFilters = {}
  const type = params.get('type')
  if (type) filters.type = type as OpportunityType
  const modality = params.get('modality')
  if (modality) filters.modality = modality as WorkModality
  const city = params.get('city')
  if (city) filters.city = city
  const country = params.get('country')
  if (country) filters.country = country
  const experience = params.get('experience')
  if (experience) filters.experience = experience as ExperienceLevel
  const salaryMin = params.get('salaryMin')
  if (salaryMin) filters.salaryMin = Number(salaryMin)
  const salaryMax = params.get('salaryMax')
  if (salaryMax) filters.salaryMax = Number(salaryMax)
  const q = params.get('q')
  if (q) filters.q = q
  return filters
}

export function toSearchParams(filters: PostingFilters): URLSearchParams {
  const params = new URLSearchParams()
  for (const key of KEYS) {
    const value = filters[key]
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  }
  return params
}
