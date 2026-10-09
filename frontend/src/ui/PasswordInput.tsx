import { useState, type InputHTMLAttributes } from 'react'
import { Icon } from './Icon'
import { Input } from './Input'
import styles from './PasswordInput.module.css'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>

/**
 * A password field with a button to show what has been typed. Mistyping a
 * password nobody can see is the commonest reason a sign up fails its rules,
 * so the person can check it before sending.
 *
 * The button keeps focus in the field (mousedown is cancelled), so the caret
 * stays where it was and typing carries on. It names the action it will take,
 * "Show password" or "Hide password", which is what a screen reader announces.
 */
export function PasswordInput({ className, disabled, ...props }: Props) {
  const [visible, setVisible] = useState(false)
  return (
    <span className={styles.wrap}>
      <Input
        {...props}
        disabled={disabled}
        type={visible ? 'text' : 'password'}
        className={[styles.field, className].filter(Boolean).join(' ')}
      />
      <button
        type="button"
        className={styles.toggle}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        disabled={disabled}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setVisible((current) => !current)}
      >
        <Icon name={visible ? 'eye-off' : 'eye'} size={20} />
      </button>
    </span>
  )
}
