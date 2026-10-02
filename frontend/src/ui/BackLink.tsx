import { Link } from 'react-router-dom'
import styles from './BackLink.module.css'

export function BackLink({ to, children }: { to: string; children: string }) {
  return (
    <Link to={to} className={[styles.link, 't-body-sm'].join(' ')}>
      <span aria-hidden="true">&larr;</span> {children}
    </Link>
  )
}
