import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  amendApplication,
  changeApplicationStatus,
  getApplication,
  listMyApplications,
  respondToInterview,
} from '@/api/applications'
import { queryKeys } from '@/api/queryKeys'
import { useAuth } from '@/auth/AuthProvider'

export function useMyApplications() {
  const { status } = useAuth()
  return useQuery({
    queryKey: queryKeys.applications.mine(),
    queryFn: () => listMyApplications(),
    staleTime: 30_000,
    enabled: status === 'signedIn',
  })
}

export function useApplication(applicationId: string) {
  return useQuery({
    queryKey: queryKeys.applications.detail(applicationId),
    // documentUrls are five-minute presigned GETs, so this is kept short
    // and refetches on window focus (the query client default) rather
    // than being held indefinitely.
    queryFn: () => getApplication(applicationId),
    staleTime: 30_000,
  })
}

export function useRespondToOffer(applicationId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (status: 'OFFER_ACCEPTED' | 'OFFER_DECLINED') => changeApplicationStatus(applicationId, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.applications.detail(applicationId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.applications.mine() })
    },
  })
}

export function useWithdrawApplication(applicationId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => changeApplicationStatus(applicationId, { status: 'WITHDRAWN' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.applications.detail(applicationId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.applications.mine() })
    },
  })
}

export function useRespondToInterview(applicationId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (action: 'CONFIRM' | 'DECLINE') => respondToInterview(applicationId, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.applications.detail(applicationId) })
    },
  })
}

export function useAmendApplication(applicationId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (params: Parameters<typeof amendApplication>[1]) => amendApplication(applicationId, params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.applications.detail(applicationId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.applications.mine() })
    },
  })
}
