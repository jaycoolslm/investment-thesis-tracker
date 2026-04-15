import type { FallbackProps } from "react-error-boundary";

export function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center min-h-[400px] text-center px-4"
    >
      <div className="bg-surface-card rounded-lg p-8 shadow-sm border border-brand-200 max-w-md w-full">
        <h2 className="text-lg font-semibold text-brand-900 mb-2">
          Something went wrong
        </h2>
        <p className="text-sm text-brand-500 mb-4">
          An unexpected error occurred. Please try again or refresh the page.
        </p>
        {error instanceof Error && error.message && (
          <pre className="text-xs text-brand-400 bg-brand-50 rounded p-3 mb-4 overflow-auto max-h-24 text-left">
            {error.message}
          </pre>
        )}
        <button
          onClick={resetErrorBoundary}
          className="px-4 py-2 text-sm font-medium text-white bg-accent-600 hover:bg-accent-700 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-2"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
