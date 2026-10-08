import { useState } from 'react'
import type { PostingDraft } from '@/api/company'
import {
  OPPORTUNITY_TYPE_LABEL,
  WORK_MODALITY_LABEL,
  type OpportunityType,
  type WorkModality,
} from '@/api/enums'
import { Input } from '@/ui/Input'
import { Select } from '@/ui/Select'
import { formatWeekdayDayMonthYear } from '@/lib/formatDate'
import { TYPE_DESCRIPTION, dayValue, endOfDay } from './postingDraft'
import styles from './EditorStep.module.css'

/** How far ahead the deadline list reaches. */
const DEADLINE_DAYS = 90
const MAX_OPENINGS = 1000

const dayLabel = formatWeekdayDayMonthYear

function deadlineOptions(today: Date, current?: string): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = []
  for (let offset = 0; offset <= DEADLINE_DAYS; offset += 1) {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset)
    options.push({ value: dayValue(day), label: offset === 0 ? `${dayLabel(day)} (today)` : dayLabel(day) })
  }
  // A deadline already set outside the list stays choosable, so opening an
  // older posting never quietly changes it.
  if (current) {
    const at = new Date(current)
    if (!options.some((option) => option.value === dayValue(at))) {
      const passed = at.getTime() < today.getTime()
      options.unshift({ value: dayValue(at), label: passed ? `${dayLabel(at)} (passed)` : dayLabel(at) })
    }
  }
  return options
}

/**
 * Step 1: what the role is and where it happens. Errors show once a save or a
 * publish has been tried, never while the recruiter is still typing.
 */
export function BasicsStep({
  draft,
  onChange,
  onTypeChange,
  typeLocked,
  showSaveErrors,
  showPublishErrors,
}: {
  draft: PostingDraft
  onChange: (changes: Partial<PostingDraft>) => void
  onTypeChange: (type: OpportunityType) => void
  /** The API keeps the type a posting was created with. */
  typeLocked: boolean
  showSaveErrors: boolean
  showPublishErrors: boolean
}) {
  const [today] = useState(() => new Date())
  const remote = draft.workModality === 'REMOTE'
  const titleMissing = (showSaveErrors || showPublishErrors) && !draft.title.trim()
  const cityMissing = showPublishErrors && !remote && !draft.city?.trim()
  const deadlinePassed =
    Boolean(draft.applicationDeadline) && new Date(draft.applicationDeadline!).getTime() <= today.getTime()
  const deadlineMissing = showPublishErrors && (!draft.applicationDeadline || deadlinePassed)
  const openings = draft.openings ?? 1

  return (
    <div className={styles.step}>
      <div className={styles.intro}>
        <h1 className={styles.heading}>The basics</h1>
        <p className={styles.lede}>What the role is and where it happens.</p>
      </div>

      <section className={['glass-soft', styles.card].join(' ')} aria-label="The basics">
        <label className={styles.field}>
          <span className={styles.label}>Posting title</span>
          <Input
            value={draft.title}
            onChange={(event) => onChange({ title: event.target.value })}
            placeholder="For example, Network Support Trainee"
            maxLength={200}
            className={[styles.input, styles.inputTall].join(' ')}
            aria-invalid={titleMissing ? true : undefined}
            aria-describedby={titleMissing ? 'title-error' : undefined}
          />
          {titleMissing && (
            <span id="title-error" className={styles.error}>
              Give the posting a title.
            </span>
          )}
        </label>

        <fieldset className={styles.group}>
          <legend className={styles.label}>Opportunity type</legend>
          <div className={styles.types}>
            {(Object.keys(OPPORTUNITY_TYPE_LABEL) as OpportunityType[]).map((type) => {
              const on = draft.opportunityType === type
              return (
                <label
                  key={type}
                  className={[styles.type, on ? styles.typeOn : '', typeLocked && !on ? styles.typeOff : ''].join(' ')}
                >
                  <input
                    type="radio"
                    name="opportunityType"
                    value={type}
                    checked={on}
                    disabled={typeLocked && !on}
                    onChange={() => onTypeChange(type)}
                    className={styles.hiddenInput}
                  />
                  <span className={styles.typeLabel}>{OPPORTUNITY_TYPE_LABEL[type]}</span>
                  <span className={styles.typeDesc}>{TYPE_DESCRIPTION[type]}</span>
                </label>
              )
            })}
          </div>
          <span className={styles.hint}>
            {typeLocked
              ? 'The type stays as it was when the posting was first saved. For a different type, start a new posting.'
              : 'The type sets the starting list of documents applicants are asked for. You can change that list in step 3.'}
          </span>
        </fieldset>

        <fieldset className={styles.group}>
          <legend className={styles.label}>Where the work happens</legend>
          <div className={styles.segments}>
            {(Object.keys(WORK_MODALITY_LABEL) as WorkModality[]).map((modality) => (
              <label
                key={modality}
                className={[styles.segment, draft.workModality === modality ? styles.segmentOn : ''].join(' ')}
              >
                <input
                  type="radio"
                  name="workModality"
                  value={modality}
                  checked={draft.workModality === modality}
                  onChange={() => onChange({ workModality: modality })}
                  className={styles.hiddenInput}
                />
                {WORK_MODALITY_LABEL[modality]}
              </label>
            ))}
          </div>
        </fieldset>

        <div className={styles.placeRow}>
          <label className={styles.field}>
            <span className={styles.label}>City</span>
            <Input
              value={draft.city ?? ''}
              onChange={(event) => onChange({ city: event.target.value })}
              placeholder="Douala"
              maxLength={120}
              className={styles.input}
              aria-invalid={cityMissing ? true : undefined}
              aria-describedby={cityMissing ? 'city-error' : undefined}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Country</span>
            <Input
              value={draft.country ?? ''}
              onChange={(event) => onChange({ country: event.target.value })}
              placeholder="Cameroon"
              maxLength={120}
              className={styles.input}
            />
          </label>
          <div className={styles.field} role="group" aria-labelledby="openings-label">
            <span id="openings-label" className={styles.label}>
              Openings
            </span>
            <div className={styles.stepper}>
              <button
                type="button"
                className={styles.stepperButton}
                onClick={() => onChange({ openings: Math.max(1, openings - 1) })}
                disabled={openings <= 1}
                aria-label="Fewer openings"
              >
                −
              </button>
              <span className={styles.stepperValue} aria-live="polite">
                {openings}
              </span>
              <button
                type="button"
                className={styles.stepperButton}
                onClick={() => onChange({ openings: Math.min(MAX_OPENINGS, openings + 1) })}
                disabled={openings >= MAX_OPENINGS}
                aria-label="More openings"
              >
                +
              </button>
            </div>
          </div>
        </div>
        {cityMissing && (
          <span id="city-error" className={[styles.error, styles.pullUp].join(' ')}>
            Add a city. Applicants filter by it, and onsite or hybrid postings show your office on the map.
          </span>
        )}

        <label className={styles.field}>
          <span className={styles.label}>Application deadline</span>
          <Select
            value={draft.applicationDeadline ? dayValue(new Date(draft.applicationDeadline)) : ''}
            onChange={(event) =>
              onChange({ applicationDeadline: event.target.value ? endOfDay(event.target.value) : undefined })
            }
            placeholder="Not set"
            options={deadlineOptions(today, draft.applicationDeadline)}
            className={[styles.input, styles.deadline].join(' ')}
            aria-invalid={deadlineMissing ? true : undefined}
            aria-describedby="deadline-hint"
          />
          <span id="deadline-hint" className={deadlineMissing ? styles.errorHint : styles.hint}>
            {deadlineMissing
              ? deadlinePassed
                ? 'That day has passed. Choose a later one before publishing.'
                : 'Choose a deadline before publishing.'
              : 'The posting closes itself at the end of this day. Anyone who already applied can still see it.'}
          </span>
        </label>
      </section>
    </div>
  )
}
