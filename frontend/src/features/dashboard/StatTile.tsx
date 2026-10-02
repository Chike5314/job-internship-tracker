import { Link } from 'react-router-dom'
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
        <span className={['t-body-sm', styles.label].join(' ')}>{label}</span>
        <span className={styles.icon} aria-hidden="true">
          <Icon name={icon} size={17} />
        </span>
      </span>
      <span className={['t-figure-xl', styles.value].join(' ')}>{value}</span>
      <span className={['t-caption', styles.note].join(' ')}>{note}</span>
    </>
  )

  const className = ['glass-soft', styles.tile, urgent ? styles.urgent : ''].join(' ')

  return to ? (
    <Link to={to} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  )
}
