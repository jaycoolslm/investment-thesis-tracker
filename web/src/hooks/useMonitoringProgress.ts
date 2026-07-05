import { useQuery } from "@tanstack/react-query";
import {
  getMonitoringStatus,
  type MonitoringBatchStatus,
  type MonitoringFailure,
} from "../api/client.ts";
import { formatEta } from "./useBulkProgress.ts";

export type { MonitoringFailure };

export interface MonitoringProgressState {
  completed: number;
  failed: number;
  total: number;
  isComplete: boolean;
  failures: MonitoringFailure[];
  estimatedTimeRemaining: string | null;
}

/**
 * Polls GET /api/monitoring/status while a batch is active. Shares the
 * ["monitoringStatus"] cache with useMonitoringStatus — callers should clear
 * that cache when starting a new batch so a previous run's completed state
 * doesn't read as instant completion.
 */
export function useMonitoringProgress(active: boolean): MonitoringProgressState {
  const { data } = useQuery<MonitoringBatchStatus>({
    queryKey: ["monitoringStatus"],
    queryFn: getMonitoringStatus,
    enabled: active,
    retry: false,
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
