import { Outlet } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { BloomField } from './BloomField'
import { SkipToContent } from './SkipToContent'
import { TopBar } from './TopBar'
import { AppBar } from './AppBar'
import { ApplicantSidebar } from './ApplicantSidebar'
import { Footer } from './Footer'
import styles from './AppShell.module.css'

/**
 * These routes serve a visitor and a signed-in applicant, and the canvas draws
 * two different chromes for them. A visitor is being shown the product and gets
 * the marketing bar and the footer; an applicant is using it and gets the rail
 * and the search bar, the same anatomy the company side has.
 */
export function AppShell() {
  const { status } = useAuth()

  if (status === 'signedIn') {
    return (
      <div className={styles.shell}>
        <BloomField />
        <div className={styles.appForeground}>
          <SkipToContent />
          <ApplicantSidebar />
          <div className={styles.column}>
            <AppBar
              placeholder="Search roles or companies"
              searchTo="/postings"
              notificationsTo="/notifications"
            />
            <main id="main" className={styles.appMain}>
              <Outlet />
            </main>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.shell}>
      <SkipToContent />
      <BloomField />
      <div className={styles.foreground}>
        <TopBar />
        <main id="main" className={styles.main}>
          <Outlet />
        </main>
        <Footer />
      </div>
    </div>
  )
}
