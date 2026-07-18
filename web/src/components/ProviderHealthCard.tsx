import { useProviderHealth } from "../hooks/useProviderHealth.ts";

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ProviderHealthCard() {
  const { data: health, isLoading, isError } = useProviderHealth();

  // Not configured (query resolves to null) or first load → render nothing so
  // the card never flashes and stays hidden on single-app deployments.
  if (isLoading) return null;
  if (!isError && health == null) return null;

  const lastRun = health?.sources[0]?.lastRun ?? null;
  const crawlError = lastRun?.error ?? null;
  const unreachable = isError;

  let statusLabel: string;
  let statusClass: string;
  if (unreachable) {
    statusLabel = "Unreachable";
    statusClass = "bg-status-red-100 text-status-red-700";
  } else if (crawlError) {
    statusLabel = "Crawl error";
    statusClass = "bg-status-red-100 text-status-red-700";
  } else {
    statusLabel = "Healthy";
    statusClass = "bg-status-green-100 text-status-green-700";
  }

  return (
    <div className="mt-8">
      <h2 className="text-sm font-medium text-brand-500 uppercase tracking-wider mb-3">
        Data Provider
      </h2>
      <div className="bg-surface-card rounded-md shadow-sm border border-brand-200 p-4">
        <div className="flex items-center gap-3 mb-3">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass}`}
          >
            {statusLabel}
          </span>
          {unreachable && (
            <span className="text-sm text-brand-500">
              Could not reach the data provider.
            </span>
          )}
        </div>

        {!unreachable && health && (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs text-brand-500 uppercase tracking-wider">
                Last crawl
              </dt>
              <dd className="text-brand-900 font-medium">
                {lastRun?.finishedAt
                  ? formatDateTime(lastRun.finishedAt)
                  : lastRun?.startedAt
                    ? `${formatDateTime(lastRun.startedAt)} (running)`
                    : "Never"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-brand-500 uppercase tracking-wider">
                New articles
              </dt>
              <dd className="text-brand-900 font-mono tabular-nums">
                {lastRun?.articlesNew ?? 0}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-brand-500 uppercase tracking-wider">
                Total articles
              </dt>
              <dd className="text-brand-900 font-mono tabular-nums">
                {health.articleCount}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-brand-500 uppercase tracking-wider">
                Bodies cached
              </dt>
              <dd className="text-brand-900 font-mono tabular-nums">
                {health.bodyCount}
              </dd>
            </div>
          </dl>
        )}

        {crawlError && (
          <p className="mt-3 text-sm text-status-red-700">{crawlError}</p>
        )}
      </div>
    </div>
  );
}
