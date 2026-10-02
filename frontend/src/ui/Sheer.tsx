import type { HTMLAttributes } from 'react'

/** glass-sheer: a large containing panel that holds other glass. Never put
 * text directly on it. */
export function Sheer({ className, style, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={['glass-sheer', className].filter(Boolean).join(' ')}
      style={{ padding: 'var(--space-6)', ...style }}
      {...rest}
    />
  )
}
