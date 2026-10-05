import { Outlet, useLocation } from 'react-router-dom'
import { BloomField } from './BloomField'
import { AdminSidebar } from './AdminSidebar'
import { AppBar } from './AppBar'
import { SkipToContent } from './SkipToContent'
// The admin side sits in the same frame as the company app, a rail beside the
// bar and the content, so it shares that frame's layout rather than keeping a
// copy of it that drifts.
import styles from './CompanyShell.module.css'

/**
 * The admin app. No board draws it, so it is the company app's anatomy with
 * the admin's own destinations. Admins receive no notifications, so the bar
 * carries no bell.
 */
export function AdminShell() {
  const { pathname } = useLocation()
  // On the companies list the bar filters the table in place, the way it
  // filters the applicant's applications; anywhere else a search goes there.
  const onCompanies = pathname === '/admin/companies'
  return (
    <div className={styles.shell}>
      <BloomField />
      <div className={styles.foreground}>
        <SkipToContent />
        <AdminSidebar />
        <div className={styles.column}>
          <AppBar placeholder="Search companies" searchTo="/admin/companies" filtersPage={onCompanies} />
          <main id="main" className={styles.main}>
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
