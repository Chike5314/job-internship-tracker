// Mirrors the pool's actual password policy exactly
// (persistence_stack.py: min_length=10, require_lowercase, require_uppercase,
// require_digits, require_symbols=False). Symbols are allowed but never
// required, so there is deliberately no fifth rule here.
export interface PasswordRule {
  key: string
  label: string
  test: (password: string) => boolean
}

export const PASSWORD_RULES: PasswordRule[] = [
  { key: 'length', label: 'At least 10 characters', test: (p) => p.length >= 10 },
  { key: 'lower', label: 'One lowercase letter', test: (p) => /[a-z]/.test(p) },
  { key: 'upper', label: 'One uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { key: 'digit', label: 'One number', test: (p) => /[0-9]/.test(p) },
]

export function meetsPasswordPolicy(password: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(password))
}
