import { useQuery } from '@tanstack/react-query'
import { getAdminOverview, listCompaniesByStatus } from '@/api/admin'
import type { VerificationStatus } from '@/api/enums'
import { queryKeys } from '@/api/queryKeys'
import { useAuth } from '@/auth/AuthProvider'

/** True only for an account in the Admins group, which every admin route needs. */
export function useIsAdmin(): boolean {
  const { identity } = useAuth()
  return Boolean(identity?.groups.includes('Admins'))
}

/** The overview, which the rail also reads for the size of the queue. */
export function useAdminOverview() {
  const isAdmin = useIsAdmin()
  return useQuery({
    queryKey: queryKeys.admin.overview(),
    queryFn: () => getAdminOverview(),
    enabled: isAdmin,
    staleTime: 60_000,
  })
}

/** Every company at one standing. The overview and the companies page share
 *  these, so moving between them costs no second request. */
export function useCompaniesByStatus(status: VerificationStatus) {
  const isAdmin = useIsAdmin()
  return useQuery({
    queryKey: queryKeys.admin.companies(status),
    queryFn: () => listCompaniesByStatus(status),
    enabled: isAdmin,
    staleTime: 30_000,
  })
}
