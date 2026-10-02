import { useId, type ReactNode } from 'react'
import styles from './Field.module.css'

export interface FieldControlProps {
  id: string
  'aria-describedby'?: string
  'aria-invalid'?: true
}

interface FieldProps {
  label: string
  help?: string
  /** A short rule shown on the label row rather than under the control, for a
   *  constraint the viewer needs before typing rather than after. */
  hint?: string
  error?: string
  required?: boolean
  /** A predictable id instead of the generated one, e.g. so an
   * ErrorSummary can focus a specific field by id. */
  id?: string
  children: (controlProps: FieldControlProps) => ReactNode
}

/**
 * Owns the label-for association and the aria-describedby chain across
 * help and error text, so every control gets this wiring the same way
 * rather than each page re-deriving it.
 */
export function Field({ label, help, hint, error, required, id: explicitId, children }: FieldProps) {
  const generatedId = useId()
  const id = explicitId ?? generatedId
  const helpId = help ? `${id}-help` : undefined
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, helpId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className={styles.field}>
      <div className={styles.labelRow}>
        <label htmlFor={id} className={`${styles.label} t-body-sm`}>
          {label}
          {required && (
            <span aria-hidden="true" className={styles.required}>
              {' '}
              *
            </span>
          )}
        </label>
        {hint && (
          <span id={hintId} className={`${styles.hint} t-caption`}>
            {hint}
          </span>
        )}
      </div>
      {children({
        id,
        ...(describedBy ? { 'aria-describedby': describedBy } : {}),
        ...(error ? { 'aria-invalid': true as const } : {}),
      })}
      {help && (
        <p id={helpId} className={`${styles.help} t-caption`}>
          {help}
        </p>
      )}
      {error && (
        <p id={errorId} className={`${styles.error} t-caption`} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
