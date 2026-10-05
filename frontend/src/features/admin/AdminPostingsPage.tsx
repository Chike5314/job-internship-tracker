import styles from './AdminPage.module.css'

/** FR-9.2: every posting applicants can see, and the way to take one down. */
export function AdminPostingsPage() {
  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div className={styles.titles}>
          <h1 className={styles.title}>Postings</h1>
          <p className={styles.subtitle}>Every posting applicants can see, and the way to take one down.</p>
        </div>
      </header>
    </div>
  )
}
