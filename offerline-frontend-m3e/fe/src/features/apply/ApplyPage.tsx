import type { ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { EmptyState } from '@/ui/EmptyState'
import { Skeleton } from '@/ui/Skeleton'
import { ButtonLink } from '@/ui/ButtonLink'
import { useCvs, useProfile } from '@/features/profile/useProfile'
import { usePosting } from '@/features/postings/usePostings'
import { useMyApplications } from '@/features/applications/useApplications'
import { ApplyFormPanel } from './ApplyFormPanel'
import { ApplyHeader } from './ApplyHeader'
import styles from './ApplyPage.module.css'

// This outer component owns only the loading/error/redirect states. The
// form itself is a separate component (ApplyFormPanel) that mounts only once
// job and cvs data are both ready, so useApplyForm's one-time useReducer
// initializer sees the real CV list on its first (and only) run, instead
// of racing the query and freezing on an empty array. React hooks can't
// be called conditionally, so this split is what keeps the fix
// structural rather than a timing patch.
export function ApplyPage() {
  const { jobId } = useParams<{ jobId: string }>()
  const { data: postingData, isLoading: postingLoading } = usePosting(jobId!)
  const { data: cvData, isLoading: cvsLoading } = useCvs()
  const { data: profile, isLoading: profileLoading } = useProfile()
  const { data: applicationsData } = useMyApplications()

  const job = postingData?.job
  let content: ReactNode

  if (postingLoading || cvsLoading || profileLoading) {
    content = (
      <div className={styles.loading}>
        <Skeleton height={520} radius="var(--radius-lg)" />
        <Skeleton height={520} radius="var(--radius-lg)" />
      </div>
    )
  } else if (!postingData || !job) {
    content = (
      <EmptyState
        heading="Posting not found"
        action={<ButtonLink to="/postings">Browse opportunities</ButtonLink>}
      />
    )
  } else {
    const alreadyApplied = applicationsData?.applications.find((application) => application.jobId === job.jobId)
    if (alreadyApplied) {
      content = (
        <EmptyState
          heading="You already applied to this posting"
          action={<ButtonLink to={`/applications/${alreadyApplied.applicationId}`}>See your application</ButtonLink>}
        />
      )
    } else if (!job.isOpen) {
      content = (
        <EmptyState
          heading="This posting is not accepting applications"
          action={<ButtonLink to="/postings">Browse opportunities</ButtonLink>}
        />
      )
    } else {
      content = (
        <ApplyFormPanel
          job={job}
          company={postingData.company}
          profile={profile?.profile}
          cvs={cvData?.cvs ?? []}
          existingApplications={applicationsData?.applications ?? []}
        />
      )
    }
  }

  return (
    <>
      <ApplyHeader deadline={job?.applicationDeadline} />
      <main id="main" className={styles.main}>
        {content}
      </main>
    </>
  )
}
