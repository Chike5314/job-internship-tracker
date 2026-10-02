import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { PostingDraft } from '@/api/company'
import {
  EXPERIENCE_LEVEL_LABEL,
  OPPORTUNITY_TYPE_LABEL,
  WORK_MODALITY_LABEL,
  type ExperienceLevel,
  type OpportunityType,
  type WorkModality,
} from '@/api/enums'
import type { DocumentRequirement } from '@/api/types'
import { BackLink } from '@/ui/BackLink'
import { Button } from '@/ui/Button'
import { Checkbox } from '@/ui/Checkbox'
import { ErrorSummary } from '@/ui/ErrorSummary'
import { Field } from '@/ui/Field'
import { Icon } from '@/ui/Icon'
import { Input } from '@/ui/Input'
import { Select } from '@/ui/Select'
import { Skeleton } from '@/ui/Skeleton'
import { Textarea } from '@/ui/Textarea'
import { useToast } from '@/ui/ToastProvider'
import { useCreatePosting, useMyPosting, useUpdatePosting } from './useCompany'
import { DEFAULT_DOCUMENTS, draftFromJob, emptyDraft, isLocked } from './postingDraft'
import styles from './PostingEditorPage.module.css'

const TYPE_DESCRIPTION: Record<OpportunityType, string> = {
  FULL_TIME_JOB: 'For job seekers and working professionals.',
  PROFESSIONAL_INTERNSHIP: 'For students, recent graduates and career changers.',
  ACADEMIC_INTERNSHIP: 'For students enrolled at a university or college.',
}

const STEPS = ['The basics', 'Details', 'What applicants send']

export function PostingEditorPage() {
  const { jobId } = useParams<{ jobId: string }>()
  const existing = useMyPosting(jobId)
  const create = useCreatePosting()
  const update = useUpdatePosting(jobId ?? '')
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState<PostingDraft>(emptyDraft)
  const [typeChanged, setTypeChanged] = useState(false)
  const [errors, setErrors] = useState<{ fieldId: string; message: string }[]>([])
  const [skill, setSkill] = useState('')

  const job = existing.data?.job
  const isNew = !jobId

  useEffect(() => {
    if (job) setDraft(draftFromJob(job))
  }, [job])

  function set<K extends keyof PostingDraft>(key: K, value: PostingDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  /** Changing the type resets the document list to that type's usual set, and
   *  says so, because silently discarding an edited list would be worse. */
  function changeType(next: OpportunityType) {
    setDraft((current) => ({
      ...current,
      opportunityType: next,
      documentRequirements: DEFAULT_DOCUMENTS[next],
    }))
    setTypeChanged(true)
  }

  function validate(): boolean {
    const found: { fieldId: string; message: string }[] = []
    if (!draft.title.trim()) found.push({ fieldId: 'title', message: 'Give the posting a title.' })
    if (!draft.description.trim())
      found.push({ fieldId: 'description', message: 'Say what the role is.' })
    setErrors(found)
    return found.length === 0
  }

  async function save(publish: boolean) {
    if (!validate()) {
      setStep(0)
      return
    }
    const body = publish ? { ...draft, postingStatus: 'PUBLISHED' as const } : draft
    if (isNew) {
      const result = await create.mutateAsync(draft)
      if (publish) {
        showToast('Saved as a draft. Publish it from the postings list once you are ready.')
      } else {
        showToast('Draft saved.')
      }
      navigate(`/company/postings/${result.job.jobId}/edit`, { replace: true })
      return
    }
    await update.mutateAsync(body)
    showToast(publish ? 'Posting published.' : 'Draft saved.')
    if (publish) navigate(`/company/postings/${jobId}/pipeline`)
  }

  if (jobId && existing.isPending) {
    return (
      <div className={styles.page}>
        <Skeleton height={400} />
      </div>
    )
  }

  const saving = create.isPending || update.isPending
  const published = job?.postingStatus === 'PUBLISHED'

  return (
    <div className={styles.page}>
      <BackLink to="/company/postings">Postings</BackLink>

      <header className={styles.head}>
        <div>
          <h1 className="t-display-md">{draft.title || 'New posting'}</h1>
          <p className={['t-body-sm', styles.muted].join(' ')}>
            {isNew
              ? 'Drafts are saved to your company and only you can see them. Nothing reaches applicants until you publish.'
              : published
                ? 'This posting is live. Changes reach applicants as soon as you save.'
                : 'A draft. Nothing reaches applicants until you publish.'}
          </p>
        </div>
        <div className={styles.headActions}>
          <Button variant="secondary" loading={saving} onClick={() => void save(false)}>
            Save draft
          </Button>
          {!published && (
            <Button variant="primary" loading={saving} onClick={() => void save(true)}>
              Publish
            </Button>
          )}
        </div>
      </header>

      <ol className={styles.steps}>
        {STEPS.map((label, index) => (
          <li key={label}>
            <button
              type="button"
              className={[styles.step, step === index ? styles.stepActive : ''].join(' ')}
              onClick={() => setStep(index)}
              aria-current={step === index ? 'step' : undefined}
            >
              <span className={styles.stepMark}>{index + 1}</span>
              {label}
            </button>
          </li>
        ))}
      </ol>

      {errors.length > 0 && <ErrorSummary heading="Fix these before publishing" items={errors} />}

      {step === 0 && (
        <section className={styles.panel}>
          <h2 className="t-heading-lg">The basics</h2>
          <p className={['t-body-sm', styles.muted].join(' ')}>
            What the role is and where it happens.
          </p>

          <Field label="Posting title" id="title" required>
            {(props) => (
              <Input
                {...props}
                value={draft.title}
                onChange={(event) => set('title', event.target.value)}
                placeholder="Backend Engineer"
              />
            )}
          </Field>

          <fieldset className={styles.fieldset}>
            <legend className="t-body-sm">Opportunity type</legend>
            <p className={['t-caption', styles.muted].join(' ')}>
              The type sets the starting list of documents applicants are asked for. You can change
              that list in step 3.
            </p>
            <div className={styles.choices}>
              {(Object.keys(OPPORTUNITY_TYPE_LABEL) as OpportunityType[]).map((type) => (
                <label
                  key={type}
                  className={[
                    styles.choice,
                    draft.opportunityType === type ? styles.choicePicked : '',
                  ].join(' ')}
                >
                  <input
                    type="radio"
                    name="opportunityType"
                    value={type}
                    checked={draft.opportunityType === type}
                    onChange={() => changeType(type)}
                  />
                  <span>
                    <span className="t-body">{OPPORTUNITY_TYPE_LABEL[type]}</span>
                    <span className={['t-caption', styles.muted].join(' ')}>
                      {TYPE_DESCRIPTION[type]}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className={styles.fieldset}>
            <legend className="t-body-sm">Where the work happens</legend>
            <div className={styles.inline}>
              {(Object.keys(WORK_MODALITY_LABEL) as WorkModality[]).map((modality) => (
                <label
                  key={modality}
                  className={[
                    styles.chip,
                    draft.workModality === modality ? styles.chipPicked : '',
                  ].join(' ')}
                >
                  <input
                    type="radio"
                    name="workModality"
                    value={modality}
                    checked={draft.workModality === modality}
                    onChange={() => set('workModality', modality)}
                  />
                  {WORK_MODALITY_LABEL[modality]}
                </label>
              ))}
            </div>
          </fieldset>

          <div className={styles.row}>
            <Field label="City" help="Applicants filter by it">
              {(props) => (
                <Input
                  {...props}
                  value={draft.city ?? ''}
                  onChange={(event) => set('city', event.target.value)}
                />
              )}
            </Field>
            <Field label="Country">
              {(props) => (
                <Input
                  {...props}
                  value={draft.country ?? ''}
                  onChange={(event) => set('country', event.target.value)}
                />
              )}
            </Field>
            <Field label="Openings">
              {(props) => (
                <Input
                  {...props}
                  type="number"
                  min={1}
                  value={draft.openings ?? 1}
                  onChange={(event) => set('openings', Number(event.target.value))}
                />
              )}
            </Field>
          </div>

          <Field label="Application deadline" help="Postings close themselves once it passes">
            {(props) => (
              <Input
                {...props}
                type="date"
                value={draft.applicationDeadline?.slice(0, 10) ?? ''}
                onChange={(event) =>
                  set(
                    'applicationDeadline',
                    event.target.value ? new Date(event.target.value).toISOString() : undefined,
                  )
                }
              />
            )}
          </Field>

          <Field label="About the role" id="description" required>
            {(props) => (
              <Textarea
                {...props}
                rows={8}
                value={draft.description}
                onChange={(event) => set('description', event.target.value)}
                placeholder="What the person will do, who they work with, and what the team is building."
              />
            )}
          </Field>
        </section>
      )}

      {step === 1 && (
        <section className={styles.panel}>
          <h2 className="t-heading-lg">Details</h2>
          <p className={['t-body-sm', styles.muted].join(' ')}>
            Optional, but applicants filter on salary, level and city, so filled-in postings get
            found.
          </p>

          <Checkbox
            label="Show salary to applicants"
            checked={draft.salary?.disclosed ?? false}
            onChange={(event) =>
              set('salary', { ...draft.salary, disclosed: event.target.checked })
            }
          />

          {draft.salary?.disclosed && (
            <div className={styles.row}>
              <Field label="From">
                {(props) => (
                  <Input
                    {...props}
                    type="number"
                    min={0}
                    value={draft.salary?.min ?? ''}
                    onChange={(event) =>
                      set('salary', { ...draft.salary!, min: Number(event.target.value) })
                    }
                  />
                )}
              </Field>
              <Field label="To" help="Optional">
                {(props) => (
                  <Input
                    {...props}
                    type="number"
                    min={0}
                    value={draft.salary?.max ?? ''}
                    onChange={(event) =>
                      set('salary', { ...draft.salary!, max: Number(event.target.value) })
                    }
                  />
                )}
              </Field>
              <Field label="Currency">
                {(props) => (
                  <Select
                    {...props}
                    value={draft.salary?.currency ?? 'XAF'}
                    options={[
                      { value: 'XAF', label: 'XAF' },
                      { value: 'EUR', label: 'EUR' },
                      { value: 'USD', label: 'USD' },
                    ]}
                    onChange={(event) =>
                      set('salary', { ...draft.salary!, currency: event.target.value })
                    }
                  />
                )}
              </Field>
              <Field label="Per">
                {(props) => (
                  <Select
                    {...props}
                    value={draft.salary?.period ?? 'MONTH'}
                    options={[
                      { value: 'MONTH', label: 'Month' },
                      { value: 'YEAR', label: 'Year' },
                      { value: 'HOUR', label: 'Hour' },
                    ]}
                    onChange={(event) =>
                      set('salary', {
                        ...draft.salary!,
                        period: event.target.value as 'HOUR' | 'MONTH' | 'YEAR',
                      })
                    }
                  />
                )}
              </Field>
            </div>
          )}

          <div className={styles.row}>
            <Field label="Experience level">
              {(props) => (
                <Select
                  {...props}
                  value={draft.experienceLevel ?? ''}
                  placeholder="Not specified"
                  options={(Object.keys(EXPERIENCE_LEVEL_LABEL) as ExperienceLevel[]).map((level) => ({
                    value: level,
                    label: EXPERIENCE_LEVEL_LABEL[level],
                  }))}
                  onChange={(event) =>
                    set('experienceLevel', (event.target.value || undefined) as ExperienceLevel)
                  }
                />
              )}
            </Field>
            <Field label="Start date" help="Leave empty for flexible">
              {(props) => (
                <Input
                  {...props}
                  type="date"
                  value={draft.startDate?.slice(0, 10) ?? ''}
                  onChange={(event) =>
                    set(
                      'startDate',
                      event.target.value ? new Date(event.target.value).toISOString() : undefined,
                    )
                  }
                />
              )}
            </Field>
            <Field label="Duration" help="Internships only">
              {(props) => (
                <Input
                  {...props}
                  value={draft.duration ?? ''}
                  onChange={(event) => set('duration', event.target.value)}
                  placeholder="6 months"
                />
              )}
            </Field>
          </div>

          <Field label="Skills" help="Press Add after each one">
            {(props) => (
              <div className={styles.skillRow}>
                <Input
                  {...props}
                  value={skill}
                  onChange={(event) => setSkill(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') return
                    event.preventDefault()
                    if (!skill.trim()) return
                    set('skills', [...(draft.skills ?? []), skill.trim()])
                    setSkill('')
                  }}
                  placeholder="Python"
                />
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => {
                    if (!skill.trim()) return
                    set('skills', [...(draft.skills ?? []), skill.trim()])
                    setSkill('')
                  }}
                >
                  Add
                </Button>
              </div>
            )}
          </Field>

          {(draft.skills ?? []).length > 0 && (
            <ul className={styles.skills}>
              {(draft.skills ?? []).map((name, index) => (
                <li key={`${name}-${index}`} className={styles.skill}>
                  {name}
                  <button
                    type="button"
                    aria-label={`Remove ${name}`}
                    onClick={() =>
                      set(
                        'skills',
                        (draft.skills ?? []).filter((_, position) => position !== index),
                      )
                    }
                  >
                    <Icon name="close" size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {step === 2 && (
        <section className={styles.panel}>
          <h2 className="t-heading-lg">What applicants send</h2>
          <p className={['t-body-sm', styles.muted].join(' ')}>
            Started from the usual list for {OPPORTUNITY_TYPE_LABEL[draft.opportunityType].toLowerCase()}.
            Rename, remove or add anything, and choose what is required. The apply form is built from
            this list and nothing else.
          </p>

          {typeChanged && (
            <p className={['t-body-sm', styles.notice].join(' ')}>
              You changed the opportunity type, so this list went back to the usual documents for
              that type.
            </p>
          )}

          <ul className={styles.documents}>
            {(draft.documentRequirements ?? []).map((requirement, index) => (
              <li key={requirement.key} className={styles.document}>
                <Input
                  value={requirement.label}
                  aria-label={`Label for ${requirement.key}`}
                  onChange={(event) => {
                    const next = [...(draft.documentRequirements ?? [])]
                    next[index] = { ...requirement, label: event.target.value }
                    set('documentRequirements', next)
                  }}
                />
                <Select
                  value={requirement.required ? 'required' : 'optional'}
                  aria-label={`Is ${requirement.label} required`}
                  disabled={isLocked(requirement)}
                  options={[
                    { value: 'required', label: 'Required' },
                    { value: 'optional', label: 'Optional' },
                  ]}
                  onChange={(event) => {
                    const next = [...(draft.documentRequirements ?? [])]
                    next[index] = { ...requirement, required: event.target.value === 'required' }
                    set('documentRequirements', next)
                  }}
                />
                <Button
                  variant="quiet"
                  type="button"
                  disabled={isLocked(requirement)}
                  onClick={() =>
                    set(
                      'documentRequirements',
                      (draft.documentRequirements ?? []).filter((_, position) => position !== index),
                    )
                  }
                >
                  <Icon name="delete" size={16} />
                  <span className={styles.srOnly}>Remove {requirement.label}</span>
                </Button>
              </li>
            ))}
          </ul>

          <p className={['t-caption', styles.muted].join(' ')}>
            Every application needs a CV, so it stays on the list. Files an applicant sends are kept
            exactly as sent.
          </p>

          <Button
            variant="secondary"
            type="button"
            onClick={() => {
              const next: DocumentRequirement = {
                key: `custom-${Date.now()}`,
                label: 'New item',
                kind: 'TEXT',
                required: false,
              }
              set('documentRequirements', [...(draft.documentRequirements ?? []), next])
            }}
          >
            <Icon name="add" size={16} />
            Add an item
          </Button>
        </section>
      )}

      <div className={styles.footer}>
        {step > 0 && (
          <Button variant="quiet" onClick={() => setStep(step - 1)}>
            Back
          </Button>
        )}
        {step < STEPS.length - 1 && (
          <Button variant="secondary" onClick={() => setStep(step + 1)}>
            Continue
          </Button>
        )}
      </div>
    </div>
  )
}
