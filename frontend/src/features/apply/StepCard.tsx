import type { ReactNode } from 'react'
import styles from './StepCard.module.css'

interface StepCardProps {
  number: number
  title: string
  description?: ReactNode
  /** A step waiting on the viewer sits on the denser glass with an edge, the
   *  way the canvas sets the CV and letter steps apart from the recaps. */
  asks?: boolean
  /** Set once a send was attempted with this step still missing something. */
  invalid?: boolean
  children: ReactNode
}

/** One numbered step of the apply form: "01 Your details", "02 CV for this
 *  role", and so on, matching the canvas's apply screen. */
export function StepCard({ number, title, description, asks, invalid, children }: StepCardProps) {
  return (
    <section
      className={[
        styles.step,
        asks ? styles.asks : 'glass-soft',
        invalid ? styles.invalid : '',
      ].join(' ')}
    >
      <header className={styles.head}>
        <span className={styles.number}>{String(number).padStart(2, '0')}</span>
        <h2 className={styles.title}>{title}</h2>
        {description && <p className={styles.description}>{description}</p>}
      </header>
      <div className={styles.body}>{children}</div>
    </section>
  )
}
