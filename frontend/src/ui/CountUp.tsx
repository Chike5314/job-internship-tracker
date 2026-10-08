import { useEffect, useRef, useState } from 'react'

interface CountUpProps {
  value: number
  /** Milliseconds. Short on purpose: the figure is the news, not the show. */
  duration?: number
}

/** No counting for people who asked for less motion, or where we cannot tell
 *  when the figure is on screen. They simply get the number. */
const instant = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches || typeof IntersectionObserver === 'undefined'

/**
 * A figure that counts up to its value the first time it scrolls into view and
 * eases to the new number when the value changes afterwards. Screen readers get
 * the final number immediately; the counting is decoration.
 */
export function CountUp({ value, duration = 900 }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const shown = useRef(0)
  const skip = instant()
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    const node = ref.current
    if (!node || skip) return

    let frame = 0
    const run = () => {
      const from = shown.current
      const start = performance.now()
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / duration)
        // easeOutExpo: fast off the line, then settles.
        const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t)
        shown.current = Math.round(from + (value - from) * eased)
        setDisplay(shown.current)
        if (t < 1) frame = requestAnimationFrame(tick)
      }
      frame = requestAnimationFrame(tick)
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        observer.disconnect()
        run()
      },
      { threshold: 0.4 },
    )
    observer.observe(node)

    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [value, duration, skip])

  return (
    <span ref={ref} aria-label={String(value)}>
      <span aria-hidden="true">{skip ? value : display}</span>
    </span>
  )
}
