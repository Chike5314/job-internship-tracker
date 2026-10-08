import type { ReactNode } from 'react'
import styles from './Pill.module.css'

type Tone = 'positive' | 'neutral' | 'attention'

export function Pill({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={[styles.pill, styles[tone], 't-caption'].join(' ')}>{children}</span>
}
