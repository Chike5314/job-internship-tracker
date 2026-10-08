import type { InputHTMLAttributes } from 'react'
import styles from './Checkbox.module.css'

interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
}

export function Checkbox({ label, id, className, ...rest }: CheckboxProps) {
  return (
    <label htmlFor={id} className={[styles.wrapper, 't-body-sm', className].filter(Boolean).join(' ')}>
      <input type="checkbox" id={id} className={styles.input} {...rest} />
      <span>{label}</span>
    </label>
  )
}
