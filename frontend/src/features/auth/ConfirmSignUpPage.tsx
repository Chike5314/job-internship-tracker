import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { registerCompany } from '@/api/company'
import { authErrorMessage } from '@/auth/authErrors'
import { Button } from '@/ui/Button'
import { Field } from '@/ui/Field'
import { Input } from '@/ui/Input'

interface LocationState {
  email?: string
  /** Present when a company registered: its record is created here, once the
   *  confirmation has signed the caller in and there is somebody to own it. */
  company?: {
    companyName: string
    contactEmail: string
    companyWebsiteUrl: string
    officeAddress?: string
    googleMapsUrl?: string
  }
}

export function ConfirmSignUpPage() {
  const { confirmSignUp, resendCode } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const routed = location.state as LocationState | null
  const stateEmail = routed?.email ?? ''
  const company = routed?.company

  const [email, setEmail] = useState(stateEmail)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await confirmSignUp({ email, code })
      if (company) {
        await registerCompany(company)
        navigate('/company')
      } else {
        navigate('/dashboard')
      }
    } catch (caught) {
      setError(authErrorMessage(caught))
    } finally {
      setSubmitting(false)
    }
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

  return (
    <form onSubmit={onSubmit} style={{ display: 'grid', gap: 'var(--space-4)' }}>
      <h1 className="t-heading-lg">Confirm your email</h1>
      <p className="t-body-sm" style={{ color: 'var(--color-text-muted)' }}>
        Enter the six digit code we sent to your email address.
      </p>

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

      <Field label="Confirmation code" error={error ?? undefined} help={notice ?? undefined}>
        {(props) => (
          <Input
            {...props}
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
        )}
      </Field>

      <Button type="submit" variant="primary" loading={submitting}>
        Confirm
      </Button>

      <Button type="button" variant="quiet" onClick={onResend}>
        Send a new code
      </Button>
    </form>
  )
}
