'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * ErrorBoundary - Catches JavaScript errors anywhere in the child component tree
 * and displays a fallback UI instead of crashing the whole app (white screen).
 * 
 * This is critical for mobile apps where a crash means the user has to restart.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render shows the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error for debugging
    console.error('ErrorBoundary caught an error:', error);
    console.error('Error info:', errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });

    // You could also send this to an error reporting service
    // logErrorToService(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="fixed inset-0 bg-gradient-to-b from-[#1a1d21] to-[#0d0f12] flex flex-col items-center justify-center z-50 p-6">
          {/* Error Icon */}
          <div className="mb-6">
            <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center">
              <svg 
                className="w-10 h-10 text-red-400" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
                />
              </svg>
            </div>
          </div>

          {/* Error Title */}
          <h1 className="text-xl font-semibold text-white mb-2">
            Something went wrong
          </h1>

          {/* Error Description */}
          <p className="text-gray-400 text-sm text-center mb-6 max-w-xs">
            We encountered an unexpected error. This might be due to a connection issue or a temporary problem.
          </p>

          {/* Error Details (collapsible) */}
          {this.state.error && (
            <details className="mb-6 w-full max-w-sm">
              <summary className="text-gray-500 text-xs cursor-pointer hover:text-gray-400 text-center">
                View error details
              </summary>
              <div className="mt-2 p-3 bg-gray-800/50 rounded-lg overflow-auto max-h-32">
                <code className="text-xs text-red-300 whitespace-pre-wrap break-words">
                  {this.state.error.message}
                </code>
              </div>
            </details>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button
              onClick={this.handleRetry}
              className="w-full py-3 px-4 bg-teal-500 hover:bg-teal-600 text-white font-medium rounded-xl transition-colors"
            >
              Try Again
            </button>
            
            <button
              onClick={this.handleReload}
              className="w-full py-3 px-4 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-xl transition-colors"
            >
              Reload App
            </button>

            <button
              onClick={this.handleGoHome}
              className="w-full py-3 px-4 text-gray-400 hover:text-white text-sm transition-colors"
            >
              Return to Home
            </button>
          </div>

          {/* Help Text */}
          <p className="mt-8 text-gray-600 text-xs text-center">
            If this problem persists, please try restarting the app
            <br />
            or contact support for assistance.
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
