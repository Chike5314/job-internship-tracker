import type { DocumentRequirement } from '@/api/types'

interface SubmittedItemsPanelProps {
  requirements: DocumentRequirement[]
  documentUrls: Record<string, string>
  answers: Record<string, string>
}

export function SubmittedItemsPanel({ requirements, documentUrls, answers }: SubmittedItemsPanelProps) {
  return (
    <div>
      <p className="t-eyebrow" style={{ textTransform: 'uppercase', marginBottom: 'var(--space-3)' }}>
        What was submitted
      </p>
      <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
        {requirements.map((requirement) => (
          <div key={requirement.key}>
            <p className="t-body-sm" style={{ fontWeight: 600 }}>
              {requirement.label}
            </p>
            {requirement.kind === 'FILE' ? (
              documentUrls[requirement.key] ? (
                <a
                  href={documentUrls[requirement.key]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="t-body-sm"
                  style={{ color: 'var(--color-text-link)', textDecoration: 'underline' }}
                >
                  Open
                </a>
              ) : (
                <p className="t-body-sm" style={{ color: 'var(--color-text-subtle)' }}>
                  Not supplied
                </p>
              )
            ) : (
              <p className="t-body-sm" style={{ color: 'var(--color-text-secondary)' }}>
                {answers[requirement.key] || <span style={{ color: 'var(--color-text-subtle)' }}>Not supplied</span>}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
