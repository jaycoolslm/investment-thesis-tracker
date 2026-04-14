interface EmptyStateProps {
  onAddHolding?: () => void;
}

export function EmptyState({ onAddHolding }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <p className="text-lg font-medium text-brand-800 mb-2">
        No holdings yet
      </p>
      <p className="text-sm text-brand-500 mb-6 max-w-md">
        Add your first holding to generate an investment thesis powered by AI.
      </p>
      <button
        onClick={onAddHolding}
        className="bg-accent-600 hover:bg-accent-700 text-white text-sm font-medium px-4 py-2 rounded-md focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-2 transition-colors"
      >
        + Add Holding
      </button>
    </div>
  );
}
