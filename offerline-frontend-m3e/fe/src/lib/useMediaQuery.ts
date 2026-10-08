import { useSyncExternalStore } from 'react'

/** Where the phone layout takes over: the bottom tab bar and the phone home. */
export const PHONE_QUERY = '(max-width: 640px)'

/**
 * Whether a media query matches, kept current as the window changes. For a
 * layout that renders a different tree rather than restyling the same one,
 * which CSS alone cannot do without leaving the other tree in the page.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}
