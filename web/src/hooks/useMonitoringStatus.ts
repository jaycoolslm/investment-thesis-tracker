import { useQuery } from "@tanstack/react-query";
import { getMonitoringStatus, type MonitoringBatchStatus } from "../api/client.ts";

export function useMonitoringStatus() {
  return useQuery<MonitoringBatchStatus>({
    queryKey: ["monitoringStatus"],
    queryFn: getMonitoringStatus,
    refetchInterval: false,
    retry: false, // 404 when no batch exists is expected
  });
}
