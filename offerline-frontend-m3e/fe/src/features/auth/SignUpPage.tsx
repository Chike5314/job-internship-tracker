import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { authErrorMessage } from '@/auth/authErrors'
import { meetsPasswordPolicy, MIN_PASSWORD_LENGTH } from '@/auth/passwordRules'
import { Button } from '@/ui/Button'
import { Field } from '@/ui/Field'
import { Input } from '@/ui/Input'
import { PasswordRulesList } from './PasswordRulesList'
import { AccountTabs, useAccount } from './AccountTabs'
import { GoogleButton } from './GoogleButton'
import styles from './authPanel.module.css'

// From the pool's own policy, so the hint never promises less than Cognito
// will accept.
const PASSWORD_HINT = `${MIN_PASSWORD_LENGTH} characters or more`

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const HTTPS_SITE = /^https:\/\/[^\s/]+\.[^\s]+$/

type Errors = Partial<Record<string, string>>

function required(value: string): string | undefined {
  return value.trim() ? undefined : 'Required.'
}

function emailError(value: string): string | undefined {
  return required(value) ?? (EMAIL.test(value.trim()) ? undefined : 'Enter a valid email address.')
}

function passwordError(value: string): string | undefined {
  return required(value) ?? (meetsPasswordPolicy(value) ? undefined : 'Meet every rule below.')
}

export function SignUpPage() {
  const [account, setAccount] = useAccount()

  return (
    <div className={styles.panel}>
      <AccountTabs account={account} onChange={setAccount} />
      {account === 'applicant' ? <ApplicantSignUp /> : <CompanySignUp />}
      <p className={styles.note}>
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
  const [attempted, setAttempted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const errors: Errors = attempted
    ? { fullName: required(fullName), email: emailError(email), password: passwordError(password) }
    : {}

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setAttempted(true)
    if (required(fullName) || emailError(email) || passwordError(password)) return

    setSubmitting(true)
    try {
      await signUp({ email, password, fullName })
      navigate('/sign-up/confirm', { state: { email, fullName } })
    } catch (caught) {
      setError(authErrorMessage(caught))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className={styles.form} noValidate>
      <div className={styles.lead}>
        <h1 className={styles.title}>Create your account</h1>
        <p className={styles.subtitle}>One profile for jobs and every kind of internship.</p>
      </div>

      <GoogleButton label="Continue with Google" />
      <p className={styles.divider}>or with email</p>

      <div className={styles.fields}>
        <Field label="Full name" error={errors.fullName}>
          {(props) => (
            <Input
              {...props}
              className={styles.input}
              autoComplete="name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
            />
          )}
        </Field>

        <Field label="Email" error={errors.email}>
          {(props) => (
            <Input
              {...props}
              className={styles.input}
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          )}
        </Field>

        <Field label="Password" hint={PASSWORD_HINT} error={errors.password}>
          {(props) => (
            <Input
              {...props}
              className={styles.input}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          )}
        </Field>

        {/* The full list appears once a password has actually been refused, so
            the form stays one short column until it has something to say. */}
        {errors.password && password && <PasswordRulesList password={password} />}
      </div>

      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}

      <Button type="submit" variant="primary" className={styles.submit} loading={submitting}>
        Create account
      </Button>

      <p className={styles.swap}>
        Already have an account? <Link to="/sign-in">Sign in</Link>
      </p>
    </form>
  )
}

function CompanySignUp() {
  const { signUpCompany } = useAuth()
  const navigate = useNavigate()
  const [companyName, setCompanyName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [password, setPassword] = useState('')
  const [companyWebsiteUrl, setCompanyWebsiteUrl] = useState('')
  const [officeAddress, setOfficeAddress] = useState('')
  const [googleMapsUrl, setGoogleMapsUrl] = useState('')
  const [attempted, setAttempted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function check(): Errors {
    return {
      companyName: required(companyName),
      contactEmail: emailError(contactEmail),
      password: passwordError(password),
      companyWebsiteUrl:
        required(companyWebsiteUrl) ??
        (HTTPS_SITE.test(companyWebsiteUrl.trim())
          ? undefined
          : 'Enter a full https:// address, for example https://yourcompany.cm'),
      googleMapsUrl:
        googleMapsUrl.trim() && !/^https:\/\//i.test(googleMapsUrl.trim())
          ? 'Paste the full link from Google Maps.'
          : undefined,
    }
  }

  const errors: Errors = attempted ? check() : {}

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setAttempted(true)
    if (Object.values(check()).some(Boolean)) return

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
    <form onSubmit={onSubmit} className={styles.form} noValidate>
      <div className={styles.lead}>
        <h1 className={styles.title}>Register your company</h1>
        <p className={styles.subtitle}>Registering sends your details to our team for verification.</p>
      </div>

      <div className={styles.fields}>
        <Field label="Company name" error={errors.companyName}>
          {(props) => (
            <Input
              {...props}
              className={styles.input}
              autoComplete="organization"
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
            />
          )}
        </Field>

        <Field label="Contact email" error={errors.contactEmail}>
          {(props) => (
            <Input
              {...props}
              className={styles.input}
              type="email"
              autoComplete="email"
              placeholder="hiring@company.cm"
              value={contactEmail}
              onChange={(event) => setContactEmail(event.target.value)}
            />
          )}
        </Field>

        <Field label="Password" hint={PASSWORD_HINT} error={errors.password}>
          {(props) => (
            <Input
              {...props}
              className={styles.input}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          )}
        </Field>

        {errors.password && password && <PasswordRulesList password={password} />}

        <Field label="Website" hint="Must start with https://" error={errors.companyWebsiteUrl}>
          {(props) => (
            <Input
              {...props}
              className={styles.input}
              type="url"
              autoComplete="url"
              placeholder="https://"
              value={companyWebsiteUrl}
              onChange={(event) => setCompanyWebsiteUrl(event.target.value)}
            />
          )}
        </Field>

        <Field label="Office address" hint="Optional">
          {(props) => (
            <Input
              {...props}
              className={styles.input}
              autoComplete="street-address"
              placeholder="Street, area, city"
              value={officeAddress}
              onChange={(event) => setOfficeAddress(event.target.value)}
            />
          )}
        </Field>

        <Field label="Google Maps link" hint="Optional" error={errors.googleMapsUrl}>
          {(props) => (
            <Input
              {...props}
              className={styles.input}
              type="url"
              placeholder="https://maps.google.com/"
              value={googleMapsUrl}
              onChange={(event) => setGoogleMapsUrl(event.target.value)}
            />
          )}
        </Field>
      </div>

      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}

      <Button type="submit" variant="primary" className={styles.submit} loading={submitting}>
        Submit for verification
      </Button>

      <p className={styles.aside}>
        Company accounts sign in with email. Google sign-in is for applicants, because a Google
        account belongs to a person.
      </p>

      <p className={styles.swap}>
        Already have an account? <Link to="/sign-in?account=company">Sign in</Link>
      </p>
    </form>
  )
}
