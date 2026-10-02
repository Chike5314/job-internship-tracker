import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled error in the component tree', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 'var(--space-6)' }}>
          <div className="glass-dense" style={{ padding: 'var(--space-5)' }} role="alert">
            <p className="t-heading-sm">Something went wrong</p>
            <p className="t-body-sm" style={{ color: 'var(--color-text-muted)' }}>
              Reload the page and try again.
            </p>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
