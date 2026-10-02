import markSvg from '@/assets/brand/offerline-mark.svg?raw'
import wordmarkSvg from '@/assets/brand/offerline-wordmark.svg?raw'
import styles from './Logo.module.css'

interface LogoProps {
  variant?: 'wordmark' | 'mark'
  height?: number
}

/**
 * Both files are traced from the supplied artwork, so the curves are the
 * designer's rather than a redraw.
 *
 * They are inlined rather than given to an `img` tag, which is what lets the
 * wordmark work on both themes from one file. An SVG loaded through `img` is
 * its own isolated document: `currentColor` inside it resolves against nothing
 * and falls back to black, so on the dark theme the word stayed black on a
 * near black ground. Inlined, the ink takes the colour of the text around it
 * and only the green accent stays fixed. The mark carries all three brand
 * colours itself and reads on either ground unchanged.
 */
export function Logo({ variant = 'wordmark', height = 28 }: LogoProps) {
  return (
    <span
      className={styles.logo}
      style={{ height }}
      // Build time assets from this repository, not anything a user can reach.
      dangerouslySetInnerHTML={{ __html: variant === 'wordmark' ? wordmarkSvg : markSvg }}
    />
  )
}
