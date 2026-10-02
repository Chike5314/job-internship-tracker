import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Spinner } from '@/ui/Spinner'
import { useAuth } from './AuthProvider'

function FullPageSpinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-9) 0' }}>
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
  if (!identity?.groups.includes(group)) {
    return (
      <div className="glass-dense" style={{ padding: 'var(--space-5)' }}>
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
export function safeNextPath(value: string | null): string {
  if (value && value.startsWith('/') && !value.startsWith('//')) return value
  return '/applications'
}

export function RedirectIfSignedIn({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  if (status === 'signedIn') return <Navigate to="/applications" replace />
  return <>{children}</>
}
