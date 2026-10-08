import { Link } from 'react-router-dom'
import type { ApplicantApplication, CompanyApplicant } from '@/api/types'
import { Icon } from '@/ui/Icon'
import { Monogram } from '@/ui/Monogram'
import { StatusTag } from '@/ui/StatusTag'
import { formatDate, formatInterviewMoment } from '@/lib/formatDate'
import { timeInStage } from './pipeline'
import styles from './ApplicantPanel.module.css'

/** Where this application lives on its posting's board. Opening it there is
 *  what freezes it for editing, so the directory never opens anything itself:
 *  reading a list of people should not quietly change any of them. */
const boardLink = (application: ApplicantApplication) =>
  `/company/postings/${application.jobId}/pipeline?application=${application.applicationId}`

function AcademicLine({ person }: { person: CompanyApplicant }) {
  const academic = person.academicInfo
  if (!academic) return null
  const parts = [academic.degreeLevel, academic.fieldOfStudy, academic.schoolName].filter(Boolean)
  if (parts.length === 0) return null
  return (
    <span className={styles.fact}>
      <Icon name="skills" size={15} />
      <span className="t-body-sm">{parts.join(', ')}</span>
    </span>
  )
}

/**
 * One person, with everything they have sent this company under them.
 *
 * The applications are listed newest first and each one links into its own
 * posting's board rather than opening here, because the board is where a
 * decision gets made and this panel is for working out whether to go there.
 */
export function ApplicantPanel({ person }: { person: CompanyApplicant }) {
  const name = person.fullName || 'Applicant'

  return (
    <article className={styles.panel}>
      <header className={styles.head}>
        <Monogram name={name} size="lg" />
        <div className={styles.identity}>
          <h2 className="t-heading">{name}</h2>
          <div className={styles.facts}>
            {person.email && (
              <span className={styles.fact}>
                <Icon name="message" size={15} />
                <a href={`mailto:${person.email}`} className="t-body-sm">
                  {person.email}
                </a>
              </span>
            )}
            {person.phone && (
              <span className={styles.fact}>
                <Icon name="person" size={15} />
                <span className="t-body-sm">{person.phone}</span>
              </span>
            )}
            <AcademicLine person={person} />
          </div>
        </div>
      </header>

      {person.skills.length > 0 && (
        <section className={styles.block}>
          <h3 className="t-eyebrow">Skills</h3>
          <div className={styles.skills}>
            {person.skills.map((skill) => (
              <span key={skill} className={['t-body-sm', styles.skill].join(' ')}>
                {skill}
              </span>
            ))}
          </div>
        </section>
      )}

      <section className={styles.block}>
        <h3 className="t-eyebrow">Standing with you</h3>
        <dl className={styles.standing}>
          <div>
            <dt className={['t-caption', styles.muted].join(' ')}>Furthest stage</dt>
            <dd>
              <StatusTag status={person.furthestStatus} />
            </dd>
          </div>
          <div>
            <dt className={['t-caption', styles.muted].join(' ')}>Applications</dt>
            <dd className="t-figure">{person.applicationCount}</dd>
          </div>
          <div>
            <dt className={['t-caption', styles.muted].join(' ')}>First applied</dt>
            <dd className="t-body-sm">
              {person.firstAppliedAt ? formatDate(person.firstAppliedAt) : 'Unknown'}
            </dd>
          </div>
        </dl>

        {(person.awaitingReview > 0 || person.awaitingTheirReply > 0) && (
          <ul className={styles.owed}>
            {person.awaitingReview > 0 && (
              <li className={['t-body-sm', styles.needsYou].join(' ')}>
                <span className={styles.dot} aria-hidden="true" />
                {person.awaitingReview === 1
                  ? 'One application is still waiting to be opened.'
                  : `${person.awaitingReview} applications are still waiting to be opened.`}
              </li>
            )}
            {person.awaitingTheirReply > 0 && (
              <li className={['t-body-sm', styles.muted].join(' ')}>
                {person.awaitingTheirReply === 1
                  ? 'One offer or interview invitation is waiting on their reply.'
                  : `${person.awaitingTheirReply} offers or interview invitations are waiting on their reply.`}
              </li>
            )}
          </ul>
        )}
      </section>

      <section className={styles.block}>
        <h3 className="t-eyebrow">What they have sent you</h3>
        <ul className={styles.applications}>
          {person.applications.map((application) => (
            <li key={application.applicationId} className={styles.application}>
              <div className={styles.applicationHead}>
                <Link to={boardLink(application)} className={['t-body', styles.jobTitle].join(' ')}>
                  {application.jobTitle ?? 'Posting'}
                </Link>
                <StatusTag status={application.status} compact />
              </div>

              <div className={styles.applicationMeta}>
                <span className={['t-caption', styles.muted].join(' ')}>
                  Applied {formatDate(application.appliedAt)}
                </span>
                {!application.isFinal && application.statusChangedAt && (
                  <span className={['t-caption', styles.muted].join(' ')}>
                    {timeInStage(application.statusChangedAt)}
                  </span>
                )}
                {application.interviewCount > 0 && (
                  <span className={['t-caption', styles.muted].join(' ')}>
                    <Icon name="interview" size={13} />
                    {application.interviewCount === 1
                      ? '1 interview'
                      : `${application.interviewCount} interviews`}
                  </span>
                )}
              </div>

              {application.nextInterview && (
                <p className={['t-caption', styles.next].join(' ')}>
                  Next interview {formatInterviewMoment(application.nextInterview.scheduledAt)}
                  {application.nextInterview.state === 'PROPOSED' && ', not answered yet'}
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>
    </article>
  )
}
