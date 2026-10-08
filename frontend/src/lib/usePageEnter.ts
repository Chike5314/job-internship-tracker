import { useEffect, useRef, type RefObject } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Plays a short enter animation on the content area when the route changes.
 *
 * It animates the existing element through the Web Animations API instead of
 * re-keying it, because remounting <main> on every navigation would throw away
 * the state of pages that stay mounted across a route change (a list beside its
 * open detail panel, for one). The first render is skipped: a page that just
 * loaded is not "entering" from anywhere.
 */
export function usePageEnter<T extends HTMLElement>(): RefObject<T | null> {
  const ref = useRef<T>(null)
  const { pathname } = useLocation()
  const first = useRef(true)

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    const node = ref.current
    if (!node || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const animation = node.animate(
      [
        { opacity: 0, transform: 'translateY(16px)' },
        { opacity: 1, transform: 'none' },
      ],
      { duration: 480, easing: 'cubic-bezier(0.38, 1.21, 0.22, 1)' },
    )
    return () => animation.cancel()
  }, [pathname])

  return ref
}
