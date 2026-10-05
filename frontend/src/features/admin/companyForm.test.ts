import { describe, expect, it } from 'vitest'
import type { NewCompanyAccount } from '@/api/admin'
import { checkNewCompany } from './companyForm'

function form(changes: Partial<NewCompanyAccount> = {}): NewCompanyAccount {
  return {
    companyName: 'Kumba Logistics',
    contactEmail: 'jobs@kumbalogistics.cm',
    companyWebsiteUrl: 'https://kumbalogistics.cm',
    officeAddress: '',
    googleMapsUrl: '',
    verifyNow: true,
    ...changes,
  }
}

describe('checkNewCompany', () => {
  it('passes a complete account', () => {
    expect(checkNewCompany(form())).toEqual({})
  })

  it('needs a name, a contact address and a website', () => {
    const problems = checkNewCompany(form({ companyName: ' ', contactEmail: '', companyWebsiteUrl: '' }))
    expect(Object.keys(problems).sort()).toEqual(['companyName', 'companyWebsiteUrl', 'contactEmail'])
  })

  it('refuses an address that is not an email', () => {
    expect(checkNewCompany(form({ contactEmail: 'jobs at kumba' })).contactEmail).toBe('Enter a valid email address.')
    // EMAIL_PATTERN wants the address to end in two letters or more.
    expect(checkNewCompany(form({ contactEmail: 'jobs@kumba.c' })).contactEmail).toBeDefined()
  })

  it('refuses a website that is not https, as require_https_url does', () => {
    expect(checkNewCompany(form({ companyWebsiteUrl: 'http://kumbalogistics.cm' })).companyWebsiteUrl).toBe(
      'Enter a full website address beginning with https://.',
    )
    expect(checkNewCompany(form({ companyWebsiteUrl: 'https://localhost' })).companyWebsiteUrl).toBeDefined()
  })

  it('refuses a map link the backend would drop without a word', () => {
    expect(checkNewCompany(form({ googleMapsUrl: 'Bonapriso, Douala' })).googleMapsUrl).toBeDefined()
    expect(checkNewCompany(form({ googleMapsUrl: 'https://maps.google.com/?q=Bonapriso' }))).toEqual({})
  })
})
