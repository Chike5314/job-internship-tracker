import { Outlet } from 'react-router-dom'
import { BloomField } from './BloomField'
import { Logo } from './Logo'
import { ThemeToggle } from './ThemeToggle'
import { Icon, type IconName } from '@/ui/Icon'
import styles from './AuthLayout.module.css'

/**
 * A top bar with a notification bell and an account menu makes no sense on a
 * sign in screen, so this is its own layout rather than a reuse of AppShell.
 *
 * Split screen: the product on the left, the form on the right. The left side
 * carries the four stages an application actually moves through, taken from the
 * same status vocabulary the pipeline uses, so someone deciding whether to sign
 * up can see what the account is for. Below 900px the left side becomes a short
 * band above the form rather than disappearing, so the page still says what it
 * is on a phone.
 */
const STAGES: { icon: IconName; label: string; note: string }[] = [
  { icon: 'submitted', label: 'Submitted', note: 'Your documents, sent once and tracked from there' },
  { icon: 'under-review', label: 'Under review', note: 'The moment a recruiter opens it, you know' },
  { icon: 'interview', label: 'Interview', note: 'Times proposed, confirmed and kept in one place' },
  { icon: 'offer', label: 'Offer', note: 'Accept or decline without chasing an inbox' },
]

export function AuthLayout() {
  return (
    <div className={styles.wrapper}>
      <section className={styles.brand}>
        <BloomField />
        <div className={styles.brandInner}>
          <span className={styles.brandLogo}>
            <Logo height={30} />
          </span>
          <div className={styles.brandBody}>
            <div className={styles.pitch}>
              <p className="t-eyebrow">Real opportunities. Right here.</p>
              <h2 className={['t-display-md', styles.headline].join(' ')}>
                Every application, from sent to signed.
              </h2>
            </div>
            <ol className={styles.stages}>
            {STAGES.map((stage) => (
              <li key={stage.label} className={styles.stage}>
                <span className={styles.stageIcon}>
                  <Icon name={stage.icon} size={18} />
                </span>
                <span>
                  <span className={['t-heading-sm', styles.stageLabel].join(' ')}>{stage.label}</span>
                  <span className={['t-body-sm', styles.stageNote].join(' ')}>{stage.note}</span>
                </span>
              </li>
            ))}
            </ol>
          </div>
          {/* The positioning line and the mark of ownership, which is how the
              board closes the brand panel. */}
          <div className={styles.brandFoot}>
            <p className="t-body-sm">Opportunity, organized. Success, accelerated.</p>
            <p className="t-body-sm">© 2026 Offerline</p>
          </div>
        </div>
      </section>

      <section className={styles.form}>
        <header className={styles.formHeader}>
          <span className={styles.compactLogo}>
            <Logo height={24} />
          </span>
          <ThemeToggle />
        </header>
        <div className={styles.center}>
          <div className={styles.panel}>
            <Outlet />
          </div>
        </div>
      </section>
    </div>
  )
}
