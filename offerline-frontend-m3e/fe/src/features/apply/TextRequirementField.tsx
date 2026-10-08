import type { DocumentRequirement } from '@/api/types'
import { Input } from '@/ui/Input'
import { Textarea } from '@/ui/Textarea'
import styles from './RequirementField.module.css'

interface TextRequirementFieldProps {
  requirement: DocumentRequirement
  value: string
  onChange: (value: string) => void
  error?: string
  /** Marks the field once a send was attempted without it. */
  invalid?: boolean
  /** A line under the label saying what a good answer looks like. */
  help?: string
  /** A single line, for a link or a short window rather than prose. */
  short?: boolean
}

export function TextRequirementField({
  requirement,
  value,
  onChange,
  error,
  invalid,
  help,
  short,
}: TextRequirementFieldProps) {
  const id = `field-${requirement.key}`
  const message = error ?? (invalid ? `Add your ${requirement.label.toLowerCase()}.` : undefined)
  const describedBy = [help ? `${id}-help` : '', message ? `${id}-error` : ''].filter(Boolean).join(' ')
  const shared = {
    id,
    value,
    'aria-invalid': message ? (true as const) : undefined,
    'aria-describedby': describedBy || undefined,
  }

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {requirement.label}
        {!requirement.required && <span className={styles.optional}> optional</span>}
      </label>
      {help && (
        <p id={`${id}-help`} className={styles.help}>
          {help}
        </p>
      )}
      {short ? (
        <Input {...shared} className={styles.input} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <Textarea
          {...shared}
          rows={5}
          className={styles.textarea}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {message && (
        <p id={`${id}-error`} className={styles.error}>
          {message}
        </p>
      )}
    </div>
  )
}
