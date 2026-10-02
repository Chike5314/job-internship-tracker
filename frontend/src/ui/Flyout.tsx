import { useEffect, useRef, type ReactNode } from 'react'
import styles from './Flyout.module.css'

interface FlyoutProps {
  open: boolean
  onClose: () => void
  anchorRef: React.RefObject<HTMLElement | null>
  title: string
  children: ReactNode
}

/**
 * A non-modal panel anchored under a trigger, e.g. the notification bell.
 * Traps focus while open, closes on Escape or an outside click, and
 * returns focus to the trigger on close.
 */
export function Flyout({ open, onClose, anchorRef, title, children }: FlyoutProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const panel = panelRef.current
    const firstFocusable = panel?.querySelector<HTMLElement>(
      'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )
    firstFocusable?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (event.key !== 'Tab' || !panel) return
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      )
      if (focusable.length === 0) return
      const first = focusable[0]!
      const last = focusable[focusable.length - 1]!
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node
      if (panel?.contains(target) || anchorRef.current?.contains(target)) return
      onClose()
    }

    // Captured now, not read from the ref at cleanup time: by the time
    // cleanup runs, anchorRef.current may already point at something else.
    const anchor = anchorRef.current

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
      anchor?.focus()
    }
  }, [open, onClose, anchorRef])

  if (!open) return null

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={title}
      className={[styles.panel, 'glass-dense'].join(' ')}
    >
      {children}
    </div>
  )
}
