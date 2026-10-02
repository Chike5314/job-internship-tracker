import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { Icon } from '@/ui/Icon'
import { NotificationBell } from '@/features/notifications/NotificationBell'
import { AccountMenu } from './AccountMenu'
import { ThemeToggle } from './ThemeToggle'
import styles from './AppBar.module.css'

type Props = {
  /** What the field searches, which differs by side of the product. */
  placeholder: string
  /** Where a search goes, with the term added as `q`. */
  searchTo: string
  /** Where the bell links, since each side keeps its own notifications route. */
  notificationsTo: string
}

/**
 * The bar above the content on every signed-in screen: search, the bell and the
 * account. It sits beside a rail rather than replacing it, which is how the
 * canvas draws both the applicant and the company boards.
 */
export function AppBar({ placeholder, searchTo, notificationsTo }: Props) {
  const { identity } = useAuth()
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [term, setTerm] = useState('')

  // The shortcut the bar advertises has to work, or the hint is a lie.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmed = term.trim()
    navigate(trimmed ? `${searchTo}?q=${encodeURIComponent(trimmed)}` : searchTo)
  }

  return (
    <header className={styles.bar}>
      <form className={['glass-soft', styles.search].join(' ')} role="search" onSubmit={onSubmit}>
        <Icon name="search" size={18} />
        <input
          ref={inputRef}
          type="search"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className={styles.field}
        />
        <kbd className={styles.shortcut} aria-hidden="true">
          ⌘K
        </kbd>
      </form>

      <div className={styles.actions}>
        <ThemeToggle />
        <NotificationBell to={notificationsTo} />
        {identity && <AccountMenu identity={identity} />}
      </div>
    </header>
  )
}
