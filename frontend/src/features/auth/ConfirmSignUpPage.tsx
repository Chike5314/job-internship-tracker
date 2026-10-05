import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { registerCompany } from '@/api/company'
import { authErrorMessage } from '@/auth/authErrors'
import { Button } from '@/ui/Button'
import { ButtonLink } from '@/ui/ButtonLink'
import { Field } from '@/ui/Field'
import { Icon } from '@/ui/Icon'
import { Input } from '@/ui/Input'
import styles from './authPanel.module.css'

interface CompanyDetails {
  companyName: string
  contactEmail: string
  companyWebsiteUrl: string
  officeAddress?: string
  googleMapsUrl?: string
}

interface LocationState {
  email?: string
  fullName?: string
  /** Present when a company registered: its record is created here, once the
   *  confirmation has signed the caller in and there is somebody to own it. */
  company?: CompanyDetails
}

export function ConfirmSignUpPage() {
  const { status, identity, confirmSignUp, resendCode } = useAuth()
  const location = useLocation()
  const routed = location.state as LocationState | null
  const company = routed?.company

  const [email, setEmail] = useState(routed?.email ?? '')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState<'applicant' | 'company' | null>(null)
  const [companyUnsaved, setCompanyUnsaved] = useState(false)
  // Confirming signs the person in. Without this, the signed-in redirect below
  // would fire the moment that happens and skip the screen saying what comes
  // next. It is set before the request goes out, so it is always committed
  // before the signed-in status can arrive.
  const [confirming, setConfirming] = useState(false)

  if (status === 'signedIn' && !confirming && !done) {
    return <Navigate to={identity?.groups?.includes('Recruiters') ? '/company' : '/dashboard'} replace />
  }

  if (done === 'applicant') {
    const firstName = (routed?.fullName ?? identity?.fullName ?? '').trim().split(/\s+/)[0]
    return (
      <div className={styles.panel}>
        <div className={styles.done}>
          <span className={[styles.chip, styles.chipCreated].join(' ')}>Account created</span>
          <h1 className={styles.title}>You're in{firstName ? `, ${firstName}` : ''}.</h1>
          <p className={styles.subtitle}>
            Add your contact details and skills once. They fill in every application form after that.
          </p>
          <ButtonLink variant="primary" to="/profile" className={styles.submit}>
            Set up your profile
          </ButtonLink>
        </div>
      </div>
    )
  }

  if (done === 'company' && company) {
    return (
      <div className={styles.panel}>
        <div className={styles.done}>
          <span className={[styles.chip, styles.chipPending].join(' ')}>Pending verification</span>
          <h1 className={styles.title}>Thanks. We're checking {company.companyName}.</h1>
          <p className={styles.subtitle}>
            Your registration is your verification request. Our team compares your details with your
            website and office address, then emails {company.contactEmail} with the result.
          </p>
          <div className={['glass-soft', styles.facts].join(' ')}>
            <p className={[styles.fact, styles.factYes].join(' ')}>
              <Icon name="confirm" size={18} />
              You can sign in and write draft postings now.
            </p>
            <p className={[styles.fact, styles.factWait].join(' ')}>
              <Icon name="deadline" size={18} />
              Publishing unlocks once you're approved.
            </p>
          </div>
          <ButtonLink variant="primary" to="/company/postings" className={styles.submit}>
            Go to your postings
          </ButtonLink>
        </div>
      </div>
    )
  }

  async function saveCompany(details: CompanyDetails) {
    try {
      await registerCompany(details)
      setCompanyUnsaved(false)
      setDone('company')
    } catch {
      setCompanyUnsaved(true)
      setError('Your account is confirmed, but the company details did not save. Try again.')
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setNotice(null)
    setSubmitting(true)
    setConfirming(true)
    try {
      await confirmSignUp({ email, code })
    } catch (caught) {
      setConfirming(false)
      setError(authErrorMessage(caught))
      setSubmitting(false)
      return
    }
    if (company) await saveCompany(company)
    else setDone('applicant')
    setSubmitting(false)
  }

  async function onResend() {
    setError(null)
    setNotice(null)
    try {
      await resendCode({ email })
      setNotice('A new code is on its way.')
    } catch (caught) {
      setError(authErrorMessage(caught))
    }
  }

  // The account exists and the person is signed in; only the company record is
  // missing, so the one thing left to offer is saving it again.
  if (companyUnsaved && company) {
    return (
      <div className={styles.panel}>
        <div className={styles.done}>
          <h1 className={styles.title}>Almost there</h1>
          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}
          <Button
            variant="primary"
            className={styles.submit}
            loading={submitting}
            onClick={async () => {
              setSubmitting(true)
              setError(null)
              await saveCompany(company)
              setSubmitting(false)
            }}
          >
            Try again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.panel}>
      <form onSubmit={onSubmit} className={styles.form}>
        <div className={styles.lead}>
          <h1 className={styles.title}>Confirm your email</h1>
          <p className={styles.subtitle}>
            Enter the six-digit code we sent to {email.trim() || 'your email address'}.
          </p>
        </div>

        <div className={styles.fields}>
          <Field label="Email">
            {(props) => (
              <Input
                {...props}
                className={styles.input}
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            )}
          </Field>

          <Field label="Code" help={notice ?? undefined}>
            {(props) => (
              <Input
                {...props}
                className={styles.input}
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                value={code}
                onChange={(event) => setCode(event.target.value)}
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
          Confirm
        </Button>

        <button type="button" className={styles.quiet} onClick={onResend}>
          Send a new code
        </button>
      </form>
    </div>
  )
}
