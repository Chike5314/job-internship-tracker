import type { DocumentRequirement } from '@/api/types'

export function RequirementsPreview({ requirements }: { requirements: DocumentRequirement[] }) {
  return (
    <ul style={{ display: 'grid', gap: 'var(--space-1)' }}>
      {requirements.map((requirement) => (
        <li key={requirement.key} className="t-body-sm">
          {requirement.label}
          {!requirement.required && (
            <span className="t-caption" style={{ color: 'var(--color-text-subtle)' }}>
              {' '}
              (optional)
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}
