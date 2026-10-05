import { useEffect } from 'react'
import { useRouteError } from 'react-router-dom'
import { Button } from '@/ui/Button'
import { Logo } from './Logo'
import styles from './CrashScreen.module.css'

/**
 * What the viewer sees when a screen fails to draw. The chrome around it is
 * gone with it, so the page carries the wordmark itself to still say where the
 * viewer is.
 */
export function CrashScreen() {
  return (
    <div className={styles.page}>
      <Logo height={28} />
      <div className={['glass-dense', styles.card].join(' ')} role="alert">
        <p className={styles.title}>Something went wrong</p>
        <p className={styles.body}>Reload the page and try again.</p>
        <Button variant="primary" onClick={() => window.location.reload()}>
          Reload
        </Button>
      </div>
    </div>
  )
}

/** The router's own error page. Without one, React Router catches a failing
 *  route before the app's error boundary does and shows its unbranded default. */
export function RouteErrorPage() {
  const error = useRouteError()
  useEffect(() => {
    console.error('A route failed to render', error)
  }, [error])
  return <CrashScreen />
}
