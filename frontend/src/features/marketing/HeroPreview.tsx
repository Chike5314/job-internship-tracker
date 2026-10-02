import { Icon } from '@/ui/Icon'
import styles from './HeroPreview.module.css'

/**
 * The product shown rather than described, beside the hero.
 *
 * Every row here is an example, not anyone's data, and the panel says so: a
 * visitor who is not signed in has no applications to show, and a marketing
 * page that implies otherwise is lying about what it knows. The names are
 * invented and local to where this product is used.
 */
const ROWS = [
  { role: 'Backend Engineer', at: 'Kora Systems · Douala', state: 'Interview', tone: 'waiting' },
  { role: 'Data Analyst Intern', at: 'Mbeya Analytics · Remote', state: 'Offer extended', tone: 'offer' },
  { role: 'Network Operations Trainee', at: 'Northfield Telecom · Yaoundé', state: 'Under review', tone: 'active' },
] as const

export function HeroPreview() {
  return (
    <div className={styles.stack} aria-hidden="true">
      <div className={['glass-dense', styles.panel].join(' ')}>
        <div className={styles.panelHead}>
          <p className="t-heading-sm">Recent applications</p>
          <span className={['t-body-sm', styles.quiet].join(' ')}>View all</span>
        </div>
        <ul className={styles.rows}>
          {ROWS.map((row) => (
            <li key={row.role} className={styles.row}>
              <span className={styles.rowText}>
                <span className="t-body">{row.role}</span>
                <span className={['t-body-sm', styles.quiet].join(' ')}>{row.at}</span>
              </span>
              <span className={[styles.state, styles[row.tone]].join(' ')}>{row.state}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className={['glass-dense', styles.invite].join(' ')}>
        <p className={['t-eyebrow', styles.inviteEyebrow].join(' ')}>Interview invitation</p>
        <p className="t-heading-sm">Technical interview</p>
        <p className={['t-body-sm', styles.quiet].join(' ')}>Kora Systems · Backend Engineer</p>
        <dl className={styles.detail}>
          <dt className={['t-body-sm', styles.quiet].join(' ')}>When</dt>
          <dd className="t-body-sm">Tue 29 Sep · 10:00 to 11:00</dd>
          <dt className={['t-body-sm', styles.quiet].join(' ')}>Where</dt>
          <dd className="t-body-sm">Onsite · Bonapriso, Douala</dd>
        </dl>
        <span className={styles.confirm}>
          <Icon name="confirm" size={15} />
          Confirm
        </span>
      </div>

      <p className={['t-caption', styles.note].join(' ')}>An example, not real applications.</p>
    </div>
  )
}
