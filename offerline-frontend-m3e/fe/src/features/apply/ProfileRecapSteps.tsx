import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Profile } from '@/api/types'
import { DEGREE_LEVEL_LABEL, type DegreeLevel } from '@/api/enums'
import { StepCard } from './StepCard'
import styles from './ProfileRecapSteps.module.css'

function Facts({ items }: { items: { term: string; value?: string }[] }) {
  return (
    <dl className={styles.facts}>
      {items.map((item) => (
        <div key={item.term} className={styles.fact}>
          <dt>{item.term}</dt>
          <dd className={item.value ? undefined : styles.missing}>{item.value || 'Not added yet'}</dd>
        </div>
      ))}
    </dl>
  )
}

/** What the applicant is, read from the profile rather than re-asked here.
 * Editing lives on the profile page, not inline, so the same contact
 * details can't drift between an application and the profile they came
 * from. */
export function YourDetailsStep({ profile, number }: { profile: Profile; number: number }) {
  return (
    <StepCard number={number} title="Your details" description="From your profile.">
      <Facts
        items={[
          { term: 'Full name', value: profile.fullName },
          { term: 'Email', value: profile.email },
          { term: 'Phone', value: profile.phone },
        ]}
      />
      <Link to="/profile" className={styles.link}>
        Change these in your profile
      </Link>
    </StepCard>
  )
}

/** Shown only for academic internships, which are the only postings that
 * ask for a school, a field and a level at all. `children` is the
 * transcript, when the posting asks for one. */
export function YourStudiesStep({
  profile,
  number,
  invalid,
  children,
}: {
  profile: Profile
  number: number
  invalid?: boolean
  children?: ReactNode
}) {
  const academic = profile.academicInfo
  const degree = academic?.degreeLevel
  const degreeLabel = degree ? (DEGREE_LEVEL_LABEL[degree as DegreeLevel] ?? degree) : undefined

  return (
    <StepCard number={number} title="Your studies" description="From your profile." invalid={invalid}>
      <Facts
        items={[
          { term: 'University', value: academic?.schoolName },
          { term: 'Field of study', value: academic?.fieldOfStudy },
          { term: 'Level', value: degreeLabel },
        ]}
      />
      {!(academic?.schoolName && academic.fieldOfStudy && degreeLabel) && (
        <Link to="/profile" className={styles.link}>
          Add your studies to your profile
        </Link>
      )}
      {children}
    </StepCard>
  )
}
