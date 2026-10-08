import { useAuth } from '@/auth/AuthProvider'
import { useMyApplications } from '@/features/applications/useApplications'
import { useNotifications } from '@/features/notifications/useNotifications'
import { SideRail, type RailDestination } from './SideRail'
import { RailIdentity } from './RailIdentity'

export function ApplicantSidebar() {
  const { identity } = useAuth()
  const { data: applications } = useMyApplications()
  const { data: notifications } = useNotifications(true)

  const openApplications = applications?.applications.length ?? 0
  const unread = notifications?.count ?? 0

  // Jobs and Internships are one route told apart by the type filter, so each
  // one decides its own active state from the query rather than the path.
  const isInternships = (search: string) => search.includes('INTERNSHIP')

  const destinations: RailDestination[] = [
    { to: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
    {
      to: '/postings?type=FULL_TIME_JOB',
      label: 'Jobs',
      icon: 'job',
      match: ({ pathname, search }) => pathname === '/postings' && !isInternships(search),
    },
    {
      to: '/postings?type=PROFESSIONAL_INTERNSHIP',
      label: 'Internships',
      icon: 'internship',
      match: ({ pathname, search }) => pathname === '/postings' && isInternships(search),
    },
    { to: '/applications', label: 'Applications', icon: 'applications', count: openApplications },
    { to: '/profile/cvs', label: 'CVs and documents', icon: 'folder' },
    { to: '/notifications', label: 'Notifications', icon: 'bell', count: unread, urgent: true },
  ]

  // end: true, or "/profile" (a prefix of "/profile/cvs") would also light up
  // Settings while looking at CVs and documents.
  const secondary: RailDestination[] = [{ to: '/profile', label: 'Settings', icon: 'settings', end: true }]

  return (
    <SideRail
      home="/dashboard"
      homeLabel="Offerline home"
      destinations={destinations}
      secondary={secondary}
      navLabel="Applicant"
      identity={<RailIdentity name={identity?.fullName ?? ''} subtitle="Applicant" />}
    />
  )
}
