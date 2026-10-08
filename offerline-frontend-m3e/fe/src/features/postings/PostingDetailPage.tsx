import { useParams } from 'react-router-dom'
import { ApiError } from '@/api/errors'
import { OPPORTUNITY_TYPE_LABEL, WORK_MODALITY_LABEL, EXPERIENCE_LEVEL_LABEL } from '@/api/enums'
import { useAuth } from '@/auth/AuthProvider'
import { BackLink } from '@/ui/BackLink'
import { ButtonLink } from '@/ui/ButtonLink'
import { DefinitionList, type Definition } from '@/ui/DefinitionList'
import { EmptyState } from '@/ui/EmptyState'
import { Pill } from '@/ui/Pill'
import { Skeleton } from '@/ui/Skeleton'
import { Tag } from '@/ui/Tag'
import { formatDate } from '@/lib/formatDate'
import { formatSalary } from '@/lib/formatSalary'
import { useMyApplications } from '@/features/applications/useApplications'
import { CompanyPanel } from './CompanyPanel'
import { RequirementsPreview } from './RequirementsPreview'
import { usePosting } from './usePostings'

export function PostingDetailPage() {
  const { jobId } = useParams<{ jobId: string }>()
  const { status: authStatus } = useAuth()
  const { data, isLoading, error } = usePosting(jobId!)
  const { data: myApplications } = useMyApplications()

  if (isLoading) {
    return <Skeleton height={320} radius="var(--radius-xl)" />
  }

  // GET /jobs/{id} is public=True at the API Gateway level, so it never
  // sees a signed-in caller no matter what token is sent. That means the
  // owner-or-already-applied exception in the handler can never fire, and
  // a CLOSED or EXPIRED posting 403s everyone, applicants who already
  // applied to it included. Treated as a plain state, not an error.
  if (error instanceof ApiError && error.status === 403) {
    return (
      <EmptyState
        art="lost"
        heading="This posting is no longer open"
        body="It may have closed or reached its deadline."
        action={<ButtonLink to="/postings">Browse postings</ButtonLink>}
      />
    )
  }

  if (error instanceof ApiError && error.status === 404) {
    return <EmptyState art="lost" heading="Posting not found" action={<ButtonLink to="/postings">Browse postings</ButtonLink>} />
  }

  if (!data) {
    return <EmptyState heading="Could not load this posting" />
  }

  const { job, company } = data
  const existingApplication = myApplications?.applications.find((application) => application.jobId === job.jobId)

  const facts: Definition[] = [
    { key: 'type', term: 'Type', value: OPPORTUNITY_TYPE_LABEL[job.opportunityType] },
    { key: 'modality', term: 'Modality', value: WORK_MODALITY_LABEL[job.workModality] },
  ]
  if (job.experienceLevel) facts.push({ key: 'experience', term: 'Experience', value: EXPERIENCE_LEVEL_LABEL[job.experienceLevel] })
  if (job.openings) facts.push({ key: 'openings', term: 'Openings', value: String(job.openings) })
  if (job.startDate) facts.push({ key: 'start', term: 'Start date', value: formatDate(job.startDate) })
  if (job.duration) facts.push({ key: 'duration', term: 'Duration', value: job.duration })
  if (job.applicationDeadline) facts.push({ key: 'deadline', term: 'Deadline', value: formatDate(job.applicationDeadline) })
  if (job.salary?.disclosed) facts.push({ key: 'salary', term: 'Salary', value: formatSalary(job.salary) })

  return (
    <div>
      <BackLink to="/postings">All postings</BackLink>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-4)' }}>
        <div>
          <h1 className="t-display-md">{job.title}</h1>
          <p className="t-body-sm" style={{ color: 'var(--color-text-muted)' }}>
            {job.companyName} · {[job.city, job.country].filter(Boolean).join(', ')}
          </p>
        </div>
        <Pill tone={job.isOpen ? 'positive' : 'neutral'}>{job.isOpen ? 'Open' : 'Closed'}</Pill>
      </div>

      <ApplyCallToAction
        jobId={job.jobId}
        isOpen={job.isOpen}
        authStatus={authStatus}
        existingApplicationId={existingApplication?.applicationId}
        appliedAt={existingApplication?.appliedAt}
      />

      <div style={{ display: 'grid', gap: 'var(--space-5)', marginTop: 'var(--space-6)' }}>
        <div className="glass-dense" style={{ padding: 'var(--space-5)' }}>
          <p className="t-body measure" style={{ whiteSpace: 'pre-wrap' }}>
            {job.description}
          </p>
        </div>

        <div className="glass-dense" style={{ padding: 'var(--space-5)' }}>
          <p className="t-eyebrow" style={{ textTransform: 'uppercase', marginBottom: 'var(--space-3)' }}>
            Details
          </p>
          <DefinitionList items={facts} />
        </div>

        <div className="glass-dense" style={{ padding: 'var(--space-5)' }}>
          <p className="t-eyebrow" style={{ textTransform: 'uppercase', marginBottom: 'var(--space-3)' }}>
            What this posting asks for
          </p>
          <RequirementsPreview requirements={job.documentRequirements} />
        </div>

        {job.skills && job.skills.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            {job.skills.map((skill) => (
              <Tag key={skill}>{skill}</Tag>
            ))}
          </div>
        )}

        <CompanyPanel company={company} />
      </div>
    </div>
  )
}

interface ApplyCallToActionProps {
  jobId: string
  isOpen: boolean
  authStatus: 'loading' | 'signedIn' | 'anonymous'
  existingApplicationId?: string
  appliedAt?: string
}

function ApplyCallToAction({ jobId, isOpen, authStatus, existingApplicationId, appliedAt }: ApplyCallToActionProps) {
  if (authStatus === 'anonymous') {
    return (
      <div style={{ marginTop: 'var(--space-4)' }}>
        <ButtonLink variant="primary" to={`/sign-in?next=${encodeURIComponent(`/postings/${jobId}/apply`)}`}>
          Sign in to apply
        </ButtonLink>
      </div>
    )
  }

  if (existingApplicationId) {
    return (
      <div style={{ marginTop: 'var(--space-4)' }}>
        <p className="t-body-sm" style={{ color: 'var(--color-text-muted)' }}>
          {appliedAt ? `You applied on ${formatDate(appliedAt)}.` : 'You already applied to this posting.'}
        </p>
        <ButtonLink variant="secondary" to={`/applications/${existingApplicationId}`}>
          See your application
        </ButtonLink>
      </div>
    )
  }

  if (!isOpen) {
    return (
      <p className="t-body-sm" style={{ marginTop: 'var(--space-4)', color: 'var(--color-text-muted)' }}>
        This posting is closed.
      </p>
    )
  }

  return (
    <div style={{ marginTop: 'var(--space-4)' }}>
      <ButtonLink variant="primary" to={`/postings/${jobId}/apply`}>
        Apply now
      </ButtonLink>
    </div>
  )
}
