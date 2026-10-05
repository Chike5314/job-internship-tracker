import type { ReactNode } from 'react'
import { Navigate, useLocation, useSearchParams } from 'react-router-dom'
import { Spinner } from '@/ui/Spinner'
import { Logo } from '@/app/Logo'
import { useAuth } from './AuthProvider'
import { homeFor } from './home'
import styles from './RouteGuards.module.css'

/** The first thing a returning visitor sees while their session is read, so it
 *  carries the mark rather than a bare spinner. */
function FullPageSpinner() {
  return (
    <div className={styles.loading}>
      <Logo variant="mark" height={44} />
      <Spinner label="Loading" />
    </div>
  )
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <FullPageSpinner />
  if (status === 'anonymous') {
    const next = `${location.pathname}${location.search}`
    return <Navigate to={`/sign-in?next=${encodeURIComponent(next)}`} replace />
  }
  return <>{children}</>
}

/**
 * Wraps RequireAuth and additionally checks group membership. Written as a
 * group-name check rather than a boolean so a later RequireRecruiter is a
 * one-line addition.
 */
export function RequireGroup({ group, children }: { group: string; children: ReactNode }) {
  return (
    <RequireAuth>
      <RequireGroupInner group={group}>{children}</RequireGroupInner>
    </RequireAuth>
  )
}

function RequireGroupInner({ group, children }: { group: string; children: ReactNode }) {
  const { identity } = useAuth()
  const location = useLocation()
  if (!identity?.groups.includes(group)) {
    // Somebody whose account belongs somewhere else, a company opening the
    // applicant dashboard from a bookmark say, is taken to their own home.
    // Only an account with no home of its own here sees the notice.
    const home = homeFor(identity)
    if (home !== location.pathname) return <Navigate to={home} replace />
    return (
      <div className="glass-soft" style={{ padding: 'var(--space-5)' }}>
        <p className="t-body">This area is for {group.toLowerCase()} accounts.</p>
      </div>
    )
  }
  return <>{children}</>
}

export function RequireApplicant({ children }: { children: ReactNode }) {
  return <RequireGroup group="Applicants">{children}</RequireGroup>
}

/** Validated as a same-origin path before use: an unchecked `next` is an
 * open redirect. */
export function safeNextPath(value: string | null, fallback: string): string {
  if (value && value.startsWith('/') && !value.startsWith('//')) return value
  return fallback
}

/**
 * A recruiter's home is the company app; an applicant's is the dashboard.
 * Without `next`, that is where this sends someone who is already signed in
 * and lands on an auth route anyway (a bookmark, a back button). With `next`
 * set, it honours the page they were actually trying to reach, e.g. "Sign in
 * to apply" from a posting.
 */
export function RedirectIfSignedIn({ children }: { children: ReactNode }) {
  const { status, identity } = useAuth()
  const [searchParams] = useSearchParams()
  if (status === 'signedIn') {
    return <Navigate to={safeNextPath(searchParams.get('next'), homeFor(identity))} replace />
  }
  return <>{children}</>
}
