import { Hub } from 'aws-amplify/utils'

// ?anon=1 starts signed out; confirming a sign-up code signs in, as Cognito's
// auto sign-in does, as whichever kind of account was just created.
let signedInAs: 'applicant' | 'company' | null = new URLSearchParams(location.search).get('anon')
  ? null
  : 'applicant'
let pendingKind: 'applicant' | 'company' = 'applicant'

function cognitoError(name: string): Error {
  const error = new Error(name)
  error.name = name
  return error
}

export interface Identity {
  userId: string
  email: string
  fullName: string
  groups: string[]
  isApplicant: boolean
}

export async function getIdToken(): Promise<string | null> {
  return 'harness-token'
}

export async function getCurrentIdentity(): Promise<Identity | null> {
  const params = new URLSearchParams(location.search)
  // ?slowauth=1 holds the session check open so the loading screen can be seen.
  if (params.get('slowauth')) await new Promise((resolve) => setTimeout(resolve, 6000))
  // ?crash=1 hands back an identity with no group list, so the guard throws.
  if (params.get('crash')) {
    return { userId: 'x', email: 'x@example.com', fullName: 'X', groups: null as unknown as string[], isApplicant: true }
  }
  if (!signedInAs) return null
  if (params.get('as') === 'admin') {
    return {
      userId: 'harness-admin',
      email: 'ops@offerline.example.com',
      fullName: 'Ngozi Ade',
      groups: ['Admins'],
      isApplicant: false,
    }
  }
  if (params.get('as') === 'recruiter' || signedInAs === 'company') {
    return {
      userId: 'harness-company',
      email: 'hiring@kora.example.com',
      fullName: 'Kora Systems',
      groups: ['Recruiters'],
      isApplicant: false,
    }
  }
  return {
    userId: 'harness-applicant',
    email: 'amara.nkeng@example.com',
    fullName: 'Amara Nkeng',
    groups: ['Applicants'],
    isApplicant: true,
  }
}

export async function signInWithGoogle(): Promise<void> {}
export async function signUpApplicant(): Promise<void> {
  pendingKind = 'applicant'
}
export async function signUpCompany(): Promise<void> {
  pendingKind = 'company'
}
export async function confirmSignUpWithCode(params: { code: string }): Promise<void> {
  if (params.code === '000000') throw cognitoError('CodeMismatchException')
  signedInAs = pendingKind
  Hub.dispatch('auth', { event: 'signedIn' })
}
export async function resendCode(): Promise<void> {}
export async function requestPasswordReset(): Promise<void> {}
export async function confirmPasswordReset(params: { code: string }): Promise<void> {
  if (params.code === '000000') throw cognitoError('CodeMismatchException')
}
export async function signInWithPassword(params: { email: string }): Promise<'done' | 'new-password'> {
  if (/welcome/i.test(params.email)) return 'new-password'
  signedInAs = /robotics|hiring/i.test(params.email) ? 'company' : 'applicant'
  Hub.dispatch('auth', { event: 'signedIn' })
  return 'done'
}
export async function confirmNewPassword(): Promise<void> {
  signedInAs = 'company'
  Hub.dispatch('auth', { event: 'signedIn' })
}
export async function signOutLocally(): Promise<void> {}
