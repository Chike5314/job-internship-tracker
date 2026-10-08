import markSource from '@/assets/brand/offerline-mark.svg?raw'
import wordmarkSource from '@/assets/brand/offerline-wordmark.svg?raw'
import styles from './Logo.module.css'

// The traced files carry the source image's content credentials in a
// <metadata> block, about 7.7KB of each. Inlined, that went into the page on
// every logo and read as the link's text, so it is dropped here and the files
// themselves are left as the designer delivered them.
const stripMetadata = (svg: string) => svg.replace(/<metadata>[\s\S]*?<\/metadata>/g, '')
const markSvg = stripMetadata(markSource)
const wordmarkSvg = stripMetadata(wordmarkSource)

interface LogoProps {
  /**
   * `lockup`, the default, is the mark beside the name and is what the product
   * shows wherever it names itself. `mark` is the symbol alone, for a square
   * slot such as a loading screen. `wordmark` is the traced display lettering,
   * kept for large brand moments where its weight is the point.
   */
  variant?: 'lockup' | 'wordmark' | 'mark'
  height?: number
}

/**
 * Both SVG files are traced from the supplied artwork, so the curves are the
 * designer's rather than a redraw.
 *
 * They are inlined rather than given to an `img` tag, which is what lets the
 * wordmark work on both themes from one file. An SVG loaded through `img` is
 * its own isolated document: `currentColor` inside it resolves against nothing
 * and falls back to black, so on the dark theme the word stayed black on a
 * near black ground. Inlined, the ink takes the colour of the text around it
 * and only the green accent stays fixed. The mark carries all three brand
 * colours itself and reads on either ground unchanged.
 *
 * The lockup sets the name in the interface's own sans rather than the traced
 * display serif. At the 22 to 30 pixel heights a bar or rail allows, the serif's
 * hairlines and heavy stems were the loudest thing on the screen; the sans sits
 * with the navigation it heads, and the mark beside it carries the brand. The
 * two-tone split, ink then forest green, is kept so the name still reads as the
 * same logo.
 */
export function Logo({ variant = 'lockup', height = 28 }: LogoProps) {
  if (variant === 'lockup') {
    return (
      <span className={styles.lockup} style={{ height }} role="img" aria-label="Offerline">
        <span
          className={styles.logo}
          style={{ height }}
          aria-hidden="true"
          // Build time assets from this repository, not anything a user can reach.
          dangerouslySetInnerHTML={{ __html: markSvg }}
        />
        <span className={styles.name} style={{ fontSize: Math.round(height * 0.78) }} aria-hidden="true">
          offer<span className={styles.accent}>line</span>
        </span>
      </span>
    )
  }
  return (
    <span
      className={styles.logo}
      style={{ height }}
      dangerouslySetInnerHTML={{ __html: variant === 'wordmark' ? wordmarkSvg : markSvg }}
    />
  )
}
