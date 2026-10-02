import { VisuallyHidden } from './VisuallyHidden'
import styles from './Spinner.module.css'

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <span className={styles.spinner} role="status">
      <span className={styles.circle} aria-hidden="true" />
      <VisuallyHidden>{label}</VisuallyHidden>
    </span>
  )
}
