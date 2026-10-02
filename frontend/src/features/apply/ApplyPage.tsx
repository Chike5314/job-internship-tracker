import { useParams } from 'react-router-dom'
import { EmptyState } from '@/ui/EmptyState'
import { Skeleton } from '@/ui/Skeleton'
import { ButtonLink } from '@/ui/ButtonLink'
import { useCvs } from '@/features/profile/useProfile'
import { usePosting } from '@/features/postings/usePostings'
import { useMyApplications } from '@/features/applications/useApplications'
import { ApplyFormPanel } from './ApplyFormPanel'

// This outer component owns only the loading/error/redirect states. The
// form itself is a separate component (ApplyForm) that mounts only once
// job and cvs data are both ready, so useApplyForm's one-time useReducer
// initializer sees the real CV list on its first (and only) run, instead
// of racing the query and freezing on an empty array. React hooks can't
// be called conditionally, so this split is what keeps the fix
// structural rather than a timing patch.
export function ApplyPage() {
  const { jobId } = useParams<{ jobId: string }>()
  const { data: postingData, isLoading: postingLoading } = usePosting(jobId!)
  const { data: cvData, isLoading: cvsLoading } = useCvs()
  const { data: applicationsData } = useMyApplications()

  if (postingLoading || cvsLoading) {
    return <Skeleton height={400} radius="var(--radius-xl)" />
  }

  if (!postingData) {
    return <EmptyState heading="Posting not found" />
  }

  const { job } = postingData
  const alreadyApplied = applicationsData?.applications.find((application) => application.jobId === job.jobId)

  if (alreadyApplied) {
    return (
      <EmptyState
        heading="You already applied to this posting"
        action={<ButtonLink to={`/applications/${alreadyApplied.applicationId}`}>See your application</ButtonLink>}
      />
    )
  }

  if (!job.isOpen) {
    return (
      <EmptyState
        heading="This posting is not accepting applications"
        action={<ButtonLink to="/postings">Browse postings</ButtonLink>}
      />
    )
  }

  return <ApplyFormPanel job={job} cvs={cvData?.cvs ?? []} existingApplications={applicationsData?.applications ?? []} />
}
