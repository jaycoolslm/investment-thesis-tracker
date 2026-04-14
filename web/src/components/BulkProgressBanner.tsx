interface BulkProgressBannerProps {
  completed: number;
  failed: number;
  total: number;
  estimatedTimeRemaining: string | null;
  onCancel: () => void;
}

export function BulkProgressBanner({
  completed,
  failed,
  total,
  estimatedTimeRemaining,
  onCancel,
}: BulkProgressBannerProps) {
  const processed = completed + failed;
  const percent = total > 0 ? Math.round((processed / total) * 100) : 0;

  return (
    <div className="bg-accent-50 border-b border-accent-100 px-6 py-3">
      <div className="max-w-7xl mx-auto flex items-center gap-4">
        <p className="text-sm font-medium text-accent-700 shrink-0">
          Generating theses: {completed} of {total} complete
          {failed > 0 && (
            <span className="text-error-text ml-1">({failed} failed)</span>
          )}
        </p>

        <div
          className="flex-1 h-2 bg-brand-200 rounded-full overflow-hidden"
          role="progressbar"
          aria-valuenow={processed}
          aria-valuemax={total}
          aria-label={`Bulk generation progress: ${percent}%`}
        >
          <div
            className="h-full bg-accent-600 rounded-full transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>

        {estimatedTimeRemaining && (
          <span className="text-sm text-brand-500 shrink-0">
            ~{estimatedTimeRemaining}
          </span>
        )}

        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-brand-500 hover:text-brand-700 underline shrink-0"
        >
          Cancel Remaining
        </button>
      </div>
    </div>
  );
}
