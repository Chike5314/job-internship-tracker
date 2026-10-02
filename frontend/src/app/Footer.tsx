import { Link } from 'react-router-dom'
import { Logo } from './Logo'
import styles from './Footer.module.css'

const COLUMNS: { heading: string; links: { label: string; to: string }[] }[] = [
  {
    heading: 'Applicants',
    links: [
      { label: 'Jobs', to: '/postings?type=FULL_TIME_JOB' },
      { label: 'Internships', to: '/postings?type=PROFESSIONAL_INTERNSHIP' },
      { label: 'Sign in', to: '/sign-in' },
    ],
  },
  {
    heading: 'Companies',
    links: [
      { label: 'Register', to: '/sign-up?account=company' },
      { label: 'How verification works', to: '/#companies' },
    ],
  },
  {
    heading: 'Offerline',
    links: [
      { label: 'Privacy', to: '/privacy' },
      { label: 'Terms', to: '/terms' },
      { label: 'Contact', to: '/contact' },
    ],
  },
]

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <Logo height={22} />
          <p className={['t-body-sm', styles.blurb].join(' ')}>
            Connecting talent with opportunities: jobs, internships and more, from verified
            companies.
          </p>
        </div>

        {COLUMNS.map((column) => (
          <nav key={column.heading} className={styles.column} aria-label={column.heading}>
            <p className={['t-eyebrow', styles.heading].join(' ')}>{column.heading}</p>
            <ul className={styles.links}>
              {column.links.map((link) => (
                <li key={link.label}>
                  <Link to={link.to} className="t-body-sm">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className={styles.base}>
        <p className="t-caption">© 2026 Offerline</p>
        <p className="t-caption">Real opportunities. Right here.</p>
      </div>
    </footer>
  )
}
