import type { CSSProperties } from 'react'
import type { PhotoAsset } from '@/assets/photos/manifest'
import styles from './Photo.module.css'

interface PhotoProps {
  photo: PhotoAsset
  /**
   * Skip lazy loading. Set it on a photograph that is already on screen when
   * the page opens, so it is not fetched late and does not arrive after the
   * text it belongs with.
   */
  eager?: boolean
  /**
   * A wash laid over the image. 'forest' is for a photograph that sits under
   * light text on the brand panel: it darkens the frame and pulls it toward
   * the brand green so the two read as one surface rather than a picture with
   * writing on top. 'scrim' only darkens, for a photograph whose own colour
   * should stay.
   */
  wash?: 'forest' | 'scrim'
  /**
   * Crop the frame to this aspect ratio instead of the file's own, written as
   * CSS does it: '16 / 10'. The focal point in the manifest is what decides
   * which part of the photograph survives the crop.
   */
  ratio?: string
  /**
   * Stretch to fill a positioned parent instead of holding a shape of its own.
   * For a photograph used as a panel's ground, where the panel's content is
   * what decides the height.
   */
  fill?: boolean
  className?: string
}

/**
 * One photograph, with its shape reserved before it loads.
 *
 * Two things here are doing real work. The wrapper paints the photo's own
 * blurred thumbnail, inlined in the manifest as a data URI, so the frame is
 * the right colours from the first paint instead of a grey hole that fills in;
 * the full image draws over it when it decodes, with no state to track and
 * nothing to flash. And the aspect ratio comes from the file's real
 * dimensions, so the frame takes its final height immediately and the text
 * below it never jumps.
 *
 * The focal point matters because every one of these is cropped by its
 * container: `object-position` keeps the face, not the ceiling, in frame when
 * a wide photograph is squeezed into a narrow column.
 */
export function Photo({ photo, eager = false, wash, ratio, fill = false, className }: PhotoProps) {
  const frame: CSSProperties = {
    backgroundImage: `url(${photo.lqip})`,
    ...(fill ? null : { aspectRatio: ratio ?? `${photo.width} / ${photo.height}` }),
  }

  return (
    <figure
      className={[styles.frame, fill ? styles.fill : '', wash ? styles[wash] : '', className]
        .filter(Boolean)
        .join(' ')}
      style={frame}
      // A photograph used as a panel's ground is decoration: the text over it
      // carries the meaning, so a screen reader should not read both.
      aria-hidden={fill || undefined}
    >
      <img
        className={styles.image}
        src={photo.src}
        width={photo.width}
        height={photo.height}
        alt={photo.alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={eager ? 'high' : 'auto'}
        style={{ objectPosition: photo.focal }}
      />
    </figure>
  )
}
