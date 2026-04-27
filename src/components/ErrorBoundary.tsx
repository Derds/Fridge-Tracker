import { Component, type ReactNode } from 'react'
import { Warning } from '@phosphor-icons/react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-base-100 flex items-center justify-center px-4">
          <div className="card bg-base-200 shadow-md max-w-md w-full">
            <div className="card-body items-center text-center gap-4">
              <Warning size={48} weight="duotone" className="text-error" />
              <div>
                <h2 className="card-title justify-center text-error">Something went wrong</h2>
                <p className="text-base-content/70 text-sm mt-2">
                  An unexpected error occurred. Your data is safe — try refreshing the page.
                </p>
                {this.state.error.message && (
                  <p className="text-xs text-base-content/40 mt-3 font-mono bg-base-300 rounded px-3 py-2 text-left break-all">
                    {this.state.error.message}
                  </p>
                )}
              </div>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => window.location.reload()}
              >
                Reload page
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
