import { useQuery } from "@tanstack/react-query";
import { getBulkStatus, type BulkFailure } from "../api/bulk.ts";

export interface BulkProgressState {
  completed: number;
  failed: number;
  total: number;
  isComplete: boolean;
  failures: BulkFailure[];
  estimatedTimeRemaining: string | null;
}

/** ETA derived from the batch's server-side start time and completion counts. */
export function formatEta(
  startedAt: string,
  completed: number,
  failed: number,
  total: number,
): string | null {
  const remaining = total - completed - failed;
  if (completed === 0 || remaining <= 0) return null;
  const elapsedMs = Date.now() - new Date(startedAt).getTime();
  const remainingSec = Math.ceil(((elapsedMs / completed) * remaining) / 1000);
  return remainingSec < 60
    ? "Less than a minute"
    : `${Math.ceil(remainingSec / 60)} minutes`;
}

/** Polls the bulk batch status endpoint while the batch is active. */
export function useBulkProgress(batchId: string | null): BulkProgressState {
  const { data } = useQuery({
    queryKey: ["bulkProgress", batchId],
    queryFn: () => getBulkStatus(batchId!),
    enabled: !!batchId,
    refetchInterval: (query) =>
      query.state.data && query.state.data.status !== "active" ? false : 2000,
  });

  return {
    completed: data?.completed ?? 0,
    failed: data?.failed ?? 0,
    total: data?.total ?? 0,
    isComplete: data ? data.status !== "active" : false,
    failures: data?.failures ?? [],
    estimatedTimeRemaining:
      data && data.status === "active"
        ? formatEta(data.startedAt, data.completed, data.failed, data.total)
        : null,
  };
}
