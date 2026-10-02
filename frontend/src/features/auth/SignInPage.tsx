import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { authErrorMessage } from '@/auth/authErrors'
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
      <p className={['t-caption', styles.note].join(' ')}>
        Offerline team members are added by an administrator and sign in with email.
      </p>
    </div>
  )
}

function SignInForm({ account }: { account: Account }) {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
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
      // A recruiter's home is the company app; an applicant's is the dashboard.
      navigate(company ? '/company' : '/dashboard')
    } catch (caught) {
      setError(authErrorMessage(caught))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className={styles.panel}>
      <div className={styles.lead}>
        <h1 className="t-heading-lg">{company ? 'Sign in to your company' : 'Welcome back'}</h1>
        <p className={['t-body-sm', styles.subtitle].join(' ')}>
          {company ? 'Manage postings and applicants.' : 'Sign in to follow your applications.'}
        </p>
      </div>

      {!company && (
        <>
          <GoogleButton label="Continue with Google" />
          <p className={styles.divider}>or with email</p>
        </>
      )}

      <Field label={company ? 'Company email' : 'Email'}>
        {(props) => (
          <Input
            {...props}
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        )}
      </Field>

      <Field label="Password" error={error ?? undefined}>
        {(props) => (
          <Input
            {...props}
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
        onClick={() => navigate('/sign-in/reset')}
      >
        Forgot password?
      </button>

      <Button type="submit" variant="primary" loading={submitting}>
        Sign in
      </Button>

      {company ? (
        <>
          <p className={['t-body-sm', styles.aside].join(' ')}>
            Company accounts sign in with email. Google sign-in is for applicants, because a Google
            account belongs to a person.
          </p>
          <p className={['t-body-sm', styles.swap].join(' ')}>
            New to Offerline?{' '}
            <button type="button" onClick={() => navigate('/sign-up?account=company')}>
              Register your company
            </button>
          </p>
        </>
      ) : (
        <p className={['t-body-sm', styles.swap].join(' ')}>
          Don't have an account?{' '}
          <button type="button" onClick={() => navigate('/sign-up')}>
            Create one
          </button>
        </p>
      )}
    </form>
  )
}
