import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import type { ApplicationDetail } from '@/api/types'
import { ApiError } from '@/api/errors'
import { OPPORTUNITY_TYPE_LABEL, WORK_MODALITY_LABEL } from '@/api/enums'
import { useAuth } from '@/auth/AuthProvider'
import { usePosting } from '@/features/postings/usePostings'
import { formatSalary } from '@/lib/formatSalary'
import { Button } from '@/ui/Button'
import { Dialog } from '@/ui/Dialog'
import { Icon } from '@/ui/Icon'
import { Monogram } from '@/ui/Monogram'
import { StatusTag } from '@/ui/StatusTag'
import { useToast } from '@/ui/ToastProvider'
import { useRespondToOffer, useWithdrawApplication } from './useApplications'
import { EditApplicationPanel } from './EditApplicationPanel'
import { currentInterview } from '@/lib/interviews'
import { InterviewCard } from './InterviewCard'
import { StatusHistory } from './StatusHistory'
import { SentItems } from './SentItems'
import styles from './ApplicationDetailPanel.module.css'

export function ApplicationDetailPanel({ application }: { application: ApplicationDetail }) {
  const location = useLocation()
  // Arriving from the apply screen's "Edit application" opens the form at once.
  const [editing, setEditing] = useState(
    () => Boolean((location.state as { edit?: boolean } | null)?.edit) && application.canEdit,
  )
  const [withdrawing, setWithdrawing] = useState(false)
  const { identity } = useAuth()
  const { showToast } = useToast()
  const respondToOffer = useRespondToOffer(application.applicationId)
  const withdraw = useWithdrawApplication(application.applicationId)
  // The application payload carries the role and the company name but not where
  // the work happens or what it pays, and FR-4.3 puts the company's website and
  // map beside any onsite or hybrid posting. Both come from the posting itself,
  // which is public and already cached by the browse and detail screens. Read
  // above the early return below, since every hook has to run on every render.
  const posting = usePosting(application.jobId)

  if (editing) {
    return (
      <div className={styles.editing}>
        <EditApplicationPanel application={application} onDone={() => setEditing(false)} />
      </div>
    )
  }

  const job = posting.data?.job
  const company = posting.data?.company
  const salary = job?.salary?.disclosed ? formatSalary(job.salary, { compact: true }) : ''
  const where = !job
    ? []
    : job.workModality === 'REMOTE'
      ? [WORK_MODALITY_LABEL.REMOTE]
      : [WORK_MODALITY_LABEL[job.workModality], job.city ?? job.country]
  const meta = [OPPORTUNITY_TYPE_LABEL[application.opportunityType], ...where].filter(Boolean)
  const companyName = application.companyName

  const interview =
    application.status === 'INTERVIEW_SCHEDULED'
      ? currentInterview(application.interviews)
      : undefined
  const frozen = !application.isFinal && !application.canEdit

  function answerOffer(status: 'OFFER_ACCEPTED' | 'OFFER_DECLINED') {
    respondToOffer.mutate(status, {
      onError: (error) =>
        showToast(
          error instanceof ApiError ? error.message : 'Your answer did not go through. Try again.',
          'error',
        ),
    })
  }

  return (
    <div className={styles.panel}>
      <header className={styles.head}>
        <div className={styles.identity}>
          <Monogram name={companyName} size="lg" />
          <div className={styles.headText}>
            <h2 className={styles.role}>{application.jobTitle}</h2>
            <p className={styles.company}>
              {companyName}
              {company?.verificationStatus === 'VERIFIED' && (
                // The shield-and-tick glyph, which the sprite files under admin.
                <Icon name="admin" size={15} label="Verified company" className={styles.verified} />
              )}
            </p>
            <p className={styles.meta}>{meta.join(' · ')}</p>
            {job && (
              <p className={salary ? styles.salary : styles.noSalary}>
                {salary || 'Salary not disclosed'}
              </p>
            )}
          </div>
        </div>

        <div className={styles.links}>
          {company?.companyWebsiteUrl && (
            <a
              href={company.companyWebsiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.outline}
            >
              Company website
            </a>
          )}
          {company?.googleMapsUrl && (
            <a
              href={company.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.outline}
            >
              View on Maps
            </a>
          )}
          <Link to={`/postings/${application.jobId}`} className={styles.plain}>
            View posting
          </Link>
        </div>
      </header>

      <div className={styles.body}>
        {interview && <InterviewCard application={application} interview={interview} />}

        {application.status === 'OFFER_EXTENDED' && (
          <section className={styles.offer} aria-labelledby="offer-card">
            <div>
              <h3 id="offer-card" className={styles.offerTitle}>
                You have an offer
              </h3>
              <p className={styles.offerText}>
                {companyName} is waiting for your answer. Accepting or declining is final and goes
                into the history below.
              </p>
            </div>
            <div className={styles.offerActions}>
              <Button
                variant="primary"
                className={styles.offerButton}
                disabled={respondToOffer.isPending}
                onClick={() => answerOffer('OFFER_ACCEPTED')}
              >
                Accept offer
              </Button>
              <Button
                variant="secondary"
                className={[styles.offerButton, styles.declineButton].join(' ')}
                disabled={respondToOffer.isPending}
                onClick={() => answerOffer('OFFER_DECLINED')}
              >
                Decline
              </Button>
            </div>
          </section>
        )}

        <section className={styles.section} aria-labelledby="status-history">
          <header className={styles.sectionHead}>
            <h3 id="status-history" className={styles.eyebrow}>
              STATUS HISTORY
            </h3>
            <StatusTag status={application.status} compact />
          </header>
          <StatusHistory
            history={application.statusHistory}
            isFinal={application.isFinal}
            viewerId={identity?.userId}
            company={companyName}
          />
        </section>

        <SentItems application={application} />

        {application.canEdit && (
          <div className={styles.editable}>
            <p>You can still change this until {companyName} opens it.</p>
            <Button variant="secondary" className={styles.editButton} onClick={() => setEditing(true)}>
              Edit application
            </Button>
          </div>
        )}

        {frozen && (
          <p className={styles.frozen}>
            Locked for editing since {companyName} opened it, so they read exactly what you sent.
          </p>
        )}

        {application.isFinal ? (
          <p className={styles.closed}>
            This application is closed. Its history stays here for your records.
          </p>
        ) : (
          <div className={styles.withdraw}>
            <p>Changed your mind?</p>
            <button
              type="button"
              className={styles.withdrawButton}
              onClick={() => setWithdrawing(true)}
            >
              Withdraw application
            </button>
          </div>
        )}
      </div>

      <Dialog
        open={withdrawing}
        onClose={() => setWithdrawing(false)}
        title="Withdraw this application?"
        footer={
          <>
            <Button variant="quiet" onClick={() => setWithdrawing(false)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              loading={withdraw.isPending}
              onClick={() =>
                withdraw.mutate(undefined, {
                  onSuccess: () => setWithdrawing(false),
                  onError: (error) =>
                    showToast(
                      error instanceof ApiError
                        ? error.message
                        : 'The withdrawal did not go through. Try again.',
                      'error',
                    ),
                })
              }
            >
              Withdraw application
            </Button>
          </>
        }
      >
        <p className="t-body-sm">{companyName} will be told, and this cannot be undone.</p>
      </Dialog>
    </div>
  )
}
