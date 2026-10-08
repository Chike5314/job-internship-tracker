import { ButtonLink } from '@/ui/ButtonLink'
import { StatusTag } from '@/ui/StatusTag'
import styles from './ApplySubmitted.module.css'

export type SentLine = { name: string; kind: string }

/** Takes the form's place once the application is in, saying where it went
 *  and what went with it. */
export function ApplySubmitted({
  companyName,
  applicationId,
  sent,
}: {
  companyName: string
  applicationId: string
  sent: SentLine[]
}) {
  return (
    <section className={['glass-soft', styles.card].join(' ')} aria-labelledby="sent-heading">
      <StatusTag status="SUBMITTED" compact />
      <h1 id="sent-heading" className={styles.title} tabIndex={-1}>
        Application sent to {companyName}
      </h1>
      <p className={styles.body}>
        A confirmation is in your email. You will get an alert here and an email every time its status
        changes.
      </p>
      <div className={styles.sent}>
        <p className={styles.eyebrow}>SENT WITH IT</p>
        <ul className={styles.lines}>
          {sent.map((line) => (
            <li key={`${line.kind}-${line.name}`} className={styles.line}>
              <span className={styles.name}>{line.name}</span>
              <span className={styles.kind}>{line.kind}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className={styles.actions}>
        <ButtonLink variant="primary" to={`/applications/${applicationId}`} className={styles.action}>
          Go to my applications
        </ButtonLink>
        <ButtonLink
          variant="secondary"
          to={`/applications/${applicationId}`}
          state={{ edit: true }}
          className={styles.action}
        >
          Edit application
        </ButtonLink>
      </div>
    </section>
  )
}
