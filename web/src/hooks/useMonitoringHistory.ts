import { useQuery } from "@tanstack/react-query";
import {
  getMonitoringHistory,
  type MonitoringHistoryEntry,
} from "../api/client.ts";

export function useMonitoringHistory() {
  return useQuery<MonitoringHistoryEntry[]>({
    queryKey: ["monitoringHistory"],
    queryFn: getMonitoringHistory,
  });
}
