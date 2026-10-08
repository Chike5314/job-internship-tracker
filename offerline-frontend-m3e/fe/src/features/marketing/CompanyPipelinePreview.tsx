import { Icon } from '@/ui/Icon'
import styles from './CompanyPipelinePreview.module.css'

/**
 * What a company sees, shown beside the four things it gets. Every figure here
 * is an example, and the panel says so: nothing on a marketing page is anybody's
 * real pipeline.
 */
const STAGES = [
  { label: 'Submitted', count: 24, share: 1 },
  { label: 'Under review', count: 16, share: 16 / 24 },
  // Interview carries the one vermilion mark, because it is the stage with
  // people waiting on a reply. An offer that has gone out is forest: it is a
  // result, not something outstanding.
  { label: 'Interview', count: 9, share: 9 / 24, attention: true },
  { label: 'Offer extended', count: 3, share: 3 / 24 },
]

export function CompanyPipelinePreview() {
  return (
    <div className={styles.stack} aria-hidden="true">
      <div className={['glass-dense', styles.panel].join(' ')}>
        <header className={styles.head}>
          <span className={styles.headText}>
            <span className="t-heading-sm">Backend Engineer</span>
            <span className={['t-caption', styles.muted].join(' ')}>
              Kora Systems · closes 30 Sep
            </span>
          </span>
          <span className={styles.published}>Published</span>
        </header>

        <ol className={styles.stages}>
          {STAGES.map((stage) => (
            <li key={stage.label} className={styles.stage}>
              <span className={['t-body-sm', styles.muted].join(' ')}>{stage.label}</span>
              <span className={styles.track}>
                <span
                  className={[styles.bar, stage.attention ? styles.attention : ''].join(' ')}
                  style={{ inlineSize: `${Math.max(4, stage.share * 100)}%` }}
                />
              </span>
              <span className={['t-figure', styles.count].join(' ')}>{stage.count}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className={styles.pair}>
        <div className={['glass-dense', styles.small].join(' ')}>
          <p className={['t-eyebrow', styles.eyebrow].join(' ')}>Next interview</p>
          <p className="t-body-sm">Nadia Fomba · Tue 29 Sep, 14:00</p>
          <p className={['t-caption', styles.confirmed].join(' ')}>
            <Icon name="confirm" size={13} />
            Confirmed by applicant
          </p>
        </div>

        <div className={['glass-dense', styles.small].join(' ')}>
          <p className={['t-eyebrow', styles.eyebrow].join(' ')}>Export</p>
          <p className={['t-body-sm', styles.file].join(' ')}>
            <Icon name="document" size={15} />
            pipeline.csv
          </p>
          <p className={['t-caption', styles.muted].join(' ')}>No documents included</p>
        </div>
      </div>
    </div>
  )
}
