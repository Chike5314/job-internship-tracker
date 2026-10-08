import type { VerificationStatus } from '@/api/enums'
import { Monogram } from '@/ui/Monogram'
import styles from './VerificationTag.module.css'

// A tag names a standing beside a company's name, so it takes the short word.
const SHORT_LABEL: Record<VerificationStatus, string> = {
  PENDING_VERIFICATION: 'Pending',
  VERIFIED: 'Verified',
  REJECTED: 'Rejected',
  SUSPENDED: 'Suspended',
}

// Pending takes the signal hue because it is the one standing waiting on the
// admin. A decision already taken is settled, so it takes a quiet tone.
const TONE: Record<VerificationStatus, string> = {
  PENDING_VERIFICATION: styles.pending!,
  VERIFIED: styles.verified!,
  REJECTED: styles.closed!,
  SUSPENDED: styles.closed!,
}

export function VerificationTag({ status }: { status: VerificationStatus }) {
  return (
    <span className={[styles.tag, TONE[status]].join(' ')}>
      <span className={styles.dot} aria-hidden="true" />
      {SHORT_LABEL[status]}
    </span>
  )
}

/** A company's logo when it has uploaded one, its initial otherwise. */
export function CompanyMark({ name, logoUrl, size = 'md' }: { name: string; logoUrl?: string; size?: 'sm' | 'md' | 'lg' }) {
  if (logoUrl) {
    return <img src={logoUrl} alt="" className={[styles.logo, styles[size]].join(' ')} />
  }
  return <Monogram name={name} size={size} />
}
