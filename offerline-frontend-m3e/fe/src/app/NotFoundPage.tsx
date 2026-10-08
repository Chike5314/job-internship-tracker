import { EmptyState } from '@/ui/EmptyState'
import { ButtonLink } from '@/ui/ButtonLink'

export function NotFoundPage() {
  return (
    <EmptyState
      art="lost"
      heading="Page not found"
      body="The page you're looking for doesn't exist or has moved."
      action={<ButtonLink to="/">Go home</ButtonLink>}
    />
  )
}
