import { Link } from 'react-router-dom'
import { PageHeader } from '@/ui/PageHeader'
import { Skeleton } from '@/ui/Skeleton'
import { ErrorState } from '@/ui/ErrorState'
import { ProfileForm } from './ProfileForm'
import { TranscriptCard } from './TranscriptCard'
import { useProfile } from './useProfile'

export function ProfilePage() {
  const { data, isLoading, isError } = useProfile()

  return (
    <div>
      <PageHeader title="Profile" />
      {isLoading && <Skeleton height={320} radius="var(--radius-xl)" />}
      {isError && <ErrorState body="Could not load your profile." />}
      {data && (
        <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
          <ProfileForm profile={data.profile} />
          <TranscriptCard profile={data.profile} />
          <div className="glass-dense" style={{ padding: 'var(--space-4)' }}>
            <p className="t-body-sm">
              {data.profile.cvCount} {data.profile.cvCount === 1 ? 'CV' : 'CVs'} uploaded
            </p>
            <Link to="/profile/cvs" className="t-body-sm" style={{ color: 'var(--color-text-link)', textDecoration: 'underline' }}>
              Manage CVs
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
