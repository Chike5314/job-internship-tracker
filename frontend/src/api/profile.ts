import { http } from './http'
import type { CvEntry, PendingCv, Profile, UploadUrlResponse } from './types'

export function getProfile(): Promise<{ profile: Profile }> {
  return http.get('/profile')
}

// Two naming traps: this takes profilePicUrl / transcriptS3Key as S3 KEYS
// despite the name, while getProfile() (above) returns profilePictureUrl /
// transcriptUrl as presigned URLs. Different names in and out, on purpose.
export function updateProfile(params: {
  fullName?: string
  phone?: string
  skills?: string[]
  academicInfo?: { schoolName?: string; fieldOfStudy?: string; degreeLevel?: string }
  profilePicUrl?: string
  transcriptS3Key?: string
}): Promise<{ profile: Profile }> {
  return http.post('/profile', { body: params })
}

export function createProfileUploadUrl(params: {
  documentKind: 'cv' | 'transcript' | 'profilePicture'
  fileName: string
  contentType: string
  fileSize: number
  label?: string
}): Promise<UploadUrlResponse & { cv?: PendingCv }> {
  return http.post('/profile/upload-url', { body: params })
}

/**
 * Records the CV in the library, and must be called after the presigned PUT has
 * finished. Asking for the URL does not record anything: the transfer goes
 * straight from the browser to S3, so the API only learns that it happened when
 * this call tells it, and it checks the object is really there before writing.
 * Safe to call again on a retry; the same upload confirms to the same entry.
 */
export function confirmCvUpload(params: {
  s3Key: string
  label?: string
}): Promise<{ cv: CvEntry }> {
  return http.post('/profile/cvs', { body: params })
}

export function listCvs(): Promise<{ cvs: CvEntry[]; totalUploaded: number }> {
  return http.get('/profile/cvs')
}
