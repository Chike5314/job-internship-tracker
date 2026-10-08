import { Component, type ErrorInfo, type ReactNode } from 'react'
import { CrashScreen } from './CrashScreen'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/** The outermost catch, for a failure in the providers themselves. A failing
 *  route is caught first by the router's own error page, RouteErrorPage. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled error in the component tree', error, info)
  }

  render() {
    if (this.state.error) return <CrashScreen />
    return this.props.children
  }
}
