import type { InputHTMLAttributes } from 'react'
import styles from './controls.module.css'

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={[styles.control, props.className].filter(Boolean).join(' ')} />
}
