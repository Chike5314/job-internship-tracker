import type { ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import { buttonClass, type ButtonSize, type ButtonVariant } from './Button'

interface ButtonLinkProps extends LinkProps {
  variant?: ButtonVariant
  size?: ButtonSize
  children: ReactNode
}

/** A Link styled as a Button, for navigation that should read as an action
 * (e.g. a primary call to action) rather than an inline text link. */
export function ButtonLink({ variant = 'secondary', size = 'md', className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link data-ripple className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </Link>
  )
}
