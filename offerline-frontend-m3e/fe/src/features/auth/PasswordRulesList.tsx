import { PASSWORD_RULES } from '@/auth/passwordRules'

export function PasswordRulesList({ password }: { password: string }) {
  return (
    <ul style={{ display: 'grid', gap: 'var(--space-1)' }}>
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(password)
        return (
          <li
            key={rule.key}
            className="t-caption"
            style={{ color: met ? 'var(--color-feedback-ok-text)' : 'var(--color-text-subtle)' }}
          >
            {met ? '✓' : '•'} {rule.label}
          </li>
        )
      })}
    </ul>
  )
}
