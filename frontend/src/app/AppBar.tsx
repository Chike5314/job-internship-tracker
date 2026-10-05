import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { Icon } from '@/ui/Icon'
import { NotificationBell } from '@/features/notifications/NotificationBell'
import { AccountMenu } from './AccountMenu'
import styles from './AppBar.module.css'

type Props = {
  /** What the field searches, which differs by side of the product. */
  placeholder: string
  /** Where a search goes, with the term added as `q`. */
  searchTo: string
  /**
   * Set on a page that filters its own list. The field then edits `q` on the
   * current URL as the viewer types and nothing navigates, so the filter
   * survives selecting a row and the back button.
   */
  filtersPage?: boolean
  /** Where the bell links, since each side keeps its own notifications route.
   *  Left out on a side that receives no notifications, which then has no bell. */
  notificationsTo?: string
}

/**
 * The bar above the content on every signed-in screen: search, the bell and the
 * account. It sits beside a rail, which is how the canvas draws both the
 * applicant and the company boards. The theme switch lives in the account menu,
 * so the bar carries exactly what the boards draw.
 */
export function AppBar({ placeholder, searchTo, filtersPage = false, notificationsTo }: Props) {
  const { identity } = useAuth()
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [term, setTerm] = useState('')
  const [searchParams, setSearchParams] = useSearchParams()
  const value = filtersPage ? (searchParams.get('q') ?? '') : term

  function onChange(next: string) {
    if (!filtersPage) {
      setTerm(next)
      return
    }
    setSearchParams(
      (params) => {
        if (next) params.set('q', next)
        else params.delete('q')
        return params
      },
      { replace: true },
    )
  }

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
    if (filtersPage) return
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
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className={styles.field}
        />
        <kbd className={styles.shortcut} aria-hidden="true">
          ⌘K
        </kbd>
      </form>

      <div className={styles.actions}>
        {notificationsTo && <NotificationBell to={notificationsTo} />}
        {identity && <AccountMenu identity={identity} />}
      </div>
    </header>
  )
}
