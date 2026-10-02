import type { CompanySnippet } from '@/api/types'

export function CompanyPanel({ company }: { company: CompanySnippet }) {
  return (
    <div className="glass-dense" style={{ padding: 'var(--space-4)', display: 'grid', gap: 'var(--space-2)' }}>
      <p className="t-heading-sm">{company.companyName}</p>
      {company.verificationStatus === 'VERIFIED' && (
        <p className="t-caption" style={{ color: 'var(--color-feedback-ok-text)' }}>
          Verified company
        </p>
      )}
      {company.companyWebsiteUrl && (
        <a
          href={company.companyWebsiteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="t-body-sm"
          style={{ color: 'var(--color-text-link)', textDecoration: 'underline' }}
        >
          Visit website
        </a>
      )}
      {company.officeAddress && (
        <p className="t-body-sm" style={{ color: 'var(--color-text-muted)' }}>
          {company.officeAddress}
        </p>
      )}
      {company.googleMapsUrl && (
        <a
          href={company.googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="t-body-sm"
          style={{ color: 'var(--color-text-link)', textDecoration: 'underline' }}
        >
          View on the map
        </a>
      )}
    </div>
  )
}
