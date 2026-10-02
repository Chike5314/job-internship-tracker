import type { HTMLAttributes } from 'react'

/** glass-soft: cards, list rows, tiles. Carries headings and short labels. */
export function Card({ className, style, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={['glass-soft', className].filter(Boolean).join(' ')}
      style={{ padding: 'var(--space-4)', ...style }}
      {...rest}
    />
  )
}
