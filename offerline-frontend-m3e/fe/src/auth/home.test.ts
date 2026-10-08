import { describe, expect, it } from 'vitest'
import type { Identity } from './authApi'
import { homeFor } from './home'

function account(groups: string[]): Identity {
  return { userId: 'u', email: 'u@example.com', fullName: 'U', groups, isApplicant: groups.includes('Applicants') }
}

describe('homeFor', () => {
  it('sends an administrator to the admin app', () => {
    expect(homeFor(account(['Admins']))).toBe('/admin')
  })

  it('sends a company to the company app', () => {
    expect(homeFor(account(['Recruiters']))).toBe('/company')
  })

  it('sends an applicant to the dashboard', () => {
    expect(homeFor(account(['Applicants']))).toBe('/dashboard')
  })

  it('sends an account with no group yet to the dashboard, the safe default', () => {
    expect(homeFor(account([]))).toBe('/dashboard')
    expect(homeFor(null)).toBe('/dashboard')
  })
})
