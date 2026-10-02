import { Icon } from '@/ui/Icon'
import { useAuth } from '@/auth/AuthProvider'
import { useMyCompany, useMyPostings } from '@/features/company/useCompany'
import { useNotifications } from '@/features/notifications/useNotifications'
import { SideRail, type RailDestination } from './SideRail'
import { RailIdentity } from './RailIdentity'
import styles from './CompanySidebar.module.css'

export function CompanySidebar() {
  const { identity } = useAuth()
  const { data: company } = useMyCompany()
  const { data: postings } = useMyPostings()
  const { data: notifications } = useNotifications(true)

  const verified = company?.company.verificationStatus === 'VERIFIED'
  const published = (postings?.jobs ?? []).filter((job) => job.postingStatus === 'PUBLISHED').length
  const unread = notifications?.count ?? 0

  const destinations: RailDestination[] = [
    { to: '/company', label: 'Overview', icon: 'analytics', end: true },
    { to: '/company/postings', label: 'Postings', icon: 'posting', count: published },
    { to: '/company/interviews', label: 'Interviews', icon: 'interview' },
    { to: '/company/analytics', label: 'Analytics', icon: 'trend' },
    { to: '/company/notifications', label: 'Notifications', icon: 'bell', count: unread, urgent: true },
  ]

  const secondary: RailDestination[] = [
    { to: '/company/profile', label: 'Company profile', icon: 'company' },
  ]

  return (
    <SideRail
      home="/company"
      homeLabel="Offerline company home"
      section="Company"
      destinations={destinations}
      secondary={secondary}
      navLabel="Company"
      identity={
        <RailIdentity
          name={company?.company.companyName ?? identity?.fullName ?? ''}
          subtitle={
            company ? (
              <span className={verified ? styles.verified : styles.pending}>
                <Icon name={verified ? 'verified' : 'pending'} size={13} />
                {verified ? 'Verified company' : 'Waiting for verification'}
              </span>
            ) : (
              'Company'
            )
          }
        />
      }
    />
  )
}
