import { useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { confirmPasswordReset, requestPasswordReset } from '@/auth/authApi'
import { authErrorMessage } from '@/auth/authErrors'
import { meetsPasswordPolicy, MIN_PASSWORD_LENGTH } from '@/auth/passwordRules'
import { Button } from '@/ui/Button'
import { ButtonLink } from '@/ui/ButtonLink'
import { Field } from '@/ui/Field'
import { Input } from '@/ui/Input'
import { PasswordRulesList } from './PasswordRulesList'
import styles from './authPanel.module.css'

type Step = 'request' | 'confirm' | 'done'

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/**
 * Forgotten password, in three steps: ask for a code, set a new password with
 * it, then go back to sign in. The same for an applicant and a company, since
 * both sign in with an email and a password.
 */
export function ResetPasswordPage() {
  const location = useLocation()
  const [step, setStep] = useState<Step>('request')
  const [email, setEmail] = useState((location.state as { email?: string } | null)?.email ?? '')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [attempted, setAttempted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onRequest(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setAttempted(true)
    if (!EMAIL.test(email.trim())) return

    setSubmitting(true)
    try {
      await requestPasswordReset({ email: email.trim() })
      setAttempted(false)
      setStep('confirm')
    } catch (caught) {
      setError(authErrorMessage(caught))
    } finally {
      setSubmitting(false)
    }
  }

  async function onConfirm(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setNotice(null)
    setAttempted(true)
    if (!code.trim() || !meetsPasswordPolicy(password)) return

    setSubmitting(true)
    try {
      await confirmPasswordReset({ email: email.trim(), code: code.trim(), newPassword: password })
      setStep('done')
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
      await requestPasswordReset({ email: email.trim() })
      setNotice('A new code is on its way.')
    } catch (caught) {
      setError(authErrorMessage(caught))
    }
  }

  if (step === 'done') {
    return (
      <div className={styles.panel}>
        <div className={styles.done}>
          <span className={[styles.chip, styles.chipCreated].join(' ')}>Password changed</span>
          <h1 className={styles.title}>You're all set.</h1>
          <p className={styles.subtitle}>Sign in with your new password.</p>
          <ButtonLink
            variant="primary"
            to="/sign-in"
            state={{ email: email.trim() }}
            className={styles.submit}
          >
            Sign in
          </ButtonLink>
        </div>
      </div>
    )
  }

  if (step === 'confirm') {
    const codeError = attempted && !code.trim() ? 'Enter the code from the email.' : undefined
    const passwordError =
      attempted && !meetsPasswordPolicy(password)
        ? password
          ? 'Meet every rule below.'
          : 'Required.'
        : undefined

    return (
      <div className={styles.panel}>
        <form onSubmit={onConfirm} className={styles.form} noValidate>
          <div className={styles.lead}>
            <h1 className={styles.title}>Check your email</h1>
            <p className={styles.subtitle}>
              If an account exists for {email.trim()}, a six-digit code is on its way. Enter it with
              a new password.
            </p>
          </div>

          <div className={styles.fields}>
            <Field label="Code" error={codeError} help={notice ?? undefined}>
              {(props) => (
                <Input
                  {...props}
                  className={styles.input}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                />
              )}
            </Field>

            <Field label="New password" hint={`${MIN_PASSWORD_LENGTH} characters or more`} error={passwordError}>
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

            {passwordError && password && <PasswordRulesList password={password} />}
          </div>

          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}

          <Button type="submit" variant="primary" className={styles.submit} loading={submitting}>
            Set new password
          </Button>

          <button type="button" className={styles.quiet} onClick={onResend}>
            Send a new code
          </button>

          <p className={styles.swap}>
            Wrong address?{' '}
            <button
              type="button"
              onClick={() => {
                setStep('request')
                setCode('')
                setError(null)
                setNotice(null)
                setAttempted(false)
              }}
            >
              Use a different email
            </button>
          </p>
        </form>
      </div>
    )
  }

  const emailError = attempted
    ? !email.trim()
      ? 'Required.'
      : !EMAIL.test(email.trim())
        ? 'Enter a valid email address.'
        : undefined
    : undefined

  return (
    <div className={styles.panel}>
      <form onSubmit={onRequest} className={styles.form} noValidate>
        <div className={styles.lead}>
          <h1 className={styles.title}>Reset your password</h1>
          <p className={styles.subtitle}>Enter the email you sign in with and we'll send you a code.</p>
        </div>

        <div className={styles.fields}>
          <Field label="Email" error={emailError}>
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
        </div>

        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}

        <Button type="submit" variant="primary" className={styles.submit} loading={submitting}>
          Send code
        </Button>

        <p className={styles.aside}>
          Signed up with Google? There is no password to reset. Use Continue with Google on the sign
          in page instead.
        </p>

        <p className={styles.swap}>
          Remembered it? <Link to="/sign-in">Sign in</Link>
        </p>
      </form>
    </div>
  )
}
