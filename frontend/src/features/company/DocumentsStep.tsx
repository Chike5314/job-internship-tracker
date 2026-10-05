import { useState, type FormEvent } from 'react'
import type { PostingDraft } from '@/api/company'
import { OPPORTUNITY_TYPE_LABEL } from '@/api/enums'
import type { DocumentRequirement } from '@/api/types'
import { Icon } from '@/ui/Icon'
import { Input } from '@/ui/Input'
import { MAX_DOCUMENTS, isDefaultFor, isLocked } from './postingDraft'
import stepStyles from './EditorStep.module.css'
import styles from './DocumentsStep.module.css'

/**
 * Step 3: the list the apply form is built from, and nothing else. Each item
 * can be renamed, made required or optional, or removed, apart from the CV,
 * which every application carries.
 */
export function DocumentsStep({
  draft,
  onChange,
  typeReset,
  showErrors,
}: {
  draft: PostingDraft
  onChange: (changes: Partial<PostingDraft>) => void
  /** The type changed in step 1, which put this list back to its usual set. */
  typeReset: boolean
  showErrors: boolean
}) {
  const [label, setLabel] = useState('')
  const requirements = draft.documentRequirements ?? []
  const typeWords = `${OPPORTUNITY_TYPE_LABEL[draft.opportunityType].toLowerCase()}s`
  const full = requirements.length >= MAX_DOCUMENTS

  function replace(index: number, changes: Partial<DocumentRequirement>) {
    onChange({
      documentRequirements: requirements.map((requirement, position) =>
        position === index ? { ...requirement, ...changes } : requirement,
      ),
    })
  }

  // Something added here is a file to upload, which is what "a document"
  // means to the applicant reading the form.
  function add(event: FormEvent) {
    event.preventDefault()
    const name = label.trim()
    if (!name || full) return
    const key = `custom-${Date.now().toString(36)}`
    onChange({ documentRequirements: [...requirements, { key, label: name, kind: 'FILE', required: false }] })
    setLabel('')
  }

  return (
    <div className={stepStyles.step}>
      <div className={stepStyles.intro}>
        <h1 className={stepStyles.heading}>What applicants send</h1>
        <p className={stepStyles.lede}>
          Started from the usual list for {typeWords}. Rename, remove or add anything, and choose what is required.
        </p>
      </div>

      {typeReset && (
        <p className={styles.reset}>
          You changed the opportunity type, so this list went back to the usual documents for {typeWords}.
        </p>
      )}

      <section className={['glass-soft', styles.card].join(' ')} aria-label="Documents applicants send">
        <ul className={styles.list}>
          {requirements.map((requirement, index) => {
            const locked = isLocked(requirement)
            const unnamed = showErrors && !requirement.label.trim()
            const note = locked
              ? 'Always asked for'
              : isDefaultFor(draft.opportunityType, requirement.key)
                ? 'Usual for this type'
                : 'Added by you'
            return (
              <li key={requirement.key} className={styles.row}>
                <span className={styles.kind} aria-hidden="true">
                  <Icon name={requirement.kind === 'TEXT' ? 'message' : 'file'} size={18} />
                </span>
                <span className={styles.naming}>
                  <Input
                    value={requirement.label}
                    onChange={(event) => replace(index, { label: event.target.value })}
                    disabled={locked}
                    maxLength={120}
                    aria-label="Document name"
                    className={[styles.name, locked ? styles.nameLocked : ''].join(' ')}
                    aria-invalid={unnamed ? true : undefined}
                  />
                  <span className={styles.note}>
                    {note}
                    {requirement.kind === 'TEXT' ? ', written in the form' : ''}
                  </span>
                </span>
                <span className={styles.need} role="group" aria-label={`Is ${requirement.label.trim() || 'this'} required`}>
                  <button
                    type="button"
                    aria-pressed={requirement.required}
                    className={[styles.needOption, requirement.required ? styles.needRequired : ''].join(' ')}
                    onClick={() => replace(index, { required: true })}
                    disabled={locked}
                  >
                    Required
                  </button>
                  <button
                    type="button"
                    aria-pressed={!requirement.required}
                    className={[styles.needOption, !requirement.required ? styles.needOptional : ''].join(' ')}
                    onClick={() => replace(index, { required: false })}
                    disabled={locked}
                  >
                    Optional
                  </button>
                </span>
                {locked ? (
                  <span className={styles.lock} title="Always asked for">
                    <Icon name="lock" size={16} />
                  </span>
                ) : (
                  <button
                    type="button"
                    className={styles.remove}
                    onClick={() =>
                      onChange({ documentRequirements: requirements.filter((_, position) => position !== index) })
                    }
                    aria-label={`Remove ${requirement.label.trim() || 'this document'}`}
                  >
                    <Icon name="delete" size={16} />
                  </button>
                )}
              </li>
            )
          })}
        </ul>

        {full ? (
          <p className={styles.full}>A posting can ask for up to {MAX_DOCUMENTS} items.</p>
        ) : (
          <form className={styles.add} onSubmit={add}>
            <Input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Add a document, for example Recommendation letter"
              aria-label="New document name"
              maxLength={120}
              className={styles.addInput}
            />
            <button type="submit" className={styles.addButton}>
              Add
            </button>
          </form>
        )}
      </section>

      <p className={styles.footnote}>
        Every application needs a CV, so it stays on the list. Files an applicant sends are kept exactly as sent.
      </p>
    </div>
  )
}
