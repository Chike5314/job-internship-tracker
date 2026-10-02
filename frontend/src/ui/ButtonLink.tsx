import type { ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import buttonStyles from './Button.module.css'

type Variant = 'primary' | 'secondary' | 'quiet' | 'danger'

interface ButtonLinkProps extends LinkProps {
  variant?: Variant
  children: ReactNode
}

/** A Link styled as a Button, for navigation that should read as an action
 * (e.g. a primary call to action) rather than an inline text link. */
export function ButtonLink({ variant = 'secondary', className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link
      className={[buttonStyles.button, buttonStyles[variant], 't-button', className].filter(Boolean).join(' ')}
      {...rest}
    >
      {children}
    </Link>
  )
}
