import { NavLink, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { Logo } from './Logo'
import { Icon, type IconName } from '@/ui/Icon'
import styles from './SideRail.module.css'

export type RailDestination = {
  to: string
  label: string
  icon: IconName
  /** Matches only the exact path, for a parent route such as `/company`. */
  end?: boolean
  /** A plain count, set apart from the destinations above it. */
  count?: number
  /** Draws the count in vermilion, for anything waiting on the viewer. */
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
  /** Destinations set below the rule, for the ones that are not daily work. */
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

  function renderLink(item: RailDestination) {
    return (
      <NavLink
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

  return (
    <div className={['glass-sheer', styles.rail].join(' ')}>
      <div className={styles.head}>
        <NavLink to={home} className={styles.brand} aria-label={homeLabel}>
          <Logo height={24} />
        </NavLink>
        {section && <span className={['t-eyebrow', styles.section].join(' ')}>{section}</span>}
      </div>

      <nav className={styles.nav} aria-label={navLabel}>
        {destinations.map(renderLink)}
      </nav>

      {secondary && secondary.length > 0 && (
        <nav className={[styles.nav, styles.secondary].join(' ')} aria-label={`${navLabel} settings`}>
          {secondary.map(renderLink)}
        </nav>
      )}

      {identity && <div className={styles.foot}>{identity}</div>}
    </div>
  )
}
