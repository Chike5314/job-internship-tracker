import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { usePostingsList } from '@/features/postings/usePostings'
import { OpeningCard } from './OpeningCard'
import { CompanyPipelinePreview } from './CompanyPipelinePreview'
import { useLocationFacets } from '@/features/postings/usePostings'
import { ButtonLink } from '@/ui/ButtonLink'
import { Button } from '@/ui/Button'
import { Icon, type IconName } from '@/ui/Icon'
import { Skeleton } from '@/ui/Skeleton'
import { HeroPreview } from './HeroPreview'
import { HeroScene } from '@/ui/illustrations'
import { Photo } from '@/ui/Photo'
import { StatusTag, type ApplicationStatus } from '@/ui/StatusTag'
import { photos } from '@/assets/photos/manifest'
import styles from './LandingPage.module.css'

const TYPE_PILLS: { value: string; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'FULL_TIME_JOB', label: 'Full-time jobs' },
  { value: 'PROFESSIONAL_INTERNSHIP', label: 'Professional internships' },
  { value: 'ACADEMIC_INTERNSHIP', label: 'Academic internships' },
]

const ASSURANCES: { icon: IconName; heading: string; body: string }[] = [
  {
    icon: 'verified',
    heading: 'Verified companies',
    body: 'Every company is checked before its first posting goes live.',
  },
  {
    icon: 'document',
    heading: 'Fast, focused applications',
    body: 'Your profile pre-fills the form. You only add what that posting asks for.',
  },
  {
    icon: 'notification',
    heading: 'Notified in real time',
    body: 'An email and an alert in the app every time an application moves.',
  },
]

const TRACKS: { icon: IconName; title: string; who: string; documents: string[] }[] = [
  {
    icon: 'job',
    title: 'Full-time jobs',
    who: 'For job seekers and working professionals.',
    documents: ['A CV written for the role', 'Cover letter', 'Work experience', 'Portfolio links, optional'],
  },
  {
    icon: 'internship',
    title: 'Professional internships',
    who: 'For students, recent graduates and career changers.',
    documents: ['A CV written for the role', 'Cover letter', 'When you can start, and for how long'],
  },
  {
    icon: 'skills',
    title: 'Academic internships',
    who: 'For students enrolled at a university or college.',
    documents: [
      'A CV written for the role',
      'School, field, level and transcript',
      "Your school's authorisation letter",
    ],
  },
]

const STEPS = [
  {
    title: 'Sign in',
    body: 'Use Google or an email address. Companies register separately and are verified first.',
  },
  {
    title: 'Fill in your profile once',
    body: 'Contact details, skills and, if you study, your school. They pre-fill every form.',
  },
  {
    title: 'Apply with the right CV',
    body: 'Upload a CV for this role or reuse one of your ten most recent. What you send stays exactly as sent.',
  },
  {
    title: 'Follow it to an answer',
    body: 'Alerts on every change, interview invitations you can add to your calendar, and the full history.',
  },
]

/** The pipeline as the state machine actually runs it, ending in the three
 *  ways an application can close. */
// Real statuses rather than five strings, so this section renders with the same
// StatusTag the pipeline and the applications list use. That is the point of the
// section: a visitor sees the exact tags they will be reading later, in the
// tones the token file assigns them, including the one solid tag that marks the
// state demanding an answer.
const PIPELINE: ApplicationStatus[] = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'INTERVIEW_SCHEDULED',
  'OFFER_EXTENDED',
  'OFFER_ACCEPTED',
]

const ENDINGS: { status: ApplicationStatus; body: string }[] = [
  {
    status: 'REJECTED',
    body: 'The company closes the application at any point before an offer.',
  },
  {
    status: 'WITHDRAWN',
    body: 'You withdraw your own application at any point before a final decision.',
  },
  { status: 'OFFER_DECLINED', body: 'You turn down an offer that was extended to you.' },
]

const FOR_COMPANIES: { icon: IconName; heading: string; body: string }[] = [
  {
    icon: 'verified',
    heading: 'Verified once, trusted after',
    body: 'Registering is your verification request. Postings go live when an admin approves you.',
  },
  {
    icon: 'interview',
    heading: 'Interviews that land in calendars',
    body: 'Schedule onsite or online. Both sides get an invitation with a calendar file, and applicants confirm in one click.',
  },
  {
    icon: 'bulk',
    heading: 'Move many applications at once',
    body: 'Update up to fifty in one step, each checked on its own, and export any pipeline to CSV.',
  },
  {
    icon: 'company',
    heading: 'Postings outlive the people who wrote them',
    body: 'The account belongs to the company, so a pipeline stays put when someone moves on.',
  },
]

export function LandingPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [city, setCity] = useState('')
  const [type, setType] = useState<string>('ALL')
  const { cities } = useLocationFacets()

  // The strip below the hero is the real listing, not a mock of one. It shares
  // its query key with the browse page, so arriving there costs no second call.
  const postings = usePostingsList({})
  const openings = postings.data?.jobs ?? []
  const newest = openings.slice(0, 6)

  function onSearch(event: FormEvent) {
    event.preventDefault()
    const params = new URLSearchParams()
    if (query.trim()) params.set('q', query.trim())
    if (city) params.set('city', city)
    if (type !== 'ALL') params.set('type', type)
    navigate(`/postings${params.toString() ? `?${params}` : ''}`)
  }

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroText}>
          <p className={styles.badge}>
            <Icon name="verified" size={16} />
            Every company is verified before it can post
          </p>
          <h1 className={['t-display-xl', styles.headline].join(' ')}>
            Your next opportunity is on{' '}
            <span className={['t-display-italic', styles.brandWord].join(' ')}>Offerline.</span>
          </h1>
          <p className={styles.positioning}>
            Opportunity, organized. <span className={styles.accelerated}>Success, accelerated.</span>
          </p>
          <p className={['t-body-lg', styles.lede].join(' ')}>
            Find full-time jobs and internships, apply with exactly what each role asks for, and
            follow every application until you have an answer.
          </p>

          <form className={styles.search} onSubmit={onSearch} role="search">
            <div className={styles.searchField}>
              <Icon name="search" size={18} />
              <input
                className={styles.searchInput}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search jobs, internships or companies"
                aria-label="Search jobs, internships or companies"
              />
            </div>
            <select
              className={styles.city}
              value={city}
              onChange={(event) => setCity(event.target.value)}
              aria-label="City"
            >
              <option value="">All cities</option>
              {cities.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <Button type="submit" variant="primary" size="lg">
              Search
            </Button>
          </form>

          {/* The same three opportunity types the postings list filters on, so a
              visitor lands on the browse page already narrowed rather than
              arriving at everything and starting again. */}
          <div className={styles.pills}>
            {TYPE_PILLS.map((pill) => (
              <button
                key={pill.value}
                type="button"
                aria-pressed={type === pill.value}
                className={[styles.pill, type === pill.value ? styles.pillOn : ''].join(' ')}
                onClick={() => setType(pill.value)}
              >
                {pill.label}
              </button>
            ))}
          </div>

          <p className={['t-body-sm', styles.hiring].join(' ')}>
            Hiring?{' '}
            <Link to="/sign-up?account=company" className={styles.link}>
              Register your company
            </Link>
          </p>
        </div>

        <div className={styles.heroVisual}>
          <HeroScene backdrop className={styles.heroArt} />
          <HeroPreview />
        </div>
      </section>

      <section className={styles.assurances}>
        {ASSURANCES.map((item) => (
          <div key={item.heading} className={styles.assurance}>
            <span className={styles.assuranceIcon}>
              <Icon name={item.icon} size={18} />
            </span>
            <p className="t-heading-sm">{item.heading}</p>
            <p className={['t-body-sm', styles.muted].join(' ')}>{item.body}</p>
          </div>
        ))}
      </section>

      <section className={[styles.block, styles.reveal].join(' ')} id="open">
        <header className={styles.blockHead}>
          <div>
            <h2 className="t-display-md">Open right now</h2>
            <p className={['t-body', styles.muted].join(' ')}>
              Newest first. Salary is shown whenever the company chooses to disclose it.
            </p>
          </div>
          <span className={styles.blockAside}>
            {openings.length > 0 && (
              <span className={['t-body-sm', styles.muted].join(' ')}>
                {openings.length} opening{openings.length === 1 ? '' : 's'}
              </span>
            )}
            <ButtonLink variant="tonal" to="/postings">
              Browse all
            </ButtonLink>
          </span>
        </header>

        {postings.isPending ? (
          <div className={styles.grid}>
            {[0, 1, 2].map((n) => (
              <Skeleton key={n} height={168} />
            ))}
          </div>
        ) : newest.length > 0 ? (
          <div className={styles.grid}>
            {newest.map((job) => (
              <OpeningCard key={job.jobId} job={job} />
            ))}
          </div>
        ) : (
          <div className={['glass-dense', styles.empty].join(' ')}>
            <p className="t-heading-sm">No postings are open at the moment</p>
            <p className={['t-body-sm', styles.muted].join(' ')}>
              New roles appear here as soon as a verified company publishes them.
            </p>
          </div>
        )}
      </section>

      <section className={[styles.block, styles.reveal].join(' ')}>
        <header className={styles.split}>
          <h2 className="t-display-md">Three kinds of opportunity. One account.</h2>
          <p className={['t-body', styles.muted].join(' ')}>
            You never choose a track at sign up. Each posting lists the documents it needs, starting
            from a default set the company can adjust.
          </p>
        </header>
        <div className={styles.tracks}>
          {TRACKS.map((track) => (
            <article key={track.title} className={['glass-dense', styles.track].join(' ')}>
              <span className={styles.trackIcon}>
                <Icon name={track.icon} size={20} />
              </span>
              <h3 className="t-heading-md">{track.title}</h3>
              <p className={['t-body-sm', styles.muted].join(' ')}>{track.who}</p>
              <p className={['t-eyebrow', styles.trackEyebrow].join(' ')}>Default documents</p>
              <ul className={styles.docs}>
                {track.documents.map((doc) => (
                  <li key={doc} className="t-body-sm">
                    <Icon name="confirm" size={15} />
                    {doc}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className={[styles.block, styles.reveal].join(' ')} id="how">
        <header>
          <p className="t-eyebrow">How it works</p>
          <h2 className="t-display-md">Set up once. Apply anywhere.</h2>
        </header>
        <ol className={styles.steps}>
          {STEPS.map((step, index) => (
            <li key={step.title} className={styles.step}>
              <span className={styles.stepNumber}>{index + 1}</span>
              <h3 className="t-heading-sm">{step.title}</h3>
              <p className={['t-body-sm', styles.muted].join(' ')}>{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className={[styles.block, styles.reveal].join(' ')}>
        <div className={['glass-dense', styles.recordPanel].join(' ')}>
          <header className={styles.split}>
            <h2 className="t-display-md">You always know where it stands.</h2>
            <p className={['t-body', styles.muted].join(' ')}>
              Every step is kept: the status, who moved it, the time and any note they left. Nothing
              is written over, so you and the company are always reading the same history.
            </p>
          </header>

          {/* The track sits in its own recessed panel, which is what separates
              the five states an application moves through from the three ways it
              can end below. */}
          <ol className={styles.pipeline}>
            {PIPELINE.map((status, index) => (
              <li key={status} className={styles.stage}>
                <StatusTag status={status} compact />
                {index < PIPELINE.length - 1 && (
                  <span className={styles.stageLine} aria-hidden="true" />
                )}
              </li>
            ))}
          </ol>

          <div className={styles.endings}>
            {ENDINGS.map((ending) => (
              <div key={ending.status} className={['glass-solid', styles.ending].join(' ')}>
                <StatusTag status={ending.status} compact />
                <p className={['t-body-sm', styles.muted].join(' ')}>{ending.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={[styles.block, styles.reveal].join(' ')} id="companies">
        <header>
          <p className="t-eyebrow">For companies</p>
          <h2 className="t-display-md">Post, shortlist and schedule in one place.</h2>
        </header>
        {/* Candidates rather than recruiters, deliberately: what a company is
            being offered here is the people, and the rest of this section is
            already screens of the tool. No wash, because nothing is written
            over it, so it runs at full colour. */}
        <Photo photo={photos.colleagues} ratio="21 / 9" className={styles.companyBanner} />
        <div className={styles.companySplit}>
          <div className={styles.companyPoints}>
            {FOR_COMPANIES.map((item) => (
              <div key={item.heading} className={styles.companyPoint}>
                <span className={styles.pointIcon}>
                  <Icon name={item.icon} size={17} />
                </span>
                <span>
                  <span className="t-heading-sm">{item.heading}</span>
                  <span className={['t-body-sm', styles.muted].join(' ')}>{item.body}</span>
                </span>
              </div>
            ))}
            <ButtonLink variant="primary" to="/sign-up?account=company">
              Register your company
            </ButtonLink>
          </div>

          <CompanyPipelinePreview />
        </div>
      </section>

      <section className={[styles.closing, styles.reveal].join(' ')}>
        {/* The panel's ground rather than a picture beside the text, which at
            the 300px that column used to be would have been a thumbnail. This
            band is close to 3:1, so it needs a photograph shot wide: a tall one
            cropped to this shape shows a slab of its middle and reads as
            nothing at all. */}
        <Photo photo={photos.companiesMeeting} wash="forest" fill className={styles.closingPhoto} />
        <div className={styles.closingInner}>
          <div className={styles.closingText}>
            <h2 className={['t-display-lg', styles.closingHeadline].join(' ')}>
              Real opportunities. <span className="t-display-italic">Right here.</span>
            </h2>
            <p className={['t-body-lg', styles.closingLede].join(' ')}>
              Create one account and apply to jobs and internships from the same place.
            </p>
          </div>
          <div className={styles.closingActions}>
            {status === 'signedIn' ? (
              <ButtonLink variant="primary" to="/applications">
                Go to your applications
              </ButtonLink>
            ) : (
              <>
                <ButtonLink variant="primary" to="/sign-up">
                  Create your account
                </ButtonLink>
                <ButtonLink variant="secondary" to="/sign-up?account=company">
                  Register a company
                </ButtonLink>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
