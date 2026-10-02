import type { HTMLAttributes } from 'react'

/** glass-dense: forms, flyouts, dialogs, any panel carrying a paragraph. */
export function Panel({ className, style, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={['glass-dense', className].filter(Boolean).join(' ')}
      style={{ padding: 'var(--space-5)', ...style }}
      {...rest}
    />
  )
}
