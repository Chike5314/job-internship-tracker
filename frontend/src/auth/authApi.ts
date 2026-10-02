import {
  confirmSignUp,
  fetchAuthSession,
  getCurrentUser,
  resendSignUpCode,
  signIn,
  signOut,
  signUp,
  autoSignIn,
  signInWithRedirect,
} from 'aws-amplify/auth'
import type { AccountType } from './accountType'

export interface Identity {
  userId: string
  email: string
  fullName: string
  groups: string[]
  isApplicant: boolean
}

/**
 * The only place a token is produced. Nothing caches it here: Amplify
 * refreshes from the refresh token when the ID token is inside its expiry
 * window (one hour against a thirty day refresh token), so caching it
 * ourselves would reintroduce the expiry problem Amplify already solves.
 *
 * The ID token, not the access token: src/common/auth.py reads `email` and
 * `name` from the claims, and only the ID token carries them.
 */
export async function getIdToken(): Promise<string | null> {
  const { tokens } = await fetchAuthSession()
  return tokens?.idToken?.toString() ?? null
}

// cognito:groups arrives as an array in some token shapes and a
// comma-joined string in others, mirroring _split_groups in
// src/common/auth.py.
function toGroupArray(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String)
  if (typeof raw === 'string' && raw) return raw.split(',').map((g) => g.trim())
  return []
}

export async function getCurrentIdentity(): Promise<Identity | null> {
  try {
    await getCurrentUser()
  } catch {
    return null
  }

  const { tokens } = await fetchAuthSession()
  const payload = tokens?.idToken?.payload
  if (!payload?.sub) return null

  const groups = toGroupArray(payload['cognito:groups'])
  return {
    userId: String(payload.sub),
    email: String(payload.email ?? ''),
    fullName: String(payload.name ?? ''),
    groups,
    isApplicant: groups.includes('Applicants'),
  }
}

/**
 * Federated sign-in through the pool's Google provider.
 *
 * This needs an `oauth` block in the Amplify config and the Google identity
 * provider on the pool. Until both are in place the call rejects, and the
 * button says so rather than failing silently.
 */
export async function signInWithGoogle(): Promise<void> {
  await signInWithRedirect({ provider: 'Google' })
}

export async function signUpApplicant(params: {
  email: string
  password: string
  fullName: string
}): Promise<{ nextStep: string }> {
  // custom:accountType is always written explicitly, never inferred. This
  // phase only ever signs up applicants, but the field is required by the
  // identity trigger (src/handlers/identity_service/handler.py) regardless.
  const accountType: AccountType = 'individual'
  const result = await signUp({
    username: params.email,
    password: params.password,
    options: {
      userAttributes: { email: params.email, name: params.fullName, 'custom:accountType': accountType },
      autoSignIn: true,
    },
  })
  return { nextStep: result.nextStep.signUpStep }
}

/**
 * A company account. The identity trigger reads `custom:accountType`, so the
 * company and the individual paths differ by that attribute rather than by any
 * inference from the address, and the organisation's own record is created
 * after confirmation, once there is a signed-in caller to own it.
 */
export async function signUpCompany(params: {
  email: string
  password: string
  companyName: string
}): Promise<{ nextStep: string }> {
  const accountType: AccountType = 'company'
  const result = await signUp({
    username: params.email,
    password: params.password,
    options: {
      userAttributes: {
        email: params.email,
        name: params.companyName,
        'custom:accountType': accountType,
      },
      autoSignIn: true,
    },
  })
  return { nextStep: result.nextStep.signUpStep }
}

export async function confirmSignUpWithCode(params: { email: string; code: string }): Promise<void> {
  const result = await confirmSignUp({ username: params.email, confirmationCode: params.code })
  // The pool auto-verifies email and the POST_CONFIRMATION trigger (which
  // assigns the Applicants group) hangs off this confirmation step, so an
  // unconfirmed account has no group yet and every authenticated call
  // would 403. autoSignIn completes the sign-up flow started above.
  if (result.nextStep.signUpStep === 'COMPLETE_AUTO_SIGN_IN') {
    await autoSignIn()
  }
}

export async function resendCode(params: { email: string }): Promise<void> {
  await resendSignUpCode({ username: params.email })
}

export async function signInWithPassword(params: { email: string; password: string }): Promise<void> {
  // Named explicitly even though it's Amplify's default: the app client
  // allows only ALLOW_USER_SRP_AUTH (persistence_stack.py), so being
  // explicit here turns a future auth-flow config change into a clear
  // error at this one line instead of a silent attempt at a flow the pool
  // refuses.
  await signIn({
    username: params.email,
    password: params.password,
    options: { authFlowType: 'USER_SRP_AUTH' },
  })
}

export async function signOutLocally(): Promise<void> {
  await signOut()
}
