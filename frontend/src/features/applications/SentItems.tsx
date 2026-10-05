import type { ApplicationDetail } from '@/api/types'
import { Icon } from '@/ui/Icon'
import { nameFromUrl } from '@/lib/fileNames'
import styles from './SentItems.module.css'

/** A short answer is shown as itself; a long one by its label, opened on demand. */
const SHORT_ANSWER = 60

type Item =
  | { key: string; kind: 'file'; name: string; detail: string; url: string }
  | { key: string; kind: 'short'; name: string; detail: string }
  | { key: string; kind: 'long'; name: string; detail: string; text: string }

/** Only what was actually sent: an optional document left out is not listed. */
function itemsOf(application: ApplicationDetail): Item[] {
  const items: Item[] = []
  for (const requirement of application.documentRequirements) {
    if (requirement.kind === 'FILE') {
      const url = application.documentUrls[requirement.key]
      if (!url) continue
      const name = nameFromUrl(url)
      items.push({
        key: requirement.key,
        kind: 'file',
        name: name ?? requirement.label,
        detail: name ? requirement.label : 'Open to download',
        url,
      })
      continue
    }
    // The cover letter is stored on its own field rather than among the
    // answers, though the posting lists it as a requirement like any other.
    const text =
      requirement.key === 'coverLetter'
        ? application.coverLetter
        : application.answers[requirement.key]
    if (!text) continue
    if (text.length <= SHORT_ANSWER && !text.includes('\n')) {
      items.push({ key: requirement.key, kind: 'short', name: text, detail: requirement.label })
    } else {
      items.push({
        key: requirement.key,
        kind: 'long',
        name: requirement.label,
        detail: 'Written in the form',
        text,
      })
    }
  }
  return items
}

export function SentItems({ application }: { application: ApplicationDetail }) {
  const items = itemsOf(application)
  if (items.length === 0) return null

  return (
    <section className={styles.section} aria-labelledby="sent-items">
      <h3 id="sent-items" className={styles.eyebrow}>
        SENT WITH THIS APPLICATION
      </h3>
      <ul className={styles.list}>
        {items.map((item) => {
          const face = (
            <>
              <Icon name={item.kind === 'file' ? 'file' : 'message'} size={18} />
              <span className={styles.text}>
                <span className={styles.name}>{item.name}</span>
                <span className={styles.detail}>{item.detail}</span>
              </span>
            </>
          )
          return (
            <li key={item.key}>
              {item.kind === 'file' ? (
                <a href={item.url} target="_blank" rel="noopener noreferrer" className={styles.item}>
                  {face}
                  <Icon name="download" size={16} />
                </a>
              ) : item.kind === 'long' ? (
                <details className={styles.long}>
                  <summary className={styles.item}>
                    {face}
                    <Icon name="chevron-down" size={16} />
                  </summary>
                  <p className={styles.fullText}>{item.text}</p>
                </details>
              ) : (
                <div className={styles.item}>{face}</div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
