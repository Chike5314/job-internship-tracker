import { useState, type ChangeEvent } from 'react'
import type { PostingFilters as Filters } from '@/api/jobs'
import { EXPERIENCE_LEVEL_LABEL, OPPORTUNITY_TYPE_LABEL, WORK_MODALITY_LABEL } from '@/api/enums'
import type { ExperienceLevel, OpportunityType, WorkModality } from '@/api/enums'
import { Chip } from '@/ui/Chip'
import { Input } from '@/ui/Input'
import { Select } from '@/ui/Select'
import { Button } from '@/ui/Button'
import { useDebouncedValue } from '@/lib/useDebouncedValue'
import { useLocationFacets } from './usePostings'
import styles from './PostingFilters.module.css'

interface PostingFiltersProps {
  filters: Filters
  onChange: (filters: Filters) => void
}

const OPPORTUNITY_TYPES: OpportunityType[] = ['FULL_TIME_JOB', 'PROFESSIONAL_INTERNSHIP', 'ACADEMIC_INTERNSHIP']
const MODALITIES: WorkModality[] = ['ONSITE', 'HYBRID', 'REMOTE']
const EXPERIENCE_LEVELS: ExperienceLevel[] = ['ENTRY', 'MID', 'SENIOR']

export function PostingFilters({ filters, onChange }: PostingFiltersProps) {
  const { cities, countries } = useLocationFacets()
  const [searchInput, setSearchInput] = useState(filters.q ?? '')

  useDebouncedValue(searchInput, 300, (value) => {
    if (value !== (filters.q ?? '')) onChange({ ...filters, q: value || undefined })
  })

  function onSalaryChange(field: 'salaryMin' | 'salaryMax') {
    return (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value ? Number(event.target.value) : undefined
      onChange({ ...filters, [field]: value })
    }
  }

  const hasFilters = Object.values(filters).some((value) => value !== undefined && value !== '')

  return (
    <div className={['glass-dense', styles.panel].join(' ')}>
      <label className="t-body-sm" htmlFor="posting-search">
        Search titles and companies
      </label>
      <Input
        id="posting-search"
        placeholder="e.g. backend, intern"
        value={searchInput}
        onChange={(event) => setSearchInput(event.target.value)}
      />

      <div className={styles.chipRow}>
        <span className="t-caption" style={{ color: 'var(--color-text-subtle)' }}>
          Type
        </span>
        <Chip selected={!filters.type} onClick={() => onChange({ ...filters, type: undefined })}>
          All
        </Chip>
        {OPPORTUNITY_TYPES.map((type) => (
          <Chip key={type} selected={filters.type === type} onClick={() => onChange({ ...filters, type })}>
            {OPPORTUNITY_TYPE_LABEL[type]}
          </Chip>
        ))}
      </div>

      <div className={styles.chipRow}>
        <span className="t-caption" style={{ color: 'var(--color-text-subtle)' }}>
          Modality
        </span>
        <Chip selected={!filters.modality} onClick={() => onChange({ ...filters, modality: undefined })}>
          All
        </Chip>
        {MODALITIES.map((modality) => (
          <Chip
            key={modality}
            selected={filters.modality === modality}
            onClick={() => onChange({ ...filters, modality })}
          >
            {WORK_MODALITY_LABEL[modality]}
          </Chip>
        ))}
      </div>

      <div className={styles.grid}>
        <div>
          <label className="t-caption" htmlFor="posting-experience" style={{ color: 'var(--color-text-subtle)' }}>
            Experience
          </label>
          <Select
            id="posting-experience"
            placeholder="Any"
            value={filters.experience ?? ''}
            onChange={(event) =>
              onChange({ ...filters, experience: (event.target.value || undefined) as ExperienceLevel | undefined })
            }
            options={EXPERIENCE_LEVELS.map((level) => ({ value: level, label: EXPERIENCE_LEVEL_LABEL[level] }))}
          />
        </div>
        <div>
          <label className="t-caption" htmlFor="posting-city" style={{ color: 'var(--color-text-subtle)' }}>
            City
          </label>
          {/* A select, not free text: the backend matches city by exact,
              case-sensitive equality, so a typed value would silently
              return nothing. */}
          <Select
            id="posting-city"
            placeholder="Any"
            value={filters.city ?? ''}
            onChange={(event) => onChange({ ...filters, city: event.target.value || undefined })}
            options={cities.map((city) => ({ value: city, label: city }))}
          />
        </div>
        <div>
          <label className="t-caption" htmlFor="posting-country" style={{ color: 'var(--color-text-subtle)' }}>
            Country
          </label>
          <Select
            id="posting-country"
            placeholder="Any"
            value={filters.country ?? ''}
            onChange={(event) => onChange({ ...filters, country: event.target.value || undefined })}
            options={countries.map((country) => ({ value: country, label: country }))}
          />
        </div>
      </div>

      <div>
        <p className="t-caption" style={{ color: 'var(--color-text-subtle)' }}>
          Postings that state a salary range
        </p>
        <div className={styles.salaryRow}>
          <Input
            type="number"
            placeholder="Min"
            value={filters.salaryMin ?? ''}
            onChange={onSalaryChange('salaryMin')}
          />
          <Input
            type="number"
            placeholder="Max"
            value={filters.salaryMax ?? ''}
            onChange={onSalaryChange('salaryMax')}
          />
        </div>
      </div>

      {hasFilters && (
        <Button variant="quiet" onClick={() => onChange({})}>
          Clear filters
        </Button>
      )}
    </div>
  )
}
