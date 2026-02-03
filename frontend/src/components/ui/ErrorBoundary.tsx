import { Component, type ReactNode } from 'react'
import { AlertCircle, RotateCcw } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: (error: Error, retry: () => void) => ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * ErrorBoundary - Catches React component errors and displays a fallback UI.
 * Use this at the page level to prevent the entire app from crashing on errors.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  private retry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ? (
        this.props.fallback(this.state.error!, this.retry)
      ) : (
        <div className="flex items-center gap-3 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200 dark:bg-red-950/30 dark:border-red-800/50 dark:text-red-400">
          <AlertCircle size={20} className="flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold">Something went wrong</p>
            <p className="text-sm mt-1 truncate" title={this.state.error?.message}>
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
          </div>
          <button
            onClick={this.retry}
            className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors flex-shrink-0"
            title="Try again"
            aria-label="Retry"
          >
            <RotateCcw size={18} />
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
