import type { TextareaHTMLAttributes } from 'react'
import styles from './controls.module.css'

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={[styles.control, props.className].filter(Boolean).join(' ')} />
}
