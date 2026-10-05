import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { confirmNewPassword, getCurrentIdentity } from '@/auth/authApi'
import { meetsPasswordPolicy, MIN_PASSWORD_LENGTH } from '@/auth/passwordRules'
import { authErrorMessage } from '@/auth/authErrors'
import { homeFor } from '@/auth/home'
import { safeNextPath } from '@/auth/RouteGuards'
import { Button } from '@/ui/Button'
import { Field } from '@/ui/Field'
import { Input } from '@/ui/Input'
import { AccountTabs, useAccount, type Account } from './AccountTabs'
import { GoogleButton } from './GoogleButton'
import { PasswordRulesList } from './PasswordRulesList'
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
  const [needsNewPassword, setNeedsNewPassword] = useState(false)

  const company = account === 'company'

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const outcome = await signIn({ email, password })
      if (outcome === 'new-password') {
        setNeedsNewPassword(true)
        return
      }
      // The account decides where it lands, never the tab it was signed in
      // from: a company signing in on "I'm looking for work" is still a
      // company. `next` overrides that when the sign-in was prompted by a
      // specific page, e.g. "Sign in to apply" from a posting.
      await goHome()
    } catch (caught) {
      setError(authErrorMessage(caught))
    } finally {
      setSubmitting(false)
    }
  }

  async function goHome() {
    const who = await getCurrentIdentity()
    navigate(safeNextPath(searchParams.get('next'), homeFor(who)))
  }

  if (needsNewPassword) return <NewPasswordForm email={email} onDone={goHome} />

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

/**
 * The first sign in of an account an admin created. The temporary password
 * has already been accepted; Cognito holds the sign in open until the account
 * sets a password of its own.
 */
function NewPasswordForm({ email, onDone }: { email: string; onDone: () => Promise<void> }) {
  const [password, setPassword] = useState('')
  const [attempted, setAttempted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const passwordError =
    attempted && !meetsPasswordPolicy(password)
      ? password
        ? 'This password does not meet every rule below.'
        : 'Choose a password.'
      : undefined

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setAttempted(true)
    setError(null)
    if (!meetsPasswordPolicy(password)) return
    setSubmitting(true)
    try {
      await confirmNewPassword(password)
      await onDone()
    } catch (caught) {
      setError(authErrorMessage(caught))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className={styles.form} noValidate>
      <div className={styles.lead}>
        <h1 className={styles.title}>Choose your password</h1>
        <p className={styles.subtitle}>
          {email} was set up by the Offerline team with a temporary password. Choose one of your own to
          finish signing in.
        </p>
      </div>

      <div className={styles.fields}>
        <Field label="New password" hint={`${MIN_PASSWORD_LENGTH} characters or more`} error={passwordError}>
          {(props) => (
            <Input
              {...props}
              className={styles.input}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoFocus
            />
          )}
        </Field>
        {passwordError && password && <PasswordRulesList password={password} />}
      </div>

      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}

      <Button type="submit" variant="primary" className={styles.submit} loading={submitting}>
        Set password and sign in
      </Button>
    </form>
  )
}
