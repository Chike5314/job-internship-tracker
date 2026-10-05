import { Link } from 'react-router-dom'
import { Logo } from '@/app/Logo'
import { Icon } from '@/ui/Icon'
import { formatDateShort } from '@/lib/formatDate'
import styles from './ApplyHeader.module.css'

const DAY = 24 * 60 * 60 * 1000

/** "7 days left", "1 day left", "Last day". Counted in whole days to the
 *  deadline's own date, so the evening before does not read as zero. */
function daysLeft(deadline: string): string {
  const end = new Date(deadline)
  end.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const days = Math.round((end.getTime() - today.getTime()) / DAY)
  if (days <= 0) return 'Last day'
  return days === 1 ? '1 day left' : `${days} days left`
}

/** The apply screen's own bar: the way back, the brand, and the deadline. */
export function ApplyHeader({ deadline }: { deadline?: string }) {
  return (
    <header className={styles.bar}>
      <Link to="/postings" className={styles.back}>
        <Icon name="chevron-right" size={18} className={styles.backIcon} />
        <span className={styles.backLong}>Back to opportunities</span>
        <span className={styles.backShort}>Back</span>
      </Link>
      <Link to="/dashboard" className={styles.brand} aria-label="Offerline home">
        <Logo height={24} />
      </Link>
      <p className={styles.deadline}>
        {deadline ? (
          <>
            <span className={styles.dot} aria-hidden="true" />
            <span>
              Closes {formatDateShort(deadline)}
              <span className={styles.daysLeft}> · {daysLeft(deadline)}</span>
            </span>
          </>
        ) : (
          'Open until filled'
        )}
      </p>
    </header>
  )
}
