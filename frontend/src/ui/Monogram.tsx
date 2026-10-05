import styles from './Monogram.module.css'

const TONES = ['forest', 'sand', 'stone'] as const

/** The same company always lands on the same tone, wherever it appears. */
function toneFor(name: string): (typeof TONES)[number] {
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return TONES[hash % TONES.length]!
}

/** A company's initial on a tinted tile, standing in for a logo in a list row. */
export function Monogram({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const initial = name.trim().charAt(0).toUpperCase() || '·'
  return (
    <span className={[styles.tile, styles[size], styles[toneFor(name)]].join(' ')} aria-hidden="true">
      {initial}
    </span>
  )
}
