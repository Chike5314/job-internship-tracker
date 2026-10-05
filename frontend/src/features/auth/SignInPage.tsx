import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { getCurrentIdentity } from '@/auth/authApi'
import { authErrorMessage } from '@/auth/authErrors'
import { homeFor } from '@/auth/home'
import { safeNextPath } from '@/auth/RouteGuards'
import { Button } from '@/ui/Button'
import { Field } from '@/ui/Field'
import { Input } from '@/ui/Input'
import { AccountTabs, useAccount, type Account } from './AccountTabs'
import { GoogleButton } from './GoogleButton'
import styles from './authPanel.module.css'

export function SignInPage() {
  const [account, setAccount] = useAccount()

  return (
    <div className={styles.panel}>
      <AccountTabs account={account} onChange={setAccount} />
      <SignInForm account={account} />
      <p className={styles.note}>
        Offerline team members are added by an administrator and sign in with email.
      </p>
    </div>
  )
}

function SignInForm({ account }: { account: Account }) {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const location = useLocation()
  // Arriving back from a password reset brings the address it was reset for.
  const [email, setEmail] = useState((location.state as { email?: string } | null)?.email ?? '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const company = account === 'company'

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await signIn({ email, password })
      // The account decides where it lands, never the tab it was signed in
      // from: a company signing in on "I'm looking for work" is still a
      // company. `next` overrides that when the sign-in was prompted by a
      // specific page, e.g. "Sign in to apply" from a posting.
      const who = await getCurrentIdentity()
      navigate(safeNextPath(searchParams.get('next'), homeFor(who)))
    } catch (caught) {
      setError(authErrorMessage(caught))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className={styles.form}>
      <div className={styles.lead}>
        <h1 className={styles.title}>{company ? 'Sign in to your company' : 'Welcome back'}</h1>
        <p className={styles.subtitle}>
          {company ? 'Manage postings and applicants.' : 'Sign in to follow your applications.'}
        </p>
      </div>

      {!company && (
        <>
          <GoogleButton label="Continue with Google" />
          <p className={styles.divider}>or with email</p>
        </>
      )}

      <div className={styles.fields}>
        <Field label={company ? 'Company email' : 'Email'}>
          {(props) => (
            <Input
              {...props}
              className={styles.input}
              type="email"
              autoComplete="email"
              placeholder={company ? 'hiring@company.cm' : 'you@example.com'}
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          )}
        </Field>

        <Field label="Password">
          {(props) => (
            <Input
              {...props}
              className={styles.input}
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          )}
        </Field>

        <button
          type="button"
          className={styles.forgot}
          onClick={() => navigate('/sign-in/reset', { state: { email } })}
        >
          Forgot password?
        </button>
      </div>

      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}

      <Button type="submit" variant="primary" className={styles.submit} loading={submitting}>
        Sign in
      </Button>

      {company ? (
        <>
          <p className={styles.aside}>
            Company accounts sign in with email. Google sign-in is for applicants, because a Google
            account belongs to a person.
          </p>
          <p className={styles.swap}>
            New to Offerline?{' '}
            <button type="button" onClick={() => navigate('/sign-up?account=company')}>
              Register your company
            </button>
          </p>
        </>
      ) : (
        <p className={styles.swap}>
          Don't have an account?{' '}
          <button type="button" onClick={() => navigate('/sign-up')}>
            Create one
          </button>
        </p>
      )}
    </form>
  )
}
