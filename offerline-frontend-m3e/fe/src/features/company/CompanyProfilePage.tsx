import { useEffect, useState, type FormEvent } from 'react'
import { VERIFICATION_STATUS_LABEL } from '@/api/enums'
import { Button } from '@/ui/Button'
import { EmptyState } from '@/ui/EmptyState'
import { ErrorSummary } from '@/ui/ErrorSummary'
import { Field } from '@/ui/Field'
import { Icon } from '@/ui/Icon'
import { Input } from '@/ui/Input'
import { PageHeader } from '@/ui/PageHeader'
import { Skeleton } from '@/ui/Skeleton'
import { useToast } from '@/ui/ToastProvider'
import { formatDate } from '@/lib/formatDate'
import { CompanyLogoCard } from './CompanyLogoCard'
import { useMyCompany, useUpdateCompany } from './useCompany'
import styles from './CompanyProfilePage.module.css'

const VERIFICATION_LABEL = VERIFICATION_STATUS_LABEL

export function CompanyProfilePage() {
  const { data, isPending, isError } = useMyCompany()
  const update = useUpdateCompany()
  const { showToast } = useToast()
  const [form, setForm] = useState({
    companyName: '',
    companyWebsiteUrl: '',
    contactEmail: '',
    officeAddress: '',
    googleMapsUrl: '',
  })
  const [error, setError] = useState<string | null>(null)

  const company = data?.company

  useEffect(() => {
    if (!company) return
    setForm({
      companyName: company.companyName ?? '',
      companyWebsiteUrl: company.companyWebsiteUrl ?? '',
      contactEmail: company.contactEmail ?? '',
      officeAddress: company.officeAddress ?? '',
      googleMapsUrl: company.googleMapsUrl ?? '',
    })
  }, [company])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    try {
      await update.mutateAsync(form)
      showToast('Company profile saved.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'That did not save. Try again.')
    }
  }

  if (isPending) {
    return (
      <div className={styles.page}>
        <PageHeader title="Company profile" />
        <Skeleton height={320} />
      </div>
    )
  }

  if (isError || !company) {
    return (
      <div className={styles.page}>
        <PageHeader title="Company profile" />
        <EmptyState
          heading="This account has no company record yet"
          body="Registering is the verification request. Until it exists, there is nothing to post from."
        />
      </div>
    )
  }

  const verified = company.verificationStatus === 'VERIFIED'

  return (
    <div className={styles.page}>
      <PageHeader title="Company profile">
        <p className={['t-body', styles.muted].join(' ')}>
          Applicants read this beside every posting. Changing the name or the website returns the
          account to pending, because those are the two things an admin actually checked.
        </p>
      </PageHeader>

      <div className={['glass-dense', styles.status].join(' ')}>
        <span className={[styles.badge, verified ? styles.ok : styles.pending].join(' ')}>
          <Icon name={verified ? 'verified' : 'pending'} size={16} />
          {VERIFICATION_LABEL[company.verificationStatus]}
        </span>
        <p className={['t-body-sm', styles.muted].join(' ')}>
          Registered {formatDate(company.createdAt)}
        </p>
      </div>

      <CompanyLogoCard companyName={company.companyName} logoUrl={company.logoUrl} />

      <form className={styles.form} onSubmit={onSubmit}>
        {error && (
          <ErrorSummary heading="That did not save" items={[{ fieldId: 'company-name', message: error }]} />
        )}

        <Field label="Company name" id="company-name" required>
          {(props) => (
            <Input
              {...props}
              required
              value={form.companyName}
              onChange={(event) => setForm({ ...form, companyName: event.target.value })}
            />
          )}
        </Field>

        <Field label="Website" help="Must start with https://" required>
          {(props) => (
            <Input
              {...props}
              type="url"
              required
              value={form.companyWebsiteUrl}
              onChange={(event) => setForm({ ...form, companyWebsiteUrl: event.target.value })}
            />
          )}
        </Field>

        <Field label="Contact email" required>
          {(props) => (
            <Input
              {...props}
              type="email"
              required
              value={form.contactEmail}
              onChange={(event) => setForm({ ...form, contactEmail: event.target.value })}
            />
          )}
        </Field>

        <Field label="Office address" help="Shown on onsite and hybrid postings">
          {(props) => (
            <Input
              {...props}
              value={form.officeAddress}
              onChange={(event) => setForm({ ...form, officeAddress: event.target.value })}
            />
          )}
        </Field>

        <Field label="Map link" help="Optional">
          {(props) => (
            <Input
              {...props}
              type="url"
              value={form.googleMapsUrl}
              onChange={(event) => setForm({ ...form, googleMapsUrl: event.target.value })}
            />
          )}
        </Field>

        <div>
          <Button type="submit" variant="primary" loading={update.isPending}>
            Save changes
          </Button>
        </div>
      </form>

      {company.moderationHistory && company.moderationHistory.length > 0 && (
        <section className={styles.history}>
          <h2 className="t-heading-lg">Moderation history</h2>
          <p className={['t-body-sm', styles.muted].join(' ')}>
            Every decision is appended rather than written over the one before it.
          </p>
          <ol className={styles.entries}>
            {[...company.moderationHistory].reverse().map((entry) => (
              <li key={`${entry.timestamp}-${entry.to}`} className={styles.entry}>
                <p className="t-body-sm">{VERIFICATION_LABEL[entry.to]}</p>
                <p className={['t-caption', styles.muted].join(' ')}>
                  {formatDate(entry.timestamp)}
                </p>
                {entry.note && <p className={['t-body-sm', styles.note].join(' ')}>{entry.note}</p>}
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  )
}
