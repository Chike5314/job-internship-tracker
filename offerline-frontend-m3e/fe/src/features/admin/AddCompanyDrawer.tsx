import { useEffect, useId, useRef, useState, type FormEvent, type MouseEvent } from 'react'
import { ApiError, fieldErrors } from '@/api/errors'
import type { NewCompanyAccount } from '@/api/admin'
import type { CompanyFull } from '@/api/types'
import { Button } from '@/ui/Button'
import { Field } from '@/ui/Field'
import { Icon } from '@/ui/Icon'
import { Input } from '@/ui/Input'
import { checkNewCompany, type Problems } from './companyForm'
import { useCreateCompany } from './useAdmin'
import drawerStyles from './CompanyDrawer.module.css'
import styles from './AddCompanyDrawer.module.css'

const EMPTY: NewCompanyAccount = {
  companyName: '',
  contactEmail: '',
  companyWebsiteUrl: '',
  officeAddress: '',
  googleMapsUrl: '',
  verifyNow: true,
}

/**
 * FR-9.6 and FR-9.7: an admin onboarding a company that is not going to
 * register itself. Creating the company creates its account, so the contact
 * address is the one it signs in with.
 */
export function AddCompanyDrawer({
  onClose,
  onOpenCompany,
}: {
  onClose: () => void
  /** Moves to the new company's own drawer. */
  onOpenCompany: (company: CompanyFull) => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const create = useCreateCompany()
  const [form, setForm] = useState<NewCompanyAccount>(EMPTY)
  const [problems, setProblems] = useState<Problems>({})
  const [general, setGeneral] = useState('')
  const [created, setCreated] = useState<{ company: CompanyFull; sentTo: string } | null>(null)

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
    // The dialog would focus its first control, the close button; the form
    // starts at the company's name instead.
    dialog?.querySelector<HTMLInputElement>('input')?.focus()
  }, [])

  function onBackdrop(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) onClose()
  }

  function set<K extends keyof NewCompanyAccount>(key: K, value: NewCompanyAccount[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    if (key in problems) setProblems((current) => ({ ...current, [key]: undefined }))
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    setGeneral('')
    const found = checkNewCompany(form)
    setProblems(found)
    if (Object.values(found).some(Boolean)) return
    create.mutate(
      {
        companyName: form.companyName.trim(),
        contactEmail: form.contactEmail.trim(),
        companyWebsiteUrl: form.companyWebsiteUrl.trim(),
        officeAddress: form.officeAddress?.trim() || undefined,
        googleMapsUrl: form.googleMapsUrl?.trim() || undefined,
        verifyNow: form.verifyNow,
      },
      {
        onSuccess: (result) => setCreated({ company: result.company, sentTo: result.temporaryPasswordSentTo }),
        onError: (error) => {
          if (error instanceof ApiError && error.code === 'CONFLICT' && error.details?.contactEmail) {
            setProblems({ contactEmail: 'An account already exists for this address. Find it in the companies list.' })
            return
          }
          if (error instanceof ApiError) {
            const fields = fieldErrors(error)
            if (fields.length > 0) {
              setProblems(Object.fromEntries(fields.map((item) => [item.field, item.message])) as Problems)
              return
            }
            setGeneral(error.message)
            return
          }
          setGeneral('The account was not created. Try again.')
        },
      },
    )
  }

  function another() {
    setForm(EMPTY)
    setProblems({})
    setGeneral('')
    setCreated(null)
    requestAnimationFrame(() => ref.current?.querySelector<HTMLInputElement>('input')?.focus())
  }

  return (
    <dialog
      ref={ref}
      className={drawerStyles.drawer}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={onBackdrop}
    >
      <div className={drawerStyles.panel}>
        <header className={drawerStyles.head}>
          <div className={drawerStyles.who}>
            <span className={styles.mark} aria-hidden="true">
              <Icon name={created ? 'confirm' : 'company'} size={22} />
            </span>
            <div className={drawerStyles.identity}>
              <h2 id={titleId} className={drawerStyles.name}>
                {created ? 'Account created' : 'Add a company'}
              </h2>
              <p className={styles.lede}>
                {created
                  ? `${created.company.companyName} has a company account.`
                  : 'For a company that is not going to register itself.'}
              </p>
            </div>
            <button type="button" className={drawerStyles.close} onClick={onClose} aria-label="Close">
              <Icon name="close" size={16} />
            </button>
          </div>
        </header>

        {created ? (
          <>
            <div className={drawerStyles.body}>
              <ol className={styles.steps}>
                <li className={styles.step}>
                  <span className={styles.stepMark}>1</span>
                  <span className={styles.stepText}>
                    <span className={styles.stepTitle}>A temporary password is on its way</span>
                    <span className={styles.stepBody}>Cognito has emailed it to {created.sentTo}.</span>
                  </span>
                </li>
                <li className={styles.step}>
                  <span className={styles.stepMark}>2</span>
                  <span className={styles.stepText}>
                    <span className={styles.stepTitle}>The company signs in and chooses its own</span>
                    <span className={styles.stepBody}>
                      It signs in with {created.sentTo} and the temporary password, then sets a password of its
                      own before anything else.
                    </span>
                  </span>
                </li>
                <li className={styles.step}>
                  <span className={styles.stepMark}>3</span>
                  <span className={styles.stepText}>
                    <span className={styles.stepTitle}>
                      {created.company.verificationStatus === 'VERIFIED'
                        ? 'It can publish straight away'
                        : 'It waits in the verification queue'}
                    </span>
                    <span className={styles.stepBody}>
                      {created.company.verificationStatus === 'VERIFIED'
                        ? 'The account is already verified, so its postings reach applicants as soon as it publishes them.'
                        : 'It can write drafts, and publishes nothing until it is approved.'}
                    </span>
                  </span>
                </li>
              </ol>
            </div>
            <footer className={drawerStyles.foot}>
              <div className={styles.actions}>
                <Button variant="primary" className={styles.grow} onClick={() => onOpenCompany(created.company)}>
                  Open {created.company.companyName}
                </Button>
                <Button variant="secondary" onClick={another}>
                  Add another
                </Button>
              </div>
            </footer>
          </>
        ) : (
          <form className={styles.form} onSubmit={submit} noValidate>
            <div className={[drawerStyles.body, styles.fields].join(' ')}>
              <Field label="Company name" required error={problems.companyName}>
                {(props) => (
                  <Input
                    {...props}
                    value={form.companyName}
                    onChange={(event) => set('companyName', event.target.value)}
                    maxLength={200}
                    placeholder="Kribi Solar"
                  />
                )}
              </Field>
              <Field
                label="Contact email"
                required
                help="The account signs in with this address, and the temporary password goes here."
                error={problems.contactEmail}
              >
                {(props) => (
                  <Input
                    {...props}
                    type="email"
                    value={form.contactEmail}
                    onChange={(event) => set('contactEmail', event.target.value)}
                    maxLength={254}
                    placeholder="hiring@company.cm"
                  />
                )}
              </Field>
              <Field label="Website" required error={problems.companyWebsiteUrl}>
                {(props) => (
                  <Input
                    {...props}
                    type="url"
                    value={form.companyWebsiteUrl}
                    onChange={(event) => set('companyWebsiteUrl', event.target.value)}
                    maxLength={512}
                    placeholder="https://"
                  />
                )}
              </Field>
              <Field label="Office address" error={problems.officeAddress}>
                {(props) => (
                  <Input
                    {...props}
                    value={form.officeAddress ?? ''}
                    onChange={(event) => set('officeAddress', event.target.value)}
                    maxLength={500}
                    placeholder="Street, area, city"
                  />
                )}
              </Field>
              <Field label="Google Maps link" error={problems.googleMapsUrl}>
                {(props) => (
                  <Input
                    {...props}
                    type="url"
                    value={form.googleMapsUrl ?? ''}
                    onChange={(event) => set('googleMapsUrl', event.target.value)}
                    maxLength={1024}
                    placeholder="https://maps.google.com/..."
                  />
                )}
              </Field>

              <fieldset className={styles.choice}>
                <legend className={styles.choiceLegend}>Verification</legend>
                <label className={[styles.option, form.verifyNow ? styles.optionOn : ''].join(' ')}>
                  <input
                    type="radio"
                    name="verifyNow"
                    checked={form.verifyNow}
                    onChange={() => set('verifyNow', true)}
                    className={styles.radio}
                  />
                  <span className={styles.optionText}>
                    <span className={styles.optionTitle}>Verified now</span>
                    <span className={styles.optionBody}>
                      You have checked the company yourself. It can publish as soon as it signs in.
                    </span>
                  </span>
                </label>
                <label className={[styles.option, !form.verifyNow ? styles.optionOn : ''].join(' ')}>
                  <input
                    type="radio"
                    name="verifyNow"
                    checked={!form.verifyNow}
                    onChange={() => set('verifyNow', false)}
                    className={styles.radio}
                  />
                  <span className={styles.optionText}>
                    <span className={styles.optionTitle}>Send it to the queue</span>
                    <span className={styles.optionBody}>
                      It waits for review like a company that registered itself.
                    </span>
                  </span>
                </label>
              </fieldset>
            </div>

            <footer className={drawerStyles.foot}>
              {general && (
                <p role="alert" className={drawerStyles.problem}>
                  {general}
                </p>
              )}
              <div className={styles.actions}>
                <Button type="submit" variant="primary" className={styles.grow} loading={create.isPending}>
                  Create account
                </Button>
                <Button type="button" variant="secondary" onClick={onClose} disabled={create.isPending}>
                  Cancel
                </Button>
              </div>
              <p className={drawerStyles.confirmNote}>
                Cognito emails the contact address a temporary password. Nothing here can create an admin account.
              </p>
            </footer>
          </form>
        )}
      </div>
    </dialog>
  )
}
