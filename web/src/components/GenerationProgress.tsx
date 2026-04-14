import {
  useGenerationProgress,
  type StepStatus,
} from "../hooks/useGenerationProgress.ts";

interface GenerationProgressProps {
  holdingId: string;
  ticker: string;
  bullets: string;
  hasDocuments: boolean;
  onComplete: () => void;
  onRetry: () => void;
}

export function GenerationProgress({
  holdingId,
  ticker,
  bullets,
  hasDocuments,
  onComplete,
  onRetry,
}: GenerationProgressProps) {
  const { steps, isComplete, error } = useGenerationProgress(
    holdingId,
    bullets,
    hasDocuments,
  );

  // Auto-call onComplete when generation finishes
  if (isComplete) {
    // Use a timeout to avoid calling during render
    setTimeout(onComplete, 500);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-8 text-center">
        <h3 className="text-lg font-semibold text-brand-900 mb-6">
          Generating thesis for {ticker}
        </h3>

        <ul className="space-y-4 text-left mb-6">
          {steps.map((step) => (
            <li key={step.id} className="flex items-center gap-3">
              <StepIcon status={step.status} />
              <span
                className={`text-sm ${
                  step.status === "completed"
                    ? "text-brand-500"
                    : step.status === "failed"
                      ? "text-error-text"
                      : step.status === "active"
                        ? "text-brand-900 font-medium"
                        : "text-brand-500"
                }`}
              >
                {step.label}
              </span>
            </li>
          ))}
        </ul>

        {!error && !isComplete && (
          <p className="text-xs text-brand-500">
            This typically takes 30-60 seconds.
          </p>
        )}

        {error && (
          <div className="space-y-3">
            <p className="text-sm text-error-text">{error}</p>
            <button
              onClick={onRetry}
              className="bg-accent-600 hover:bg-accent-700 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StepIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case "completed":
      return (
        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-status-green-100 text-status-green-700">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M2.5 6L5 8.5L9.5 4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      );
    case "active":
      return (
        <span className="flex items-center justify-center w-5 h-5">
          <span className="w-4 h-4 border-2 border-accent-600 border-t-transparent rounded-full animate-spin" />
        </span>
      );
    case "failed":
      return (
        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-error-bg text-error-text">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M3 3L9 9M9 3L3 9"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </span>
      );
    case "pending":
    default:
      return (
        <span className="flex items-center justify-center w-5 h-5">
          <span className="w-3 h-3 rounded-full border-2 border-brand-200" />
        </span>
      );
  }
}
