/**
 * One delegated listener gives every [data-ripple] element a touch ripple, so
 * no component needs its own handler and nothing re-renders. Called once from
 * main.tsx. Skips disabled and aria-disabled controls and users who ask for
 * reduced motion.
 */
export function installRipple(): void {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')

  document.addEventListener(
    'pointerdown',
    (event) => {
      if (reduce.matches || event.button !== 0) return
      const target = (event.target as Element | null)?.closest<HTMLElement>('[data-ripple]')
      if (!target) return
      if (target.matches(':disabled, [aria-disabled="true"]')) return

      const rect = target.getBoundingClientRect()
      const size = Math.max(rect.width, rect.height) * 2.2
      const ripple = document.createElement('span')
      ripple.className = 'm3-ripple'
      ripple.style.width = ripple.style.height = `${size}px`
      ripple.style.left = `${event.clientX - rect.left - size / 2}px`
      ripple.style.top = `${event.clientY - rect.top - size / 2}px`
      ripple.addEventListener('animationend', () => ripple.remove(), { once: true })
      target.appendChild(ripple)
    },
    { passive: true },
  )
}
