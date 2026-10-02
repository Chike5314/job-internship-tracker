import type { ReactNode } from 'react'
import styles from './DefinitionList.module.css'

export interface Definition {
  key: string
  term: string
  value: ReactNode
}

export function DefinitionList({ items }: { items: Definition[] }) {
  return (
    <dl className={styles.list}>
      {items.map((item) => (
        <div key={item.key} className={styles.row}>
          <dt className="t-caption" style={{ color: 'var(--color-text-subtle)' }}>
            {item.term}
          </dt>
          <dd className="t-body-sm">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}
