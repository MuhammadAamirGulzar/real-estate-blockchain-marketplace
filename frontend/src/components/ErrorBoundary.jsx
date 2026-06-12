import * as React from "react";
import { AlertCircle, Home, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const ErrorIcon = () => (
  <div className="flex justify-center">
    <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
      <AlertCircle className="h-8 w-8 text-destructive" />
    </div>
  </div>
);

const ErrorDetails = ({ error, errorInfo }) => {
  if (!import.meta.env.DEV || !error) return null;

  return (
    <div className="bg-destructive/5 border border-destructive/20 rounded-md p-3 space-y-2">
      <p className="text-xs font-mono text-destructive break-words">
        <span className="font-bold">Error:</span> {error.toString()}
      </p>
      {errorInfo && (
        <details className="text-xs">
          <summary className="font-bold cursor-pointer text-destructive hover:text-destructive/80 transition-colors">
            Stack Trace
          </summary>
          <pre className="mt-2 text-destructive/80 overflow-auto max-h-32 text-xs bg-background p-2 rounded border border-destructive/10">
            {errorInfo.componentStack}
          </pre>
        </details>
      )}
    </div>
  );
};

const ErrorActions = ({ onReset }) => (
  <div className="flex gap-3 flex-col sm:flex-row">
    <Button
      onClick={onReset}
      className="flex-1 flex items-center justify-center gap-2 transition-all duration-200"
    >
      <RefreshCw className="h-4 w-4" />
      <span>Try Again</span>
    </Button>
    <Button
      onClick={() => {
        window.location.href = "/";
      }}
      variant="outline"
      className="flex-1 flex items-center justify-center gap-2 transition-all duration-200"
    >
      <Home className="h-4 w-4" />
      <span>Go Home</span>
    </Button>
  </div>
);

/**
 * ErrorBoundary - Catches and displays errors in the React component tree
 * Prevents the entire app from crashing on component errors
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState((prevState) => ({
      error,
      errorInfo,
      errorCount: prevState.errorCount + 1,
    }));

    if (import.meta.env.DEV) {
      console.error("ErrorBoundary caught an error:", error, errorInfo);
    }

    // TODO: Uncomment to send to error tracking service (e.g., Sentry)
    // import * as Sentry from "@sentry/react";
    // Sentry.captureException(error, { contexts: { react: errorInfo } });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
          <div className="max-w-md w-full bg-background rounded-lg shadow-lg p-8 space-y-6 border border-border transition-all duration-200">
            <ErrorIcon />

            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold text-foreground">
                Something Went Wrong
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                The application encountered an unexpected error and couldn&apos;t
                continue.
              </p>
            </div>

            <ErrorDetails
              error={this.state.error}
              errorInfo={this.state.errorInfo}
            />

            {this.state.errorCount > 1 && (
              <p className="text-xs text-center text-muted-foreground">
                Error occurred {this.state.errorCount} times
              </p>
            )}

            <ErrorActions onReset={this.handleReset} />

            <p className="text-xs text-center text-muted-foreground leading-relaxed">
              If this error persists, please contact support or try clearing your
              browser cache.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
