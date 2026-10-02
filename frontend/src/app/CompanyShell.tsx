import { Outlet } from 'react-router-dom'
import { BloomField } from './BloomField'
import { CompanySidebar } from './CompanySidebar'
import { AppBar } from './AppBar'
import { SkipToContent } from './SkipToContent'
import styles from './CompanyShell.module.css'

/**
 * The company app. A left rail rather than the applicant side's marketing bar,
 * because a recruiter moves between seven destinations all day and a visitor
 * moves between three.
 */
export function CompanyShell() {
  return (
    <div className={styles.shell}>
      <BloomField />
      <div className={styles.foreground}>
        <SkipToContent />
        <CompanySidebar />
        <div className={styles.column}>
          <AppBar
            placeholder="Search applicants or postings"
            searchTo="/company/postings"
            notificationsTo="/company/notifications"
          />
          <main id="main" className={styles.main}>
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
