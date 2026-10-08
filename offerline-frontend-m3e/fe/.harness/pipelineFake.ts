import type { ApplicationStatus } from '@/api/enums'
import type { Interview, JobSummary, StatusHistoryEntry } from '@/api/types'

// A stateful stand-in for the recruiter routes the pipeline board calls. It
// follows RECRUITER_TRANSITIONS in src/common/state_machine.py so a bulk run
// refuses what the real API would refuse.

const DAY = 24 * 60 * 60 * 1000
const now = Date.now()
const COMPANY = 'harness-company'

function at(days: number, hour = 11, minute = 0) {
  const d = new Date(now + days * DAY)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

const hex = (seed: string) => seed.padEnd(32, '0').replace(/[^0-9a-f]/g, 'a').slice(0, 32)

export const pipelineJob: JobSummary = {
  jobId: 'p1',
  companyId: COMPANY,
  companyName: 'Kora Systems',
  title: 'Backend Engineer',
  description: '',
  opportunityType: 'FULL_TIME_JOB',
  workModality: 'HYBRID',
  postingStatus: 'PUBLISHED',
  city: 'Douala',
  country: 'Cameroon',
  openings: 2,
  applicationDeadline: at(5, 23, 59),
  salary: { disclosed: true, min: 650000, max: 850000, currency: 'XAF', period: 'MONTH' },
  documentRequirements: [
    { key: 'cv', label: 'CV', kind: 'FILE', required: true },
    { key: 'coverLetter', label: 'Cover letter', kind: 'TEXT', required: true },
    { key: 'portfolio', label: 'Portfolio links', kind: 'TEXT', required: false },
  ],
  createdAt: at(-30),
  updatedAt: at(-1),
  isOpen: true,
}

interface FakeApplication {
  applicationId: string
  applicantId: string
  name: string
  email: string
  phone: string
  cvFile: string
  status: ApplicationStatus
  appliedAt: string
  lastEditedAt?: string
  statusHistory: StatusHistoryEntry[]
  interviews: Interview[]
  answers: Record<string, string>
}

const COVER =
  'I have spent two years building payment APIs in Python for a Douala fintech, and I want to bring that to a team that ships to real customers.'

const entry = (status: ApplicationStatus, by: string, timestamp: string, note?: string): StatusHistoryEntry => ({
  status,
  changedBy: by,
  timestamp,
  ...(note ? { note } : {}),
})

function person(
  id: string,
  name: string,
  email: string,
  cvFile: string,
  appliedDays: number,
  later: (applicant: string) => StatusHistoryEntry[] = () => [],
  extra: Partial<FakeApplication> = {},
): FakeApplication {
  const applicantId = `u-${id}`
  const history = [entry('SUBMITTED', applicantId, at(-appliedDays, 9)), ...later(applicantId)]
  return {
    applicationId: `a-${id}`,
    applicantId,
    name,
    email,
    phone: `+237 6 7${id.length} 40 11 ${10 + appliedDays}`,
    cvFile,
    status: history[history.length - 1]!.status,
    appliedAt: at(-appliedDays, 9),
    statusHistory: history,
    interviews: [],
    answers: id === 'b6' ? { portfolio: 'github.com/amara-nkeng' } : {},
    ...extra,
  }
}

const opened = (days: number) => entry('UNDER_REVIEW', COMPANY, at(-days, 10), 'Opened by the recruiter.')

const applications: FakeApplication[] = [
  person('b1', 'Brice Tchoupo', 'brice.t@mail.cm', 'Brice_Tchoupo_CV.pdf', 1),
  person('b2', 'Joel Mbarga', 'joel.mbarga@mail.cm', 'JMbarga_CV.pdf', 3, () => [], { lastEditedAt: at(-2, 16) }),
  person('b3', 'Clarisse Ngo', 'clarisse.ngo@mail.cm', 'CNgo_Python.pdf', 6, () => [opened(2)]),
  person('b4', 'Esther Ndi', 'esther.ndi@mail.cm', 'Esther_Ndi_CV.pdf', 10, () => [opened(6)]),
  person('b5', 'Paul Etoa', 'paul.etoa@mail.cm', 'Paul_Etoa.pdf', 11, () => [opened(8)]),
  person(
    'b6',
    'Amara Nkeng',
    'amara.nkeng@mail.cm',
    'Backend_CV_v3.pdf',
    13,
    () => [
      opened(10),
      entry('INTERVIEW_SCHEDULED', COMPANY, at(-3, 15), 'Technical round with two engineers. Bring a laptop.'),
    ],
    {
      interviews: [
        {
          interviewId: 'iv-b6-0', scheduledAt: at(3, 14), durationMinutes: 60, mode: 'ONSITE',
          locationOrLink: '14 Rue Njo-Njo, Bonapriso, Douala', state: 'CANCELLED', proposedBy: COMPANY,
          proposedAt: at(-3, 15), sequence: 0,
        },
        {
          interviewId: 'iv-b6-1', scheduledAt: at(4, 10), durationMinutes: 60, mode: 'ONSITE',
          locationOrLink: '14 Rue Njo-Njo, Bonapriso, Douala', state: 'PROPOSED', proposedBy: COMPANY,
          proposedAt: at(-1, 9), sequence: 1, replacesInterviewId: 'iv-b6-0',
        },
      ],
    },
  ),
  person(
    'b7',
    'Nadia Fomba',
    'nadia.fomba@mail.cm',
    'Nadia_Fomba_2026.pdf',
    17,
    () => [opened(14), entry('INTERVIEW_SCHEDULED', COMPANY, at(-4, 12))],
    {
      lastEditedAt: at(-16, 18),
      interviews: [
        {
          interviewId: 'iv-b7-0', scheduledAt: at(4, 14), durationMinutes: 45, mode: 'ONLINE',
          locationOrLink: 'meet.korasystems.cm/nadia-fomba', state: 'CONFIRMED', proposedBy: COMPANY,
          proposedAt: at(-4, 12), sequence: 0, respondedAt: at(-3, 8),
        },
      ],
    },
  ),
  person('b8', 'Lydia Ewane', 'lydia.ewane@mail.cm', 'Lydia_Ewane_CV.pdf', 23, () => [
    opened(21),
    entry('INTERVIEW_SCHEDULED', COMPANY, at(-16, 12)),
    entry('OFFER_EXTENDED', COMPANY, at(-3, 17), 'Offer letter sent by email. Start date is flexible.'),
  ]),
  person('b9', 'Arnaud Biya', 'arnaud.biya@mail.cm', 'Arnaud_Biya.pdf', 22, () => [
    opened(20),
    entry('REJECTED', COMPANY, at(-8, 11), 'We need more production experience with Python services for this role.'),
  ]),
  person('b10', 'Grace Tabi', 'grace.tabi@mail.cm', 'Grace_Tabi_CV.pdf', 24, (me) => [entry('WITHDRAWN', me, at(-11, 20))]),
]

const RECRUITER_TRANSITIONS: Partial<Record<ApplicationStatus, ApplicationStatus[]>> = {
  SUBMITTED: ['UNDER_REVIEW', 'REJECTED'],
  UNDER_REVIEW: ['INTERVIEW_SCHEDULED', 'OFFER_EXTENDED', 'REJECTED'],
  INTERVIEW_SCHEDULED: ['OFFER_EXTENDED', 'REJECTED'],
  OFFER_EXTENDED: ['REJECTED'],
}
const FINAL: ApplicationStatus[] = ['OFFER_ACCEPTED', 'OFFER_DECLINED', 'REJECTED', 'WITHDRAWN']

function moveTo(application: FakeApplication, status: ApplicationStatus, note?: string): string | null {
  const allowed = RECRUITER_TRANSITIONS[application.status] ?? []
  if (FINAL.includes(application.status)) return `This application is already ${application.status.toLowerCase()} and cannot change again.`
  if (!allowed.includes(status)) {
    return `An application that is ${application.status.toLowerCase().replace('_', ' ')} cannot move to ${status.toLowerCase().replace('_', ' ')}.`
  }
  application.status = status
  application.statusHistory = [...application.statusHistory, entry(status, COMPANY, new Date().toISOString(), note)]
  return null
}

function nextInterview(application: FakeApplication) {
  const live = application.interviews.filter((interview) => interview.state !== 'CANCELLED' && interview.state !== 'DECLINED')
  if (live.length === 0) return null
  const soonest = live.reduce((a, b) => (a.scheduledAt < b.scheduledAt ? a : b))
  return { scheduledAt: soonest.scheduledAt, state: soonest.state }
}

function row(application: FakeApplication) {
  return {
    applicationId: application.applicationId,
    applicantId: application.applicantId,
    applicantName: application.name,
    applicantEmail: application.email,
    status: application.status,
    appliedAt: application.appliedAt,
    lastEditedAt: application.lastEditedAt,
    statusChangedAt: application.statusHistory[application.statusHistory.length - 1]!.timestamp,
    isFinal: FINAL.includes(application.status),
    interviewCount: application.interviews.length,
    nextInterview: nextInterview(application),
  }
}

function recruiterView(application: FakeApplication) {
  return {
    applicationId: application.applicationId,
    jobId: pipelineJob.jobId,
    jobTitle: pipelineJob.title,
    companyName: 'Kora Systems',
    applicant: {
      userId: application.applicantId,
      fullName: application.name,
      email: application.email,
      phone: application.phone,
      skills: [],
      academicInfo: {},
    },
    status: application.status,
    statusHistory: application.statusHistory,
    appliedAt: application.appliedAt,
    ...(application.lastEditedAt ? { lastEditedAt: application.lastEditedAt } : {}),
    coverLetter: COVER,
    answers: application.answers,
    interviews: application.interviews,
    documentUrls: {
      cv: `https://harness.invalid/applications/${application.applicantId}/${hex(application.applicationId)}-${application.cvFile}?X-Amz-Signature=fake`,
    },
  }
}

const jobs = new Map<string, JobSummary>([[pipelineJob.jobId, pipelineJob]])

// A few postings for the other companies, so the admin drawer has some to show.
for (const [id, companyId, companyName, title, status, type, days] of [
  ['x-acme-1', 'c-acme', 'Acme Robotics', 'Robotics Technician', 'PUBLISHED', 'FULL_TIME_JOB', 3],
  ['x-acme-2', 'c-acme', 'Acme Robotics', 'Embedded Software Intern', 'PUBLISHED', 'PROFESSIONAL_INTERNSHIP', 6],
  ['x-acme-3', 'c-acme', 'Acme Robotics', 'Field Service Engineer', 'CLOSED', 'FULL_TIME_JOB', 40],
  ['x-volta-1', 'c-volta', 'Volta Energy', 'Solar Installer', 'PUBLISHED', 'FULL_TIME_JOB', 9],
  ['x-volta-2', 'c-volta', 'Volta Energy', 'Grid Research Intern', 'PUBLISHED', 'ACADEMIC_INTERNSHIP', 12],
  ['x-savanna-1', 'c-savanna', 'Savanna Pay', 'Payments Analyst', 'DRAFT', 'FULL_TIME_JOB', 2],
  ['x-bright-1', 'c-bright', 'Brightlane Recruiting', 'Sales Associate', 'CLOSED', 'FULL_TIME_JOB', 50],
] as const) {
  jobs.set(id, {
    jobId: id, companyId, companyName, title, opportunityType: type, workModality: 'ONSITE', city: 'Douala', country: 'Cameroon',
    description: `${companyName} is hiring a ${title.toLowerCase()} to join its Douala team.

You will work alongside the operations lead and report weekly.`,
    skills: ['Teamwork', 'Customer care'], openings: 2,
    salary: { disclosed: true, min: 250000, max: 400000, currency: 'XAF', period: 'MONTH' },
    additionalDetails: [{ label: 'Transport', value: 'Company shuttle from Akwa' }],
    applicationDeadline: at(14, 23, 59),
    postingStatus: status,
    documentRequirements: [
      { key: 'cv', label: 'CV', kind: 'FILE', required: true },
      { key: 'coverLetter', label: 'Cover letter', kind: 'FILE', required: true },
      { key: 'portfolio', label: 'Portfolio links', kind: 'TEXT', required: false },
    ],
    createdAt: at(-days), updatedAt: at(-2), isOpen: status === 'PUBLISHED',
  })
}

/** The postings the harness seeds into the cache, so their editors can load. */
export function registerJobs(list: JobSummary[]) {
  for (const job of list) if (!jobs.has(job.jobId)) jobs.set(job.jobId, { ...job })
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const problem = (status: number, code: string, message: string) => json({ error: { code, message } }, status)

/** Answers a pipeline route, or returns null for anything else. */
const adminCompanies = (() => {
  const company = (
    id: string, name: string, site: string, email: string, status: string, createdDays: number,
    extra: Record<string, unknown> = {},
  ) => ({
    companyId: id, companyName: name, companyWebsiteUrl: `https://${site}`, contactEmail: email,
    verificationStatus: status, createdAt: at(-createdDays, 9), officeAddress: 'Douala, Cameroon', ...extra,
  })
  return [
    company('c-savanna', 'Savanna Pay', 'savannapay.cm', 'hr@savannapay.cm', 'PENDING_VERIFICATION', 9),
    company('c-bloom', 'Bloom Retail', 'bloomretail.cm', 'people@bloomretail.cm', 'PENDING_VERIFICATION', 6),
    company('c-north', 'Northfield Telecom', 'northfield.cm', 'talent@northfield.cm', 'PENDING_VERIFICATION', 5),
    company('c-tandem', 'Tandem Studio', 'tandem.studio', 'hello@tandem.studio', 'PENDING_VERIFICATION', 4),
    company('c-freight', 'Douala Freight Co', 'doualafreight.cm', 'jobs@doualafreight.cm', 'PENDING_VERIFICATION', 3),
    company('c-mbe', 'Mbe Agritech', 'mbeagri.cm', 'careers@mbeagri.cm', 'PENDING_VERIFICATION', 2),
    company('c-lumen', 'Lumen Health', 'lumenhealth.cm', 'recruit@lumenhealth.cm', 'PENDING_VERIFICATION', 1),
    company('c-kribi', 'Kribi Solar', 'kribisolar.cm', 'team@kribisolar.cm', 'PENDING_VERIFICATION', 0),
    company('harness-company', 'Kora Systems', 'korasystems.example.com', 'hiring@kora.example.com', 'VERIFIED', 90, {
      verifiedAt: at(-88, 14),
      moderationHistory: [{ from: 'PENDING_VERIFICATION', to: 'VERIFIED', by: 'admin-2', note: '', timestamp: at(-88, 14) }],
    }),
    company('c-acme', 'Acme Robotics', 'acmerobotics.example.com', 'acme.robotics@example.com', 'VERIFIED', 40, {
      createdByAdmin: 'harness-admin',
      verifiedAt: at(-40, 9),
      moderationHistory: [{ from: 'NONE', to: 'VERIFIED', by: 'harness-admin', note: 'Account created by an administrator.', timestamp: at(-40, 9) }],
    }),
    company('c-volta', 'Volta Energy', 'voltaenergy.cm', 'hr@voltaenergy.cm', 'VERIFIED', 22, {
      verifiedAt: at(-20, 11),
      googleMapsUrl: 'https://maps.google.com/?q=Akwa',
      moderationHistory: [
        { from: 'PENDING_VERIFICATION', to: 'VERIFIED', by: 'admin-2', note: 'Registration matches the business register.', timestamp: at(-20, 11) },
      ],
    }),
    company('c-quick', 'QuickCash Jobs', 'quickcashjobs.biz', 'admin@quickcashjobs.biz', 'REJECTED', 15, {
      verifiedAt: at(-13, 16),
      moderationHistory: [
        { from: 'PENDING_VERIFICATION', to: 'REJECTED', by: 'harness-admin', note: 'The website does not name a registered business or an office address.', timestamp: at(-13, 16) },
      ],
    }),
    company('c-bright', 'Brightlane Recruiting', 'brightlane.cm', 'ops@brightlane.cm', 'SUSPENDED', 60, {
      verifiedAt: at(-6, 10),
      moderationHistory: [
        { from: 'PENDING_VERIFICATION', to: 'VERIFIED', by: 'admin-2', note: '', timestamp: at(-58, 10) },
        { from: 'VERIFIED', to: 'SUSPENDED', by: 'harness-admin', note: 'Postings asked applicants for a fee to be considered.', timestamp: at(-6, 10) },
      ],
    }),
  ]
})()

export function handlePipeline(
  method: string,
  path: string,
  body: Record<string, unknown>,
  query: URLSearchParams = new URLSearchParams(),
): Response | null {
  const companyStatus = /^\/companies\/([^/]+)\/status$/.exec(path)
  if (method === 'PATCH' && companyStatus) {
    const company = adminCompanies.find((item) => item.companyId === companyStatus[1]) as Record<string, unknown> | undefined
    if (!company) return problem(404, 'NOT_FOUND', 'Company not found.')
    const from = String(company.verificationStatus)
    const to = String(body.verificationStatus)
    const allowed: Record<string, string[]> = {
      PENDING_VERIFICATION: ['VERIFIED', 'REJECTED'], VERIFIED: ['SUSPENDED'], REJECTED: ['VERIFIED'], SUSPENDED: ['VERIFIED'],
    }
    if (!allowed[from]?.includes(to)) return problem(409, 'CONFLICT', `An account that is ${from.toLowerCase()} cannot be set to ${to.toLowerCase()}.`)
    let unpublished = 0
    if (to === 'SUSPENDED' || to === 'REJECTED') {
      for (const job of jobs.values()) {
        if (job.companyId === company.companyId && job.postingStatus === 'PUBLISHED') {
          job.postingStatus = 'CLOSED'
          unpublished += 1
        }
      }
    }
    const now = new Date().toISOString()
    Object.assign(company, {
      verificationStatus: to, verifiedAt: now, verifiedBy: 'harness-admin', moderationNote: String(body.note ?? ''),
      moderationHistory: [...((company.moderationHistory as unknown[]) ?? []), { from, to, by: 'harness-admin', note: String(body.note ?? ''), timestamp: now }],
    })
    return json({ company, postingsUnpublished: unpublished })
  }

  const analytics = /^\/companies\/([^/]+)\/analytics$/.exec(path)
  if (method === 'GET' && analytics) {
    const own = [...jobs.values()].filter((job) => job.companyId === analytics[1])
    return json({
      companyId: analytics[1], postings: own.length, totalApplications: 0, funnel: {}, offerAcceptanceRate: null, byOpportunityType: {},
      perPosting: own.map((job) => ({ jobId: job.jobId, title: job.title, postingStatus: job.postingStatus, applications: job.jobId === 'p1' ? 10 : 3, newApplications: 0 })),
    })
  }

  if (method === 'POST' && path === '/admin/companies') {
    const email = String(body.contactEmail ?? '').toLowerCase()
    if (adminCompanies.some((item) => item.contactEmail.toLowerCase() === email)) {
      return json({ error: { code: 'CONFLICT', message: 'An account already exists for that email address.', details: { contactEmail: email } } }, 409)
    }
    const now = new Date().toISOString()
    const status = body.verifyNow === false ? 'PENDING_VERIFICATION' : 'VERIFIED'
    const company = {
      companyId: `c-new-${Date.now()}`, companyName: String(body.companyName), companyWebsiteUrl: String(body.companyWebsiteUrl),
      contactEmail: email, verificationStatus: status, createdAt: now, createdByAdmin: 'harness-admin',
      officeAddress: (body.officeAddress as string) || undefined, googleMapsUrl: (body.googleMapsUrl as string) || undefined,
      ...(status === 'VERIFIED' ? { verifiedAt: now, verifiedBy: 'harness-admin' } : {}),
      moderationHistory: [{ from: 'NONE', to: status, by: 'harness-admin', note: 'Account created by an administrator.', timestamp: now }],
    }
    adminCompanies.push(company as (typeof adminCompanies)[number])
    return json({ company, accountCreated: true, temporaryPasswordSentTo: email }, 201)
  }

  if (method === 'GET' && path === '/jobs') {
    const live = [...jobs.values()]
      .filter((job) => job.postingStatus === 'PUBLISHED' && (!job.applicationDeadline || new Date(job.applicationDeadline).getTime() > Date.now()))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return json({ count: live.length, jobs: live })
  }

  if (method === 'GET' && path === '/companies') {
    const status = query.get('status') ?? 'PENDING_VERIFICATION'
    // ?emptyqueue=1 on the page shows the overview with nobody waiting.
    const emptied = new URLSearchParams(location.search).get('emptyqueue') && status === 'PENDING_VERIFICATION'
    const companies = emptied ? [] : adminCompanies.filter((company) => company.verificationStatus === status)
    return json({ status, count: companies.length, companies })
  }

  const find = (id: string) => applications.find((application) => application.applicationId === id)

  if (method === 'GET' && path === '/admin/overview') {
    return json({
      approximateCounts: { users: 1284, companies: 13, postings: 212, applications: 3907 },
      countsAreApproximate: true,
      awaitingVerification: new URLSearchParams(location.search).get('emptyqueue')
        ? 0
        : adminCompanies.filter((company) => company.verificationStatus === 'PENDING_VERIFICATION').length,
    })
  }

  if (method === 'GET' && path === '/jobs/mine/p1') return json({ job: pipelineJob })
  if (method === 'GET' && path.startsWith('/jobs/p1/applications')) {
    return json({ job: { jobId: 'p1', title: pipelineJob.title }, count: applications.length, applications: applications.map(row) })
  }

  const detail = /^\/applications\/([^/]+)$/.exec(path)
  if (method === 'GET' && detail) {
    const application = find(detail[1]!)
    if (!application) return problem(404, 'NOT_FOUND', 'Application not found.')
    if (application.status === 'SUBMITTED') moveTo(application, 'UNDER_REVIEW', 'Opened by the recruiter.')
    return json({ application: recruiterView(application) })
  }

  const status = /^\/applications\/([^/]+)\/status$/.exec(path)
  if (method === 'PATCH' && status) {
    const application = find(status[1]!)!
    const refused = moveTo(application, body.status as ApplicationStatus, (body.note as string) || undefined)
    if (refused) return problem(409, 'INVALID_STATUS_TRANSITION', refused)
    return json({
      application: {
        applicationId: application.applicationId,
        status: application.status,
        statusHistory: application.statusHistory,
        isFinal: FINAL.includes(application.status),
      },
    })
  }

  const interview = /^\/applications\/([^/]+)\/interview$/.exec(path)
  if (interview && (method === 'POST' || method === 'PATCH')) {
    const application = find(interview[1]!)!
    if (new Date(String(body.scheduledAt)).getTime() <= Date.now()) {
      return problem(400, 'VALIDATION_FAILED', 'An interview cannot be scheduled for a time already past.')
    }
    const slot = {
      scheduledAt: String(body.scheduledAt),
      durationMinutes: Number(body.durationMinutes),
      mode: body.mode as Interview['mode'],
      locationOrLink: String(body.locationOrLink),
      state: 'PROPOSED' as const,
      proposedBy: COMPANY,
      proposedAt: new Date().toISOString(),
    }
    if (method === 'POST') {
      const created = { ...slot, interviewId: `iv-${Date.now()}`, sequence: 0 }
      application.interviews = [...application.interviews, created]
      application.status = 'INTERVIEW_SCHEDULED'
      application.statusHistory = [
        ...application.statusHistory,
        entry('INTERVIEW_SCHEDULED', COMPANY, new Date().toISOString(), 'Interview scheduled.'),
      ]
      return json({ interview: created, status: application.status }, 201)
    }
    const index = application.interviews.map((item) => item.state).lastIndexOf('PROPOSED')
    const open = index >= 0 ? index : application.interviews.map((item) => item.state).lastIndexOf('CONFIRMED')
    const old = application.interviews[open]!
    application.interviews = [
      ...application.interviews.map((item, i) => (i === open ? { ...item, state: 'CANCELLED' as const } : item)),
      { ...slot, interviewId: `iv-${Date.now()}`, sequence: application.interviews.length, replacesInterviewId: old.interviewId },
    ]
    return json({ interviews: application.interviews })
  }

  if (method === 'PATCH' && path === '/jobs/p1/applications/bulk-status') {
    const target = body.status as ApplicationStatus
    const updated: string[] = []
    const refused: { applicationId: string; reason: string }[] = []
    for (const id of body.applicationIds as string[]) {
      const application = find(id)
      const reason = application ? moveTo(application, target, (body.note as string) || undefined) : 'Not found.'
      if (reason) refused.push({ applicationId: id, reason })
      else updated.push(id)
    }
    return json({ updated, refused, status: target })
  }

  if (method === 'POST' && path === `/companies/${COMPANY}/export`) {
    return json({ rows: applications.length, downloadUrl: 'https://harness.invalid/export/applications.csv', expiresInSeconds: 300 }, 201)
  }

  const mine = /^\/jobs\/mine\/([^/]+)$/.exec(path)
  if (method === 'GET' && mine) {
    const job = jobs.get(mine[1]!)
    return job ? json({ job }) : problem(404, 'NOT_FOUND', 'Posting not found.')
  }

  if (method === 'POST' && path === '/jobs') {
    if (!String(body.title ?? '').trim() || !String(body.description ?? '').trim()) {
      return problem(400, 'VALIDATION_FAILED', 'Some fields need attention.')
    }
    const now = new Date().toISOString()
    const job = { ...body, jobId: `j-${Date.now()}`, companyId: COMPANY, companyName: 'Kora Systems', postingStatus: 'DRAFT', createdAt: now, updatedAt: now, isOpen: false } as unknown as JobSummary
    jobs.set(job.jobId, job)
    return json({ job }, 201)
  }

  const posting = /^\/jobs\/([^/]+)$/.exec(path)
  if (method === 'PATCH' && posting) {
    const job = jobs.get(posting[1]!)
    if (!job) return problem(404, 'NOT_FOUND', 'Posting not found.')
    if (body.postingStatus === 'PUBLISHED' && (window as unknown as { __companyPending?: boolean }).__companyPending) {
      return problem(403, 'FORBIDDEN', 'This posting cannot be published until the company account is verified.')
    }
    // The real API keeps the type a posting was created with.
    const { opportunityType: _ignored, ...changes } = body
    Object.assign(job, changes, { updatedAt: new Date().toISOString() })
    job.isOpen = job.postingStatus === 'PUBLISHED'
    return json({ job })
  }

  return null
}
