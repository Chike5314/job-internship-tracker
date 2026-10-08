import type { NewCompanyAccount } from '@/api/admin'

export type Fields = 'companyName' | 'contactEmail' | 'companyWebsiteUrl' | 'officeAddress' | 'googleMapsUrl'
export type Problems = Partial<Record<Fields, string>>

// The same shape the backend checks in validation.py, so a mistake is caught
// here with the same words rather than after a round trip.
const EMAIL = /^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/

function httpsSite(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.host.includes('.')
  } catch {
    return false
  }
}

function webLink(value: string): boolean {
  try {
    const url = new URL(value)
    return (url.protocol === 'https:' || url.protocol === 'http:') && Boolean(url.host)
  } catch {
    return false
  }
}

/** The fields of a new company account, checked the way validation.py checks them. */
export function checkNewCompany(form: NewCompanyAccount): Problems {
  const problems: Problems = {}
  if (!form.companyName.trim()) problems.companyName = 'Give the company its name.'
  if (!form.contactEmail.trim()) problems.contactEmail = 'Give the address the company signs in with.'
  else if (!EMAIL.test(form.contactEmail.trim())) problems.contactEmail = 'Enter a valid email address.'
  if (!form.companyWebsiteUrl.trim()) problems.companyWebsiteUrl = 'Give the company website.'
  else if (!httpsSite(form.companyWebsiteUrl.trim())) {
    problems.companyWebsiteUrl = 'Enter a full website address beginning with https://.'
  }
  // The backend drops a link it cannot read without saying so, so it is
  // refused here instead of disappearing.
  if (form.googleMapsUrl?.trim() && !webLink(form.googleMapsUrl.trim())) {
    problems.googleMapsUrl = 'Enter a full link beginning with https://, or leave it empty.'
  }
  return problems
}
