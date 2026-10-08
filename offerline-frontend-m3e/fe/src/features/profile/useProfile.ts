import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  confirmCvUpload,
  createProfileUploadUrl,
  getProfile,
  listCvs,
  updateProfile,
} from '@/api/profile'
import { putToPresignedUrl, resolveContentType } from '@/api/uploads'
import { queryKeys } from '@/api/queryKeys'
import { useAuth } from '@/auth/AuthProvider'

export function useProfile() {
  const { status } = useAuth()
  return useQuery({
    queryKey: queryKeys.profile.me(),
    queryFn: () => getProfile(),
    staleTime: 5 * 60_000,
    enabled: status === 'signedIn',
  })
}

export function useUpdateProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (params: Parameters<typeof updateProfile>[0]) => updateProfile(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.me() })
    },
  })
}

export function useCvs() {
  const { status } = useAuth()
  return useQuery({
    queryKey: queryKeys.profile.cvs(),
    queryFn: () => listCvs(),
    staleTime: 30_000,
    enabled: status === 'signedIn',
  })
}

/**
 * Three steps, in order, and all three are required: ask for a URL, PUT the file
 * straight to S3, then confirm. Nothing is in the CV library until the confirm
 * call, which is what keeps an abandoned or failed upload from leaving an entry
 * behind pointing at a key with no file at it. Skip the confirm and the upload
 * succeeds while the library stays empty.
 */
export function useUploadCv() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ file, label }: { file: File; label?: string }) => {
      const contentType = resolveContentType(file)
      const upload = await createProfileUploadUrl({
        documentKind: 'cv',
        fileName: file.name,
        contentType,
        fileSize: file.size,
        ...(label ? { label } : {}),
      })
      await putToPresignedUrl(upload.uploadUrl, file, contentType)
      const { cv } = await confirmCvUpload({
        s3Key: upload.s3Key,
        ...(label ? { label } : {}),
      })
      return cv
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.cvs() })
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.me() })
    },
  })
}

export function useUploadTranscript() {
  const queryClient = useQueryClient()
  const updateProfileMutation = useUpdateProfile()
  return useMutation({
    mutationFn: async (file: File) => {
      const contentType = resolveContentType(file)
      const upload = await createProfileUploadUrl({
        documentKind: 'transcript',
        fileName: file.name,
        contentType,
        fileSize: file.size,
      })
      await putToPresignedUrl(upload.uploadUrl, file, contentType)
      // The third call is what attaches it: skipping this uploads a file
      // that nothing points at.
      await updateProfileMutation.mutateAsync({ transcriptS3Key: upload.s3Key })
      return upload
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.me() })
    },
  })
}
