import { NavLink, useLocation } from 'react-router-dom'
import { useEffect, useId, useState, type ReactNode } from 'react'
import { Logo } from './Logo'
import { Icon, type IconName } from '@/ui/Icon'
import styles from './SideRail.module.css'

export type RailDestination = {
  to: string
  label: string
  icon: IconName
  /** Matches only the exact path, for a parent route such as `/company`. */
  end?: boolean
  /** A plain count in the subtle ink, at the end of the row. */
  count?: number
  /** Draws the count as a vermilion pill, for anything waiting on the viewer. */
  urgent?: boolean
  /**
   * Decides the active state when the path alone cannot. Jobs and Internships
   * are the same route told apart by a query parameter, and NavLink matches on
   * pathname, so without this both would light up at once.
   */
  match?: (location: { pathname: string; search: string }) => boolean
}

type Props = {
  /** Where the wordmark links, which is the section's own home. */
  home: string
  homeLabel: string
  /** Names the side of the product this rail belongs to. */
  section?: string
  destinations: RailDestination[]
  /** Destinations pinned to the foot above the identity card, for the ones
   *  that are not daily work. */
  secondary?: RailDestination[]
  /** The identity card, pinned to the bottom of the rail. */
  identity?: ReactNode
  navLabel: string
}

/**
 * The left rail both sides of the product use. The canvas draws an applicant
 * and a recruiter rail with the same anatomy and different destinations, so the
 * anatomy lives here and each side passes its own list rather than keeping a
 * second copy of the markup that drifts from the first.
 */
export function SideRail({
  home,
  homeLabel,
  section,
  destinations,
  secondary,
  identity,
  navLabel,
}: Props) {
  const location = useLocation()
  const drawerId = useId()

  // Below the split the destinations fold behind a menu button rather than
  // scrolling sideways in a band, which pushed the page wider than a phone.
  // Choosing a destination is the end of the errand, so the drawer is open only
  // on the page it was opened from and reads as closed after any navigation.
  // Escape closes it the way it closes any other menu.
  const here = location.pathname + location.search
  const [openedOn, setOpenedOn] = useState<string | null>(null)
  const open = openedOn === here
  const setOpen = (next: boolean | ((current: boolean) => boolean)) =>
    setOpenedOn((typeof next === 'function' ? next(open) : next) ? here : null)
  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpenedOn(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  function renderLink(item: RailDestination) {
    return (
      <NavLink
        data-ripple
        key={item.to}
        to={item.to}
        end={item.end}
        className={({ isActive }) => {
          const active = item.match ? item.match(location) : isActive
          return [styles.link, active ? styles.active : ''].join(' ')
        }}
      >
        <Icon name={item.icon} size={18} />
        <span>{item.label}</span>
        {item.count !== undefined && item.count > 0 && (
          <span className={[styles.count, item.urgent ? styles.alert : ''].join(' ')}>
            {item.count}
          </span>
        )}
      </NavLink>
    )
  }

  const hasSecondary = Boolean(secondary && secondary.length > 0)

  return (
    <div className={styles.rail}>
      <div className={styles.head}>
        <NavLink to={home} className={styles.brand} aria-label={homeLabel}>
          <Logo height={24} />
        </NavLink>
        {section && <span className={['t-eyebrow', styles.section].join(' ')}>{section}</span>}
        <button
          type="button"
          className={styles.menuButton}
          aria-expanded={open}
          aria-controls={drawerId}
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((value) => !value)}
        >
          <Icon name={open ? 'close' : 'menu'} size={22} />
        </button>
      </div>

      <div id={drawerId} className={styles.drawer} data-open={open}>
      <nav className={styles.nav} aria-label={navLabel}>
        {destinations.map(renderLink)}
      </nav>

      {(hasSecondary || identity) && (
        <div className={styles.foot}>
          {hasSecondary && (
            <nav className={[styles.nav, styles.secondary].join(' ')} aria-label={`${navLabel} settings`}>
              {secondary!.map(renderLink)}
            </nav>
          )}
          {identity && <div className={styles.identity}>{identity}</div>}
        </div>
      )}
      </div>
    </div>
  )
}
