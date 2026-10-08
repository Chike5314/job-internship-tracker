import { Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { BloomField } from './BloomField'
import { SkipToContent } from './SkipToContent'
import { TopBar } from './TopBar'
import { AppBar } from './AppBar'
import { ApplicantSidebar } from './ApplicantSidebar'
import { Footer } from './Footer'
import { PhoneHeader } from './PhoneHeader'
import { PhoneTabBar } from './PhoneTabBar'
import { PHONE_QUERY, useMediaQuery } from '@/lib/useMediaQuery'
import { usePageEnter } from '@/lib/usePageEnter'
import styles from './AppShell.module.css'

/**
 * These routes serve a visitor and a signed-in applicant, and the canvas draws
 * two different chromes for them. A visitor is being shown the product and gets
 * the marketing bar and the footer; an applicant is using it and gets the rail
 * and the search bar, the same anatomy the company side has.
 */
export function AppShell() {
  const mainRef = usePageEnter<HTMLElement>()
  const { status } = useAuth()
  const { pathname } = useLocation()
  const phone = useMediaQuery(PHONE_QUERY)
  // The applications board searches the viewer's own list in place; every
  // other screen searches the postings.
  const onApplications = pathname === '/applications' || pathname.startsWith('/applications/')

  // On a phone the rail and the search bar give way to the canvas's phone
  // chrome: the mark and the bell on top, four tabs along the bottom.
  if (status === 'signedIn' && phone) {
    return (
      <div className={styles.shell}>
        <BloomField />
        <div className={styles.phoneForeground}>
          <SkipToContent />
          <PhoneHeader />
          <main id="main" ref={mainRef} className={styles.phoneMain}>
            <Outlet />
          </main>
          <PhoneTabBar />
        </div>
      </div>
    )
  }

  if (status === 'signedIn') {
    return (
      <div className={styles.shell}>
        <BloomField />
        <div className={styles.appForeground}>
          <SkipToContent />
          <ApplicantSidebar />
          <div className={styles.column}>
            <AppBar
              placeholder={onApplications ? 'Search your applications' : 'Search roles or companies'}
              searchTo="/postings"
              filtersPage={onApplications}
              notificationsTo="/notifications"
            />
            <main id="main" ref={mainRef} className={styles.appMain}>
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
        <main id="main" ref={mainRef} className={styles.main}>
          <Outlet />
        </main>
        <Footer />
      </div>
    </div>
  )
}
