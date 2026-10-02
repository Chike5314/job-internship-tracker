import type { ReactNode } from 'react'
import styles from './PageHeader.module.css'

interface PageHeaderProps {
  title: string
  action?: ReactNode
  children?: ReactNode
}

export function PageHeader({ title, action, children }: PageHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.row}>
        <h1 className="t-display-md">{title}</h1>
        {action}
      </div>
      {children}
    </header>
  )
}
