import type { CompanyFull } from '@/api/types'

const DAY = 24 * 60 * 60 * 1000

/** "Registered today", "Waiting 1 day", "Waiting 6 days", counted in calendar days. */
export function waitingFor(iso: string, now: number): string {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const then = new Date(iso)
  then.setHours(0, 0, 0, 0)
  const days = Math.max(0, Math.round((start.getTime() - then.getTime()) / DAY))
  if (days === 0) return 'Registered today'
  return `Waiting ${days} day${days === 1 ? '' : 's'}`
}

/** "acmerobotics.com" from "https://www.acmerobotics.com/". */
export function host(url?: string): string {
  if (!url) return ''
  try {
    return new URL(url).host.replace(/^www\./, '')
  } catch {
    return url
  }
}

/** Whether a company matches a search, on its name, its contact or its site. */
export function matchesCompany(company: CompanyFull, term: string): boolean {
  if (!term) return true
  const haystack = `${company.companyName} ${company.contactEmail} ${host(company.companyWebsiteUrl)}`.toLowerCase()
  return haystack.includes(term.toLowerCase())
}
