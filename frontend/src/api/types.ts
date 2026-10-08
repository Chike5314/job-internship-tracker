import type {
  ApplicationStatus,
  ExperienceLevel,
  InterviewMode,
  InterviewState,
  OpportunityType,
  SalaryPeriod,
  WorkModality,
} from './enums'

export interface DocumentRequirement {
  key: string
  label: string
  kind: 'FILE' | 'TEXT'
  required: boolean
}

export interface LabelValue {
  label: string
  value: string
}

export interface Salary {
  disclosed: boolean
  min?: number
  max?: number
  currency?: string
  period?: SalaryPeriod
}

// From _job_view(full=False) in jobs_service/handler.py. `full=True`, which
// only the owning company sees, additionally carries unpublishedAt.
export interface JobSummary {
  jobId: string
  companyId: string
  companyName: string
  title: string
  description: string
  opportunityType: OpportunityType
  workModality: WorkModality
  postingStatus: 'DRAFT' | 'PUBLISHED' | 'CLOSED' | 'EXPIRED'
  documentRequirements: DocumentRequirement[]
  createdAt: string
  isOpen: boolean
  applicationDeadline?: string
  salary?: Salary
  city?: string
  country?: string
  experienceLevel?: ExperienceLevel
  openings?: number
  startDate?: string
  duration?: string
  skills?: string[]
  additionalDetails?: LabelValue[]
  updatedAt?: string
  /** Set when a suspension closed the posting. Owner view only. */
  unpublishedAt?: string
}

// From _company_snippet in jobs_service/handler.py. Address/map fields are
// present only for ONSITE and HYBRID postings, so render on presence
// rather than on modality.
export interface CompanySnippet {
  companyId: string
  companyName: string
  verificationStatus: 'PENDING_VERIFICATION' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED'
  companyWebsiteUrl?: string
  googleMapsUrl?: string
  officeAddress?: string
}

export interface StatusHistoryEntry {
  status: ApplicationStatus
  changedBy: string
  timestamp: string
  note?: string
}

export interface Interview {
  interviewId: string
  scheduledAt: string
  durationMinutes: number
  mode: InterviewMode
  locationOrLink: string
  state: InterviewState
  proposedBy: string
  proposedAt: string
  sequence: number
  replacesInterviewId?: string
  respondedAt?: string
  /** Which round of the interview stage this is. Missing on interviews booked
   *  before rounds existed, which were all a first round or a reschedule of
   *  one; `interviewRound` in lib/interviews.ts infers it for those. */
  round?: number
  /** The company's name for the round, such as Technical or Final. */
  roundLabel?: string
  /** Set when the company marks the round complete. */
  completedAt?: string
  outcomeNote?: string
}

// From _applicant_view(detailed=False) in application_service/handler.py.
export interface ApplicationSummary {
  applicationId: string
  jobId: string
  jobTitle: string
  companyName: string
  opportunityType: OpportunityType
  status: ApplicationStatus
  appliedAt: string
  canEdit: boolean
  isFinal: boolean
  lastEditedAt?: string
}

// _applicant_view(detailed=True) adds these on top of ApplicationSummary.
export interface ApplicationDetail extends ApplicationSummary {
  statusHistory: StatusHistoryEntry[]
  answers: Record<string, string>
  interviews: Interview[]
  documentUrls: Record<string, string>
  documentRequirements: DocumentRequirement[]
  coverLetter?: string
}

// From _recruiter_view in application_service/handler.py: what the company
// reads on GET /applications/{id}. It carries no documentRequirements, so the
// labels for documentUrls come from the posting.
export interface RecruiterApplication {
  applicationId: string
  jobId: string
  jobTitle?: string
  companyName?: string
  applicant: {
    userId: string
    fullName?: string
    email?: string
    phone?: string
    skills?: string[]
    academicInfo?: AcademicInfo
  }
  status: ApplicationStatus
  statusHistory: StatusHistoryEntry[]
  appliedAt: string
  lastEditedAt?: string
  coverLetter?: string
  answers: Record<string, string>
  interviews: Interview[]
  documentUrls: Record<string, string>
  /** The same files, served to be shown in the page rather than saved. */
  documentPreviewUrls?: Record<string, string>
}

// From admin_overview in company_service/handler.py. The four totals come
// from table metadata DynamoDB refreshes about every six hours, so they are
// approximate; the queue is counted exactly off its index.
export interface AdminOverview {
  approximateCounts: { users: number; companies: number; postings: number; applications: number }
  countsAreApproximate: boolean
  awaitingVerification: number
}

// The narrower shape PATCH /applications/{id}/status returns.
export interface ApplicationStatusView {
  applicationId: string
  status: ApplicationStatus
  statusHistory: StatusHistoryEntry[]
  isFinal: boolean
}

export interface AcademicInfo {
  schoolName?: string
  fieldOfStudy?: string
  degreeLevel?: string
}

// From _presentable in auth_service/handler.py. Note the naming: this
// returns *Url fields (presigned GETs); POST /profile takes *S3Key /
// *Url-named-but-actually-a-key fields on the way in (see profile.ts).
export interface Profile {
  userId: string
  email: string
  role: 'APPLICANT' | 'ADMIN'
  fullName: string
  createdAt: string
  cvCount: number
  phone?: string
  skills?: string[]
  academicInfo?: AcademicInfo
  profilePictureUrl?: string
  hasTranscript?: boolean
  transcriptUrl?: string
}

export interface CvEntry {
  cvId: string
  label: string
  s3Key: string
  uploadedAt: string
  downloadUrl: string
}

export interface UploadUrlResponse {
  uploadUrl: string
  s3Key: string
  expiresInSeconds: number
}

/** What a CV upload URL comes back with: the key the upload is going to and the
 *  label the library will use, neither of which is recorded until the upload
 *  has landed and POST /profile/cvs has confirmed it. */
export interface PendingCv {
  s3Key: string
  label: string
}

export interface Notification {
  userId: string
  createdAt: string
  notificationId: string
  type: string
  message: string
  read: boolean
  expiresAt: number
  link?: string
}

// ----------------------------------------------------------------------
// Company side
//
// Everything below is only ever seen by a recruiter or an admin, behind the
// authorizer-protected routes.
// ----------------------------------------------------------------------

/** From _public_view(full=True) in company_service/handler.py. */
export interface CompanyFull extends CompanySnippet {
  contactEmail: string
  createdAt: string
  /** A presigned link, not a key: the API swaps the key for one on read. */
  logoUrl?: string
  officeAddress?: string
  /** The admin who created the account, when one did (FR-9.6). */
  createdByAdmin?: string
  /** The latest decision: who took it, when, and the note given. */
  verifiedBy?: string
  verifiedAt?: string
  moderationNote?: string
  moderationHistory?: ModerationEntry[]
}

/** One decision, as set_verification_status and admin_create_company append it
 *  (FR-9.8). `from` is NONE on the entry written when an admin creates the
 *  account, since there was no standing before it. */
export interface ModerationEntry {
  from: CompanySnippet['verificationStatus'] | 'NONE'
  to: CompanySnippet['verificationStatus']
  by: string
  timestamp: string
  note?: string
}

/** From _pipeline_row in jobs_service/handler.py. The pipeline deliberately
 *  carries no documents: a recruiter opens one application to read those, and
 *  opening is what freezes it. */
export interface PipelineRow {
  applicationId: string
  applicantId: string
  applicantName: string
  applicantEmail: string
  status: ApplicationStatus
  appliedAt: string
  /** When the application last moved, which is what time in stage counts from. */
  statusChangedAt: string
  isFinal: boolean
  interviewCount: number
  /** Interview rounds the company has marked complete. */
  roundsCompleted?: number
  lastEditedAt?: string
  /** The soonest interview still standing, absent once none is. */
  nextInterview?: { scheduledAt: string; state: InterviewState; round?: number; roundLabel?: string } | null
}

/** Every status, including the ones with no applications in them, because the
 *  funnel is built from the full status list rather than from what happens to
 *  be present. */
export type FunnelCounts = Record<ApplicationStatus, number>

export interface JobAnalytics {
  jobId: string
  title: string
  totalApplications: number
  funnel: FunnelCounts
  applicantsPerOffer: number | null
  averageHoursInStage: Record<string, number>
}

export interface CompanyAnalytics {
  companyId: string
  postings: number
  totalApplications: number
  funnel: FunnelCounts
  offerAcceptanceRate: number | null
  byOpportunityType: Record<string, number>
  perPosting: {
    jobId: string
    title: string
    postingStatus: JobSummary['postingStatus']
    applications: number
    /** Still at SUBMITTED, which is what nobody having opened it means. */
    newApplications: number
  }[]
}

/** One of a person's applications to this company, as the applicants directory
 *  carries it. Lighter than PipelineRow: the name and email sit on the person
 *  above rather than being repeated on every application under them. */
export interface ApplicantApplication {
  applicationId: string
  jobId: string
  jobTitle?: string
  status: ApplicationStatus
  appliedAt: string
  statusChangedAt: string
  isFinal: boolean
  interviewCount: number
  nextInterview?: { scheduledAt: string; state: InterviewState; round?: number; roundLabel?: string } | null
}

/** From company_applicants in jobs_service/handler.py: one row per person
 *  rather than per application, which is the whole point of that route. Every
 *  other recruiter view is organised by posting, so this is the only place a
 *  repeat applicant reads as one candidate with a history. */
export interface CompanyApplicant {
  applicantId: string
  fullName?: string
  email?: string
  phone?: string
  skills: string[]
  academicInfo?: AcademicInfo
  applicationCount: number
  firstAppliedAt?: string
  /** The last time any of their applications moved. */
  lastActivityAt?: string
  /** How far they got across all of them, not where the newest one sits. */
  furthestStatus: ApplicationStatus
  /** Still in play somewhere, which is what separates somebody to act on from
   *  somebody already dealt with. */
  isActive: boolean
  /** Applications nobody has opened yet. */
  awaitingReview: number
  /** Offers and interview invitations they have not answered. */
  awaitingTheirReply: number
  /** Newest first. */
  applications: ApplicantApplication[]
}

/** One row of the company calendar, served off the sparse GSI: an application
 *  appears here while it has an interview that nothing has closed out.
 *
 *  Note "nothing has closed out" rather than "still ahead of it". The clock
 *  passing an interview writes nothing to the application, so a row whose time
 *  has gone stays on the index with a timestamp in the past. Those come back
 *  under `awaitingOutcome` instead of `interviews`. */
export interface CompanyInterview {
  applicationId: string
  jobId: string
  jobTitle?: string
  applicantId: string
  applicantName?: string
  status: ApplicationStatus
  scheduledAt: string
  durationMinutes: number
  mode: InterviewMode
  locationOrLink: string
  interviewState: InterviewState
  round?: number
  roundLabel?: string
}

export interface BulkStatusResult {
  updated: string[]
  refused: { applicationId: string; reason: string }[]
  status: ApplicationStatus
}

export interface ExportResult {
  rows: number
  downloadUrl: string
  expiresInSeconds: number
}
