import styles from './ErrorSummary.module.css'

export interface ErrorSummaryItem {
  fieldId: string
  message: string
}

/**
 * The one alert for a form's outstanding or failed fields. Each item links
 * to its field and focuses it, so the summary is a way to fix things, not
 * just a way to read about them.
 */
export function ErrorSummary({ heading, items }: { heading: string; items: ErrorSummaryItem[] }) {
  if (items.length === 0) return null

  return (
    <div className={styles.summary} role="alert">
      <p className="t-body-sm" style={{ fontWeight: 600, color: 'var(--color-feedback-error-text)' }}>
        {heading}
      </p>
      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item.fieldId}>
            <a
              href={`#${item.fieldId}`}
              className="t-body-sm"
              onClick={(event) => {
                event.preventDefault()
                document.getElementById(item.fieldId)?.focus()
              }}
            >
              {item.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
