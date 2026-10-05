import type { Profile } from '@/api/types'
import { ButtonLink } from '@/ui/ButtonLink'
import { Icon } from '@/ui/Icon'
import styles from './ProfileNudge.module.css'

type Step = {
  done: boolean
  /** What adding it gets the applicant, said when it is the next one missing. */
  prompt: string
  to: string
}

/** The five things the profile asks for, in the order they are prompted. */
function steps(profile: Profile): Step[] {
  return [
    {
      done: Boolean(profile.fullName),
      prompt: 'Add your full name so companies know who is applying.',
      to: '/profile',
    },
    {
      done: Boolean(profile.phone),
      prompt: 'Add a phone number so a company can call you about an interview.',
      to: '/profile',
    },
    {
      done: Boolean(profile.skills?.length),
      prompt: 'List your skills so every company you apply to can see them.',
      to: '/profile',
    },
    {
      done: profile.cvCount > 0,
      prompt: 'Upload a CV once and reuse it on every application you send.',
      to: '/profile/cvs',
    },
    {
      done: Boolean(profile.hasTranscript),
      prompt: 'Add your transcript once and it goes with every academic internship application.',
      to: '/profile',
    },
  ]
}

/** Shown until the profile is complete, naming the next thing to add. */
export function ProfileNudge({ profile }: { profile: Profile }) {
  const all = steps(profile)
  const done = all.filter((step) => step.done).length
  const next = all.find((step) => !step.done)
  if (!next) return null

  return (
    <section className={['glass-soft', styles.card].join(' ')} aria-labelledby="finish-profile">
      <div className={styles.lead}>
        <span className={styles.icon} aria-hidden="true">
          <Icon name="send" size={19} />
        </span>
        <div className={styles.text}>
          <h2 id="finish-profile" className={styles.title}>
            Finish your profile
          </h2>
          <p className={styles.prompt}>{next.prompt}</p>
        </div>
      </div>

      <div className={styles.progress}>
        <div className={styles.progressRow}>
          <span className={styles.progressLabel}>Profile complete</span>
          <span className={styles.count}>
            {done} of {all.length}
          </span>
        </div>
        <div
          className={styles.track}
          role="progressbar"
          aria-valuenow={done}
          aria-valuemin={0}
          aria-valuemax={all.length}
          aria-labelledby="finish-profile"
        >
          <span className={styles.bar} style={{ width: `${(done / all.length) * 100}%` }} />
        </div>
      </div>

      <ButtonLink variant="secondary" to={next.to} className={styles.action}>
        Update profile
      </ButtonLink>
    </section>
  )
}
