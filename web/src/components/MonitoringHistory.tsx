import { useMonitoringHistory } from "../hooks/useMonitoringHistory.ts";

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function MonitoringHistory() {
  const { data: history, isLoading } = useMonitoringHistory();

  if (isLoading || !history || history.length === 0) return null;

  return (
    <div className="mt-8">
      <h2 className="text-sm font-medium text-brand-500 uppercase tracking-wider mb-3">
        Monitoring History
      </h2>
      <div className="bg-surface-card rounded-md shadow-sm border border-brand-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-brand-50 border-b border-brand-200">
              <th className="px-4 py-2.5 text-left text-xs font-medium text-brand-500 uppercase tracking-wider">
                Week
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-brand-500 uppercase tracking-wider">
                Holdings
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-status-green-600 uppercase tracking-wider">
                Strengthened
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-status-red-600 uppercase tracking-wider">
                Weakened
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-brand-500 uppercase tracking-wider">
                Unchanged
              </th>
            </tr>
          </thead>
          <tbody>
            {history.map((entry) => (
              <tr
                key={entry.weekLabel}
                className="border-b border-brand-100 last:border-0"
              >
                <td className="px-4 py-2.5 font-medium text-brand-900">
                  {entry.weekDate ? formatDate(entry.weekDate) : entry.weekLabel}
                </td>
                <td className="px-4 py-2.5 text-brand-700 font-mono tabular-nums">
                  {entry.total}
                </td>
                <td className="px-4 py-2.5 text-status-green-600 font-mono tabular-nums">
                  {entry.strengthened}
                </td>
                <td className="px-4 py-2.5 text-status-red-600 font-mono tabular-nums">
                  {entry.weakened}
                </td>
                <td className="px-4 py-2.5 text-brand-500 font-mono tabular-nums">
                  {entry.unchanged}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
