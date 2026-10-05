import { Icon } from '@/ui/Icon'
import { useAuth } from '@/auth/AuthProvider'
import { useAdminOverview } from '@/features/admin/useAdmin'
import { SideRail, type RailDestination } from './SideRail'
import { RailIdentity } from './RailIdentity'
import styles from './AdminSidebar.module.css'

/**
 * The admin rail. The work is moderation, so Companies carries the size of the
 * verification queue as the one count on the rail waiting on the viewer.
 */
export function AdminSidebar() {
  const { identity } = useAuth()
  const { data: overview } = useAdminOverview()
  const awaiting = overview?.awaitingVerification ?? 0

  const destinations: RailDestination[] = [
    { to: '/admin', label: 'Overview', icon: 'dashboard', end: true },
    { to: '/admin/companies', label: 'Companies', icon: 'company', count: awaiting, urgent: true },
    { to: '/admin/postings', label: 'Postings', icon: 'posting' },
  ]

  return (
    <SideRail
      home="/admin"
      homeLabel="Offerline admin home"
      section="ADMIN"
      destinations={destinations}
      navLabel="Admin"
      identity={
        <RailIdentity
          name={identity?.fullName || identity?.email || ''}
          subtitle={
            <span className={styles.role}>
              <Icon name="admin" size={13} />
              Administrator
            </span>
          }
        />
      }
    />
  )
}
