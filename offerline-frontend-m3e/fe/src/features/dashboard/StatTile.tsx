import { Link } from 'react-router-dom'
import { CountUp } from '@/ui/CountUp'
import { Icon, type IconName } from '@/ui/Icon'
import styles from './StatTile.module.css'

type Props = {
  label: string
  value: number
  icon: IconName
  /** The line under the figure, saying what it means rather than repeating it. */
  note: string
  /** Set on the one tile that is waiting on the viewer, never on more. */
  urgent?: boolean
  to?: string
}

export function StatTile({ label, value, icon, note, urgent, to }: Props) {
  const body = (
    <>
      <span className={styles.head}>
        <span className={styles.label}>{label}</span>
        <span className={styles.icon} aria-hidden="true">
          <Icon name={icon} size={18} />
        </span>
      </span>
      <span className={styles.value}>
        <CountUp value={value} />
      </span>
      <span className={styles.note}>{note}</span>
    </>
  )

  // The urgent tile sits on a solid ground with its own ring, so it takes no
  // glass recipe: the vermilion edge is what sets it apart from the row.
  const className = [urgent ? styles.urgent : 'glass-soft', styles.tile, to ? styles.link : '']
    .filter(Boolean)
    .join(' ')

  return to ? (
    <Link to={to} className={className} data-ripple>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  )
}
