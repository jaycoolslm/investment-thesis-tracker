export function LoadingSkeleton() {
  return (
    <div className="bg-surface-card rounded-md shadow-sm border border-brand-200 overflow-hidden">
      {/* Header */}
      <div className="bg-brand-50 border-b border-brand-200 px-3 py-3 flex gap-4">
        {[80, 160, 70, 90, 90, 100, 70].map((w, i) => (
          <div
            key={i}
            className="h-3 bg-brand-200 rounded motion-safe:animate-pulse motion-reduce:opacity-60"
            style={{ width: w }}
          />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: 8 }, (_, i) => (
        <div
          key={i}
          className="px-3 py-4 flex gap-4 border-b border-brand-100 last:border-b-0"
        >
          {[60, 140, 50, 80, 80, 80, 50].map((w, j) => (
            <div
              key={j}
              className="h-4 bg-brand-100 rounded motion-safe:animate-pulse motion-reduce:opacity-60"
              style={{ width: w }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
