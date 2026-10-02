import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { authErrorMessage } from '@/auth/authErrors'
import { meetsPasswordPolicy } from '@/auth/passwordRules'
import { Button } from '@/ui/Button'
import { Field } from '@/ui/Field'
import { Input } from '@/ui/Input'
import { PasswordRulesList } from './PasswordRulesList'
import { AccountTabs, useAccount } from './AccountTabs'
import { GoogleButton } from './GoogleButton'
import styles from './authPanel.module.css'

const PASSWORD_HINT = '10 characters or more'

export function SignUpPage() {
  const [account, setAccount] = useAccount()

  return (
    <div className={styles.panel}>
      <AccountTabs account={account} onChange={setAccount} />
      {account === 'applicant' ? <ApplicantSignUp /> : <CompanySignUp />}
      <p className={['t-caption', styles.note].join(' ')}>
        Offerline team members are added by an administrator and sign in with email.
      </p>
    </div>
  )
}

function ApplicantSignUp() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showRules, setShowRules] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (!meetsPasswordPolicy(password)) {
      setShowRules(true)
      setError('Meet every password requirement below before continuing.')
      return
    }

    setSubmitting(true)
    try {
      await signUp({ email, password, fullName })
      navigate('/sign-up/confirm', { state: { email } })
    } catch (caught) {
      setError(authErrorMessage(caught))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className={styles.panel}>
      <div className={styles.lead}>
        <h1 className="t-heading-lg">Create your account</h1>
        <p className={['t-body-sm', styles.subtitle].join(' ')}>
          One profile for jobs and every kind of internship.
        </p>
      </div>

      <GoogleButton label="Continue with Google" />
      <p className={styles.divider}>or with email</p>

      <Field label="Full name">
        {(props) => (
          <Input
            {...props}
            autoComplete="name"
            required
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
          />
        )}
      </Field>

      <Field label="Email">
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

      <Field label="Password" hint={PASSWORD_HINT} error={error ?? undefined}>
        {(props) => (
          <Input
            {...props}
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        )}
      </Field>

      {/* The full list appears once a password has actually been refused, so
          the form stays one short column until it has something to say. */}
      {showRules && <PasswordRulesList password={password} />}

      <Button type="submit" variant="primary" loading={submitting}>
        Create account
      </Button>

      <SwapLink prompt="Already have an account?" to="/sign-in" label="Sign in" />
    </form>
  )
}

function CompanySignUp() {
  const { signUpCompany } = useAuth()
  const navigate = useNavigate()
  const [companyName, setCompanyName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showRules, setShowRules] = useState(false)
  const [companyWebsiteUrl, setCompanyWebsiteUrl] = useState('')
  const [officeAddress, setOfficeAddress] = useState('')
  const [googleMapsUrl, setGoogleMapsUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (!/^https:\/\//i.test(companyWebsiteUrl)) {
      setError('The website address has to start with https://.')
      return
    }

    if (!meetsPasswordPolicy(password)) {
      setShowRules(true)
      setError('Meet every password requirement below before continuing.')
      return
    }

    setSubmitting(true)
    try {
      await signUpCompany({ email: contactEmail, password, companyName })
      // The company's own record needs a signed-in caller to own it, so it is
      // created after the code is confirmed rather than here. The details ride
      // along to the confirmation step.
      navigate('/sign-up/confirm', {
        state: {
          email: contactEmail,
          company: {
            companyName,
            contactEmail,
            companyWebsiteUrl,
            officeAddress: officeAddress || undefined,
            googleMapsUrl: googleMapsUrl || undefined,
          },
        },
      })
    } catch (caught) {
      setError(authErrorMessage(caught))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className={styles.panel}>
      <div className={styles.lead}>
        <h1 className="t-heading-lg">Register your company</h1>
        <p className={['t-body-sm', styles.subtitle].join(' ')}>
          An administrator checks these details, then your postings can go live.
        </p>
      </div>

      <Field label="Company name">
        {(props) => (
          <Input
            {...props}
            autoComplete="organization"
            required
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
          />
        )}
      </Field>

      <Field label="Contact email">
        {(props) => (
          <Input
            {...props}
            type="email"
            autoComplete="email"
            required
            value={contactEmail}
            onChange={(event) => setContactEmail(event.target.value)}
          />
        )}
      </Field>

      <Field label="Password" hint={PASSWORD_HINT}>
        {(props) => (
          <Input
            {...props}
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        )}
      </Field>

      {showRules && <PasswordRulesList password={password} />}

      <Field label="Website" hint="Starts with https://">
        {(props) => (
          <Input
            {...props}
            type="url"
            autoComplete="url"
            required
            placeholder="https://"
            value={companyWebsiteUrl}
            onChange={(event) => setCompanyWebsiteUrl(event.target.value)}
          />
        )}
      </Field>

      <Field label="Office address">
        {(props) => (
          <Input
            {...props}
            autoComplete="street-address"
            placeholder="Street, area, city"
            value={officeAddress}
            onChange={(event) => setOfficeAddress(event.target.value)}
          />
        )}
      </Field>

      <Field label="Google Maps link" error={error ?? undefined}>
        {(props) => (
          <Input
            {...props}
            type="url"
            placeholder="https://maps.google.com/"
            value={googleMapsUrl}
            onChange={(event) => setGoogleMapsUrl(event.target.value)}
          />
        )}
      </Field>

      <Button type="submit" variant="primary" loading={submitting}>
        Register company
      </Button>

      <p className={['t-body-sm', styles.aside].join(' ')}>
        Company accounts sign in with email. Google sign-in is for applicants, because a Google
        account belongs to a person.
      </p>

      <SwapLink prompt="Already registered?" to="/sign-in?account=company" label="Sign in" />
    </form>
  )
}

function SwapLink({ prompt, to, label }: { prompt: string; to: string; label: string }) {
  const navigate = useNavigate()
  return (
    <p className={['t-body-sm', styles.swap].join(' ')}>
      {prompt}{' '}
      <button type="button" onClick={() => navigate(to)}>
        {label}
      </button>
    </p>
  )
}
