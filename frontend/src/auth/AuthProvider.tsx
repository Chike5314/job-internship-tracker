import { Hub } from 'aws-amplify/utils'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  confirmSignUpWithCode,
  getCurrentIdentity,
  resendCode,
  signInWithPassword,
  signOutLocally,
  signUpApplicant,
  signUpCompany,
  type Identity,
} from './authApi'

type Status = 'loading' | 'signedIn' | 'anonymous'

interface AuthContextValue {
  status: Status
  identity: Identity | null
  signIn: typeof signInWithPassword
  signUp: typeof signUpApplicant
  signUpCompany: typeof signUpCompany
  confirmSignUp: typeof confirmSignUpWithCode
  resendCode: typeof resendCode
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading')
  const [identity, setIdentity] = useState<Identity | null>(null)
  const queryClient = useQueryClient()

  const refresh = useCallback(async () => {
    const current = await getCurrentIdentity()
    setIdentity(current)
    setStatus(current ? 'signedIn' : 'anonymous')
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    // Every consumer of a protected route waits on status !== 'loading',
    // so there is no flash of the sign-in screen for an already
    // signed-in visitor while this resolves.
    const unsubscribe = Hub.listen('auth', ({ payload }) => {
      // 'signInWithRedirect' fires once an OAuth flow completes; not used
      // this phase (no `oauth` block configured), kept for when Google
      // federation is added later so this doesn't need revisiting then.
      if (payload.event === 'signedIn' || payload.event === 'signInWithRedirect') {
        refresh()
      }
      if (payload.event === 'signedOut') {
        setIdentity(null)
        setStatus('anonymous')
        // One person's applications must not linger in memory and
        // reappear for the next person on a shared machine.
        queryClient.clear()
      }
      if (payload.event === 'tokenRefresh_failure') {
        setIdentity(null)
        setStatus('anonymous')
        queryClient.clear()
      }
    })
    return unsubscribe
  }, [refresh, queryClient])

  const signOut = useCallback(async () => {
    await signOutLocally()
  }, [])

  const value = useMemo(
    () => ({
      status,
      identity,
      signIn: signInWithPassword,
      signUp: signUpApplicant,
      signUpCompany,
      confirmSignUp: confirmSignUpWithCode,
      resendCode,
      signOut,
    }),
    [status, identity, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
