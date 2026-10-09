import { useState } from 'react'
import type { PostingDraft } from '@/api/company'
import { EXPERIENCE_LEVEL_LABEL, type ExperienceLevel } from '@/api/enums'
import { Icon } from '@/ui/Icon'
import { Input } from '@/ui/Input'
import { Select } from '@/ui/Select'
import { Textarea } from '@/ui/Textarea'
import { formatDayMonthYear } from '@/lib/formatDate'
import { formatSalary } from '@/lib/formatSalary'
import { MAX_DETAILS, MAX_SKILLS, dayValue } from './postingDraft'
import stepStyles from './EditorStep.module.css'
import styles from './DetailsStep.module.css'

type Salary = NonNullable<PostingDraft['salary']>

const START_MONTHS = 12

/**
 * Start dates on offer: the first Monday of each coming month, which is when
 * a new starter usually begins, with a date already set kept in the list.
 */
function startOptions(today: Date, current?: string): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = []
  for (let ahead = 1; ahead <= START_MONTHS; ahead += 1) {
    const first = new Date(today.getFullYear(), today.getMonth() + ahead, 1, 12)
    const monday = new Date(first)
    monday.setDate(1 + ((8 - first.getDay()) % 7))
    options.push({ value: dayValue(monday), label: formatDayMonthYear(monday) })
  }
  if (current) {
    const at = new Date(current)
    if (!options.some((option) => option.value === dayValue(at))) {
      options.unshift({ value: dayValue(at), label: formatDayMonthYear(at) })
    }
  }
  return options
}

/** Digits only, so "60,000" and "60 000" both read as sixty thousand. */
function amount(text: string): number | undefined {
  const digits = text.replace(/[^0-9]/g, '')
  return digits ? Number(digits) : undefined
}

/** Step 2: salary, level, start, skills, what the role is, and anything else. */
export function DetailsStep({
  draft,
  onChange,
  showErrors,
}: {
  draft: PostingDraft
  onChange: (changes: Partial<PostingDraft>) => void
  showErrors: boolean
}) {
  const [today] = useState(() => new Date())
  const [skill, setSkill] = useState('')
  const salary: Salary = draft.salary ?? { disclosed: false }
  const skills = draft.skills ?? []
  const details = draft.additionalDetails ?? []
  const shown = salary.disclosed ? formatSalary(salary, { compact: true }) : ''
  const salaryProblem =
    showErrors && salary.disclosed
      ? salary.min == null && salary.max == null
        ? 'Add a figure, or untick Show salary to applicants.'
        : salary.min != null && salary.max != null && salary.min > salary.max
          ? 'The first figure is above the second.'
          : ''
      : ''
  const describedMissing = showErrors && !draft.description.trim()
  function setSalary(changes: Partial<Salary>) {
    onChange({ salary: { currency: 'XAF', period: 'MONTH', ...salary, ...changes } })
  }

  function addSkill() {
    const name = skill.trim()
    if (!name || skills.length >= MAX_SKILLS) return
    if (!skills.some((other) => other.toLowerCase() === name.toLowerCase())) {
      onChange({ skills: [...skills, name] })
    }
    setSkill('')
  }

  function setDetail(index: number, changes: Partial<{ label: string; value: string }>) {
    onChange({
      additionalDetails: details.map((detail, position) => (position === index ? { ...detail, ...changes } : detail)),
    })
  }

  return (
    <div className={stepStyles.step}>
      <div className={stepStyles.intro}>
        <h1 className={stepStyles.heading}>Details</h1>
        <p className={stepStyles.lede}>
          Only a few lines about the role are needed. Applicants filter on salary, level and city, so filled-in
          postings get found.
        </p>
      </div>

      <section className={['glass-soft', stepStyles.card, styles.salaryCard].join(' ')} aria-labelledby="salary-title">
        <div className={styles.cardHead}>
          <h2 id="salary-title" className={styles.cardTitle}>
            Salary
          </h2>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={salary.disclosed}
              onChange={(event) => setSalary({ disclosed: event.target.checked })}
              className={styles.checkbox}
            />
            Show salary to applicants
          </label>
        </div>
        <div className={styles.salaryRow}>
          <label className={stepStyles.field}>
            <span className={styles.smallLabel}>From</span>
            <Input
              inputMode="numeric"
              value={salary.min ?? ''}
              onChange={(event) => setSalary({ min: amount(event.target.value) })}
              placeholder="60000"
              disabled={!salary.disclosed}
              className={stepStyles.input}
              aria-invalid={salaryProblem ? true : undefined}
            />
          </label>
          <label className={stepStyles.field}>
            <span className={styles.smallLabel}>To (optional)</span>
            <Input
              inputMode="numeric"
              value={salary.max ?? ''}
              onChange={(event) => setSalary({ max: amount(event.target.value) })}
              placeholder="80000"
              disabled={!salary.disclosed}
              className={stepStyles.input}
            />
          </label>
          <label className={stepStyles.field}>
            <span className={styles.smallLabel}>Currency</span>
            <Select
              value={salary.currency ?? 'XAF'}
              onChange={(event) => setSalary({ currency: event.target.value })}
              options={['XAF', 'EUR', 'USD'].map((code) => ({ value: code, label: code }))}
              disabled={!salary.disclosed}
              className={stepStyles.input}
            />
          </label>
          <label className={stepStyles.field}>
            <span className={styles.smallLabel}>Per</span>
            <Select
              value={salary.period ?? 'MONTH'}
              onChange={(event) => setSalary({ period: event.target.value as Salary['period'] })}
              options={[
                { value: 'MONTH', label: 'Month' },
                { value: 'YEAR', label: 'Year' },
                // An hourly rate set before stays choosable.
                ...(salary.period === 'HOUR' ? [{ value: 'HOUR', label: 'Hour' }] : []),
              ]}
              disabled={!salary.disclosed}
              className={stepStyles.input}
            />
          </label>
        </div>
        {salaryProblem ? (
          <span className={stepStyles.error}>{salaryProblem}</span>
        ) : (
          <span className={stepStyles.hint}>
            {salary.disclosed
              ? shown
                ? `Applicants see ${shown} and can filter on it.`
                : 'Applicants see the figure you enter and can filter on it.'
              : 'Hidden from applicants. They see "Salary not disclosed" instead.'}
          </span>
        )}
      </section>

      <section className={['glass-soft', stepStyles.card, styles.roleCard].join(' ')} aria-label="The role">
        <fieldset className={stepStyles.group}>
          <legend className={stepStyles.label}>Experience level</legend>
          <div className={stepStyles.segments}>
            {(Object.keys(EXPERIENCE_LEVEL_LABEL) as ExperienceLevel[]).map((level) => (
              <label
                key={level}
                className={[stepStyles.segment, draft.experienceLevel === level ? stepStyles.segmentOn : ''].join(' ')}
              >
                <input
                  type="radio"
                  name="experienceLevel"
                  value={level}
                  checked={draft.experienceLevel === level}
                  onChange={() => onChange({ experienceLevel: level })}
                  className={stepStyles.hiddenInput}
                />
                {EXPERIENCE_LEVEL_LABEL[level]}
              </label>
            ))}
          </div>
        </fieldset>

        <label className={stepStyles.field}>
          <span className={stepStyles.label}>Start date</span>
          <Select
            value={draft.startDate ? dayValue(new Date(draft.startDate)) : ''}
            onChange={(event) => {
              const value = event.target.value
              if (!value) {
                onChange({ startDate: undefined })
                return
              }
              const [year, month, day] = value.split('-').map(Number)
              onChange({ startDate: new Date(year!, month! - 1, day!, 12).toISOString() })
            }}
            placeholder="Flexible"
            options={startOptions(today, draft.startDate)}
            className={[stepStyles.input, stepStyles.deadline].join(' ')}
          />
        </label>

        <div className={stepStyles.group} role="group" aria-labelledby="skills-label">
          <span id="skills-label" className={stepStyles.label}>
            Skills
          </span>
          <div className={styles.skills}>
            {skills.map((name) => (
              <span key={name} className={styles.skill}>
                {name}
                <button
                  type="button"
                  className={styles.skillRemove}
                  onClick={() => onChange({ skills: skills.filter((other) => other !== name) })}
                  aria-label={`Remove ${name}`}
                >
                  <Icon name="close" size={12} />
                </button>
              </span>
            ))}
            {skills.length < MAX_SKILLS && (
              <span className={styles.adder}>
                <input
                  type="text"
                  value={skill}
                  onChange={(event) => setSkill(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') return
                    event.preventDefault()
                    addSkill()
                  }}
                  placeholder="Add a skill"
                  aria-label="Add a skill"
                  maxLength={60}
                  className={styles.skillInput}
                />
                <button type="button" className={styles.textButton} onClick={addSkill}>
                  Add
                </button>
              </span>
            )}
          </div>
        </div>

        <label className={stepStyles.field}>
          <span className={styles.labelRow}>
            <span className={stepStyles.label}>About the role</span>
            <span className={stepStyles.hint}>Needed before saving</span>
          </span>
          <Textarea
            value={draft.description}
            onChange={(event) => onChange({ description: event.target.value })}
            rows={4}
            maxLength={20000}
            placeholder="What the person will do, and who they will work with"
            className={styles.about}
            aria-invalid={describedMissing ? true : undefined}
            aria-describedby={describedMissing ? 'about-error' : undefined}
          />
          {describedMissing && (
            <span id="about-error" className={stepStyles.error}>
              Say a few lines about the role.
            </span>
          )}
        </label>
      </section>

      <section className={['glass-soft', stepStyles.card, styles.extrasCard].join(' ')} aria-labelledby="extras-title">
        <div>
          <h2 id="extras-title" className={styles.cardTitle}>
            Anything else applicants should know
          </h2>
          <p className={styles.cardNote}>Shown on the posting. Applicants can't filter on these.</p>
        </div>

        {details.map((detail, index) => {
          const half = showErrors && !detail.label.trim() !== !detail.value.trim()
          return (
            <div key={index} className={styles.detail}>
              <Input
                value={detail.label}
                onChange={(event) => setDetail(index, { label: event.target.value })}
                placeholder="Label"
                aria-label="Detail name"
                maxLength={80}
                className={styles.detailInput}
                aria-invalid={half && !detail.label.trim() ? true : undefined}
              />
              <Input
                value={detail.value}
                onChange={(event) => setDetail(index, { value: event.target.value })}
                placeholder="Value"
                aria-label="Detail value"
                maxLength={500}
                className={styles.detailInput}
                aria-invalid={half && !detail.value.trim() ? true : undefined}
              />
              <button
                type="button"
                className={styles.remove}
                onClick={() => onChange({ additionalDetails: details.filter((_, position) => position !== index) })}
                aria-label={`Remove ${detail.label.trim() || 'this detail'}`}
              >
                <Icon name="close" size={16} />
              </button>
            </div>
          )
        })}

        {details.length < MAX_DETAILS && (
          <button
            type="button"
            className={styles.addDetail}
            onClick={() => onChange({ additionalDetails: [...details, { label: '', value: '' }] })}
          >
            <Icon name="add" size={16} />
            Add a detail
          </button>
        )}
      </section>
    </div>
  )
}
