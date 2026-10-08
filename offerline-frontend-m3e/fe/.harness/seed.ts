import type { QueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/api/queryKeys'
import type { ApplicationStatus, OpportunityType, WorkModality } from '@/api/enums'
import type {
  ApplicationDetail,
  ApplicationSummary,
  CompanySnippet,
  JobSummary,
  Notification,
  Profile,
  StatusHistoryEntry,
} from '@/api/types'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
const now = Date.now()
const iso = (ms: number) => new Date(ms).toISOString()

function daysAgo(days: number, hour = 11) {
  const d = new Date(now - days * DAY)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

function daysAhead(days: number, hour = 12) {
  const d = new Date(now + days * DAY)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

function nextWeekday(day: number, hour: number) {
  const d = new Date(now)
  d.setHours(hour, 0, 0, 0)
  while (d.getDay() !== day || d.getTime() <= now) d.setTime(d.getTime() + DAY)
  return d.toISOString()
}

type Seeded = {
  id: string
  role: string
  company: string
  type: OpportunityType
  modality: WorkModality
  city: string
  salary?: [number, number?]
  status: ApplicationStatus
  appliedDaysAgo: number
  history: [ApplicationStatus, string, number, string?][]
}

// The applications board's own sample data.
const SEED: Seeded[] = [
  { id: 'a1', role: 'Backend Engineer', company: 'Kora Systems', type: 'FULL_TIME_JOB', modality: 'HYBRID', city: 'Douala', salary: [650_000, 850_000], status: 'INTERVIEW_SCHEDULED', appliedDaysAgo: 0,
    history: [['SUBMITTED', 'you', 22], ['UNDER_REVIEW', 'Kora Systems', 19], ['INTERVIEW_SCHEDULED', 'Kora Systems', 12, 'Technical round with two engineers. Bring a laptop.']] },
  { id: 'a2', role: 'Data Analyst Intern', company: 'Mbeya Analytics', type: 'PROFESSIONAL_INTERNSHIP', modality: 'REMOTE', city: 'Douala', salary: [150_000], status: 'OFFER_EXTENDED', appliedDaysAgo: 1,
    history: [['SUBMITTED', 'you', 30], ['UNDER_REVIEW', 'Mbeya Analytics', 28], ['INTERVIEW_SCHEDULED', 'Mbeya Analytics', 24, 'Video call with the data team.'], ['OFFER_EXTENDED', 'Mbeya Analytics', 1, 'Three-month placement starting 1 November. The offer letter is in your email.']] },
  { id: 'a3', role: 'Network Operations Trainee', company: 'Northfield Telecom', type: 'ACADEMIC_INTERNSHIP', modality: 'ONSITE', city: 'Yaoundé', status: 'UNDER_REVIEW', appliedDaysAgo: 13,
    history: [['SUBMITTED', 'you', 17], ['UNDER_REVIEW', 'Northfield Telecom', 13]] },
  { id: 'a4', role: 'Frontend Developer', company: 'Cedar Labs', type: 'FULL_TIME_JOB', modality: 'REMOTE', city: 'Douala', salary: [450_000, 600_000], status: 'SUBMITTED', appliedDaysAgo: 12,
    history: [['SUBMITTED', 'you', 12]] },
  { id: 'a5', role: 'Product Design Intern', company: 'Lumen Health', type: 'PROFESSIONAL_INTERNSHIP', modality: 'HYBRID', city: 'Douala', salary: [100_000], status: 'REJECTED', appliedDaysAgo: 16,
    history: [['SUBMITTED', 'you', 33], ['UNDER_REVIEW', 'Lumen Health', 29], ['REJECTED', 'Lumen Health', 16, 'We went with a candidate with more user research experience. Thank you for applying.']] },
  { id: 'a6', role: 'Electrical Site Assistant', company: 'Atlas Grid', type: 'ACADEMIC_INTERNSHIP', modality: 'ONSITE', city: 'Kribi', salary: [60_000], status: 'WITHDRAWN', appliedDaysAgo: 25,
    history: [['SUBMITTED', 'you', 37], ['WITHDRAWN', 'you', 25]] },
  { id: 'a7', role: 'IT Support Officer', company: 'Ridgeway Bank', type: 'FULL_TIME_JOB', modality: 'ONSITE', city: 'Yaoundé', status: 'OFFER_DECLINED', appliedDaysAgo: 31,
    history: [['SUBMITTED', 'you', 55], ['UNDER_REVIEW', 'Ridgeway Bank', 51], ['INTERVIEW_SCHEDULED', 'Ridgeway Bank', 45], ['OFFER_EXTENDED', 'Ridgeway Bank', 36], ['OFFER_DECLINED', 'you', 31]] },
]

const DOCS: Record<string, Record<string, [string, string]>> = {
  a1: { cv: ['CV', 'Backend_CV_v3.pdf'] },
  a2: { cv: ['CV', 'Analyst_CV_Sept.pdf'] },
  a3: {
    cv: ['CV', 'Networks_CV.pdf'],
    transcript: ['Transcript', 'Transcript_2026.pdf'],
    schoolAuthorisation: ['Authorisation letter', 'School_letter_Northfield.pdf'],
  },
}

const FINAL: ApplicationStatus[] = ['OFFER_ACCEPTED', 'OFFER_DECLINED', 'REJECTED', 'WITHDRAWN']

function summaryOf(s: Seeded): ApplicationSummary {
  return {
    applicationId: s.id,
    jobId: `job-${s.id}`,
    jobTitle: s.role,
    companyName: s.company,
    opportunityType: s.type,
    status: s.status,
    appliedAt: daysAgo(s.appliedDaysAgo),
    canEdit: s.status === 'SUBMITTED',
    isFinal: FINAL.includes(s.status),
  }
}

function jobOf(s: Seeded): JobSummary {
  return {
    jobId: `job-${s.id}`,
    companyId: `c-${s.id}`,
    companyName: s.company,
    title: s.role,
    description: '',
    opportunityType: s.type,
    workModality: s.modality,
    postingStatus: 'PUBLISHED',
    documentRequirements: [],
    createdAt: daysAgo(s.appliedDaysAgo + 10),
    isOpen: true,
    city: s.city,
    country: 'Cameroon',
    salary: s.salary
      ? { disclosed: true, min: s.salary[0], max: s.salary[1] ?? s.salary[0], currency: 'XAF', period: 'MONTH' }
      : { disclosed: false },
  }
}

function companyOf(s: Seeded): CompanySnippet {
  return {
    companyId: `c-${s.id}`,
    companyName: s.company,
    verificationStatus: 'VERIFIED',
    companyWebsiteUrl: `https://${s.company.toLowerCase().replace(/\s+/g, '')}.example.com`,
    ...(s.modality !== 'REMOTE'
      ? { googleMapsUrl: 'https://maps.google.com/?q=Douala', officeAddress: '14 Rue Njo-Njo, Bonapriso, Douala' }
      : {}),
  }
}

function detailOf(s: Seeded): ApplicationDetail {
  const statusHistory: StatusHistoryEntry[] = s.history.map(([status, by, days, note]) => ({
    status,
    changedBy: by === 'you' ? 'harness-applicant' : `c-${s.id}`,
    timestamp: daysAgo(days),
    ...(note ? { note } : {}),
  }))
  const interviews =
    s.id === 'a1'
      ? [
          {
            interviewId: 'i0', scheduledAt: nextWeekday(1, 14), durationMinutes: 60, mode: 'ONSITE' as const,
            locationOrLink: '14 Rue Njo-Njo, Bonapriso, Douala', state: 'CANCELLED' as const,
            proposedBy: 'c-a1', proposedAt: daysAgo(12), sequence: 0,
          },
          {
            interviewId: 'i1', scheduledAt: nextWeekday(2, 10), durationMinutes: 60, mode: 'ONSITE' as const,
            locationOrLink: '14 Rue Njo-Njo, Bonapriso, Douala', state: 'PROPOSED' as const,
            proposedBy: 'c-a1', proposedAt: daysAgo(2), sequence: 1, replacesInterviewId: 'i0',
          },
        ]
      : []
  const files = DOCS[s.id] ?? { cv: ['CV', `${s.role.split(' ')[0]}_CV.pdf`] }
  const link = (name: string) =>
    `https://jiat-dev-documents.s3.amazonaws.com/applications/harness-applicant/0123456789abcdef0123456789abcdef-${encodeURIComponent(name)}?X-Amz-Signature=x`
  const requirements: ApplicationDetail['documentRequirements'] = Object.entries(files).map(
    ([key, [label]]) => ({ key, label, kind: 'FILE', required: true }),
  )
  const answers: Record<string, string> = {}
  if (s.type !== 'ACADEMIC_INTERNSHIP') {
    requirements.push({ key: 'coverLetter', label: 'Cover letter', kind: 'TEXT', required: true })
  }
  if (s.id === 'a2') {
    requirements.push({ key: 'availability', label: 'Availability', kind: 'TEXT', required: true })
    answers.availability = '3 months from 1 Nov'
  }
  return {
    ...summaryOf(s),
    statusHistory,
    answers,
    interviews,
    documentUrls: Object.fromEntries(Object.entries(files).map(([key, [, name]]) => [key, link(name)])),
    documentRequirements: requirements,
    coverLetter:
      'I have spent the last two years building payment and messaging services in Python and Go.\n\nI would like to bring that to your team.',
  }
}

const openings: JobSummary[] = [
  ['j1', 'Mobile Developer', 'Savanna Pay', 'FULL_TIME_JOB', 'Douala', 'ONSITE', 8, 1, [500_000, 700_000]],
  ['j2', 'Marketing Analytics Intern', 'Bloom Retail', 'PROFESSIONAL_INTERNSHIP', 'Douala', 'REMOTE', 4, 2, [120_000]],
  ['j3', 'Field Engineering Intern', 'Northfield Telecom', 'ACADEMIC_INTERNSHIP', 'Yaoundé', 'ONSITE', 5, 3, undefined],
  ['j4', 'Accountant', 'Ridgeway Bank', 'FULL_TIME_JOB', 'Yaoundé', 'ONSITE', 16, 4, [400_000, 550_000]],
].map(([id, title, companyName, type, city, modality, closes, created, salary]) => ({
  jobId: id as string,
  companyId: `c-${id}`,
  companyName: companyName as string,
  title: title as string,
  description: '',
  opportunityType: type as OpportunityType,
  workModality: modality as WorkModality,
  postingStatus: 'PUBLISHED' as const,
  documentRequirements: [],
  createdAt: daysAgo(created as number),
  isOpen: true,
  applicationDeadline: daysAhead(closes as number),
  city: city as string,
  salary: salary
    ? { disclosed: true, min: (salary as number[])[0], max: (salary as number[])[1] ?? (salary as number[])[0], currency: 'XAF', period: 'MONTH' as const }
    : { disclosed: false },
}))

const profile: Profile = {
  userId: 'harness-applicant',
  email: 'amara.nkeng@mail.cm',
  role: 'APPLICANT',
  fullName: 'Amara Nkeng',
  createdAt: daysAgo(60),
  cvCount: 10,
  phone: '+237 6 71 23 45 67',
  skills: ['SQL', 'Python'],
  academicInfo: { schoolName: 'University of Yaoundé I', fieldOfStudy: 'Electrical Engineering', degreeLevel: 'BACHELORS' },
  hasTranscript: true,
  transcriptUrl:
    'https://jiat-dev-documents.s3.amazonaws.com/transcripts/harness-applicant/0123456789abcdef0123456789abcdef-Transcript_2026.pdf?X-Amz-Signature=x',
}

// The apply board's three sample postings, one per opportunity type.
const applyPostings: Record<string, { job: JobSummary; company: CompanySnippet }> = {
  j3: {
    job: {
      ...openings[2]!,
      workModality: 'ONSITE',
      country: 'Cameroon',
      experienceLevel: 'ENTRY',
      openings: 4,
      startDate: '2027-01-05',
      duration: '6 months',
      skills: ['Networking basics', 'Fibre splicing', 'Working at height'],
      additionalDetails: [{ label: 'Transport', value: 'Shuttle from Mvan roundabout' }],
      documentRequirements: [
        { key: 'cv', label: 'A CV for this role', kind: 'FILE', required: true },
        { key: 'transcript', label: 'Transcript', kind: 'FILE', required: true },
        { key: 'schoolAuthorisation', label: 'Authorisation letter', kind: 'FILE', required: true },
        { key: 'recommendation', label: 'Recommendation from a lecturer', kind: 'FILE', required: false },
      ],
    },
    company: {
      companyId: 'c-j3', companyName: 'Northfield Telecom', verificationStatus: 'VERIFIED',
      companyWebsiteUrl: 'https://northfield.example.com', googleMapsUrl: 'https://maps.google.com/?q=Yaounde',
    },
  },
  j2: {
    job: {
      ...openings[1]!,
      country: 'Cameroon',
      experienceLevel: 'ENTRY',
      openings: 2,
      startDate: '2026-11-01',
      skills: ['Excel', 'SQL basics', 'Google Analytics'],
      additionalDetails: [{ label: 'Hours', value: 'Mon to Fri, 9:00 to 15:00' }, { label: 'Equipment', value: 'Laptop provided' }],
      documentRequirements: [
        { key: 'cv', label: 'CV or resume', kind: 'FILE', required: true },
        { key: 'coverLetter', label: 'Cover letter', kind: 'FILE', required: true },
        { key: 'availability', label: 'Availability window', kind: 'TEXT', required: true },
      ],
    },
    company: { companyId: 'c-j2', companyName: 'Bloom Retail', verificationStatus: 'VERIFIED', companyWebsiteUrl: 'https://bloom.example.com' },
  },
  j1: {
    job: {
      ...openings[0]!,
      workModality: 'HYBRID',
      country: 'Cameroon',
      experienceLevel: 'MID',
      openings: 1,
      skills: ['Flutter', 'REST APIs', 'Mobile money APIs'],
      additionalDetails: [{ label: 'Office days', value: 'Tuesday and Thursday' }, { label: 'Probation', value: '3 months' }],
      documentRequirements: [
        { key: 'cv', label: 'CV or resume', kind: 'FILE', required: true },
        { key: 'coverLetter', label: 'Cover letter', kind: 'FILE', required: true },
        { key: 'portfolio', label: 'Portfolio links', kind: 'TEXT', required: false },
      ],
    },
    company: {
      companyId: 'c-j1', companyName: 'Savanna Pay', verificationStatus: 'VERIFIED',
      companyWebsiteUrl: 'https://savanna.example.com', googleMapsUrl: 'https://maps.google.com/?q=Douala',
    },
  },
}

const library = [
  ['Frontend CV', 'Frontend_CV.pdf', 12], ['Networks CV', 'Networks_CV.pdf', 17], ['Backend CV', 'Backend_CV_v3.pdf', 22],
  ['Data analyst CV', 'Analyst_CV_Sept.pdf', 32], ['Design CV with portfolio', 'Design_CV_portfolio.pdf', 33],
  ['Electrical engineering CV', 'Electrical_CV.pdf', 37], ['IT support CV', 'IT_Support_CV.pdf', 55],
  ['CV in French', 'CV_Francais.pdf', 63], ['General CV', 'Amara_Nkeng_CV.pdf', 76], ['Internship CV 2025', 'Internship_CV_2025.pdf', 93],
].map(([label, file, days], index) => ({
  cvId: `cv_${index + 1}`,
  label: label as string,
  s3Key: `cvs/harness-applicant/0123456789abcdef0123456789abcde${index}-${file}`,
  uploadedAt: daysAgo(days as number),
  downloadUrl: 'https://example.com/cv.pdf',
}))

const notifications: Notification[] = [
  'Kora Systems scheduled an interview for Tuesday at 10:00.',
  'Mbeya Analytics extended you an offer for Data Analyst Intern.',
  'Northfield Telecom opened your application. It is now under review.',
].map((message, index) => ({
  userId: 'harness-applicant',
  createdAt: iso(now - (index + 1) * HOUR),
  notificationId: `n${index}`,
  type: 'STATUS',
  message,
  read: false,
  expiresAt: 0,
}))

export function seed(client: QueryClient) {
  const applications = SEED.map(summaryOf)
  client.setQueryData(queryKeys.applications.mine(), { count: applications.length, applications })
  for (const s of SEED) {
    client.setQueryData(queryKeys.applications.detail(s.id), { application: detailOf(s) })
    client.setQueryData(queryKeys.jobs.detail(`job-${s.id}`), { job: jobOf(s), company: companyOf(s) })
  }
  client.setQueryData(queryKeys.jobs.list({}), { count: openings.length, jobs: openings })
  client.setQueryData(queryKeys.profile.me(), { profile })
  client.setQueryData(queryKeys.profile.cvs(), { cvs: library, totalUploaded: library.length })
  // What the fake submit creates, so the confirmation's links land somewhere.
  const fresh = SEED.find((entry) => entry.id === 'a4')!
  client.setQueryData(queryKeys.applications.detail('a-new'), {
    application: { ...detailOf(fresh), applicationId: 'a-new', jobId: 'j3', jobTitle: 'Field Engineering Intern', companyName: 'Northfield Telecom' },
  })
  for (const [id, detail] of Object.entries(applyPostings)) {
    client.setQueryData(queryKeys.jobs.detail(id), detail)
  }
  client.setQueryData(queryKeys.notifications.list(true), { count: 3, unreadCount: 3, notifications })
  client.setQueryData(queryKeys.notifications.list(false), { count: 3, unreadCount: 3, notifications })
}

/** The company side: Kora Systems and the postings board's own five postings. */
export function seedCompany(client: QueryClient) {
  client.setQueryData(queryKeys.company.mine(), {
    company: {
      companyId: 'harness-company',
      companyName: 'Kora Systems',
      verificationStatus: 'VERIFIED',
      contactEmail: 'hiring@kora.example.com',
      companyWebsiteUrl: 'https://korasystems.example.com',
      officeAddress: '14 Rue Njo-Njo, Bonapriso, Douala',
      googleMapsUrl: 'https://maps.google.com/?q=Bonapriso',
      createdAt: daysAgo(90),
    },
  })
  const companyJob = (
    id: string, title: string, type: OpportunityType, modality: WorkModality, city: string | undefined,
    status: JobSummary['postingStatus'], deadline: string | undefined, updatedDaysAgo: number,
  ): JobSummary => ({
    jobId: id, companyId: 'harness-company', companyName: 'Kora Systems', title, description: '',
    opportunityType: type, workModality: modality, postingStatus: status, documentRequirements: [],
    createdAt: daysAgo(updatedDaysAgo + 20), updatedAt: daysAgo(updatedDaysAgo), isOpen: status === 'PUBLISHED',
    city, country: 'Cameroon', ...(deadline ? { applicationDeadline: deadline } : {}),
  })
  const jobs = [
    companyJob('p1', 'Backend Engineer', 'FULL_TIME_JOB', 'HYBRID', 'Douala', 'PUBLISHED', daysAhead(5), 1),
    companyJob('p2', 'Data Engineering Intern', 'PROFESSIONAL_INTERNSHIP', 'REMOTE', undefined, 'PUBLISHED', daysAhead(14), 3),
    companyJob('p3', 'Network Support Trainee', 'ACADEMIC_INTERNSHIP', 'ONSITE', 'Douala', 'DRAFT', undefined, 2),
    companyJob('p4', 'QA Analyst', 'FULL_TIME_JOB', 'ONSITE', 'Douala', 'CLOSED', daysAgo(20), 30),
    companyJob('p5', 'Summer Software Intern 2026', 'ACADEMIC_INTERNSHIP', 'ONSITE', 'Douala', 'EXPIRED', daysAgo(66), 66),
  ]
  // The draft the editor board opens on, filled in the same way.
  jobs[2] = {
    ...jobs[2]!,
    description: 'Support the network operations team across our Douala sites.',
    openings: 3,
    experienceLevel: 'ENTRY',
    skills: ['Networking basics', 'Customer support'],
    salary: { disclosed: true, min: 60000, currency: 'XAF', period: 'MONTH' },
    additionalDetails: [
      { label: 'Duration', value: '6 months' },
      { label: 'Transport', value: 'Shuttle from Bonamoussadi' },
    ],
    documentRequirements: [
      { key: 'cv', label: 'CV', kind: 'FILE', required: true },
      { key: 'transcript', label: 'Transcript', kind: 'FILE', required: true },
      { key: 'schoolAuthorisation', label: 'School authorisation letter', kind: 'FILE', required: true },
    ],
  }
  client.setQueryData(queryKeys.company.postings(), { count: jobs.length, jobs })
  const counts: [string, number, number][] = [['p1', 10, 2], ['p2', 14, 5], ['p3', 0, 0], ['p4', 23, 0], ['p5', 31, 0]]
  client.setQueryData(queryKeys.company.analytics('harness-company'), {
    companyId: 'harness-company',
    postings: jobs.length,
    totalApplications: 78,
    funnel: {},
    offerAcceptanceRate: null,
    byOpportunityType: {},
    perPosting: counts.map(([jobId, applications, newApplications]) => {
      const job = jobs.find((entry) => entry.jobId === jobId)!
      return { jobId, title: job.title, postingStatus: job.postingStatus, applications, newApplications }
    }),
  })
}
