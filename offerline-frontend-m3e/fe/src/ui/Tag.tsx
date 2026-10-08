import type { ReactNode } from 'react'
import styles from './Tag.module.css'

/** A non-interactive label, e.g. one skill on a posting card. */
export function Tag({ children }: { children: ReactNode }) {
  return <span className={[styles.tag, 't-caption'].join(' ')}>{children}</span>
}
