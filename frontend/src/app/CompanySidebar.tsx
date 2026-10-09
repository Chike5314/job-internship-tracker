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
  // Every posting, drafts and closed ones included, as the company boards count it.
  const postingCount = postings?.jobs.length ?? 0
  const unread = notifications?.count ?? 0

  const destinations: RailDestination[] = [
    { to: '/company', label: 'Overview', icon: 'analytics', end: true },
    { to: '/company/postings', label: 'Postings', icon: 'posting', count: postingCount },
    { to: '/company/applicants', label: 'Applicants', icon: 'person' },
    { to: '/company/interviews', label: 'Interviews', icon: 'interview' },
    { to: '/company/analytics', label: 'Analytics', icon: 'trend' },
    { to: '/company/notifications', label: 'Notifications', icon: 'bell', count: unread, urgent: true },
    { to: '/company/profile', label: 'Company profile', icon: 'company' },
  ]

  return (
    <SideRail
      home="/company"
      homeLabel="Offerline company home"
      section="COMPANY"
      destinations={destinations}
      navLabel="Company"
      identity={
        <RailIdentity
          organisation
          profileTo="/company/profile"
          profileLabel="Update company profile"
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
