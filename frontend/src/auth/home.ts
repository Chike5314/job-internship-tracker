import type { Identity } from './authApi'

/**
 * Where an account lands when nothing more specific is asked for. It is read
 * from the groups in the token, which is the only thing that says what kind of
 * account this is: the tabs on the sign in form only shape the form's wording.
 */
export function homeFor(identity: Identity | null): string {
  const groups = identity?.groups ?? []
  if (groups.includes('Admins')) return '/admin'
  if (groups.includes('Recruiters')) return '/company'
  return '/dashboard'
}
