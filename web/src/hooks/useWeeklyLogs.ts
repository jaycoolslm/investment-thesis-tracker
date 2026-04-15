import { useQuery } from "@tanstack/react-query";
import { getWeeklyLogs } from "../api/client.ts";

export function useWeeklyLogs(holdingId: string) {
  return useQuery({
    queryKey: ["weeklyLogs", holdingId],
    queryFn: () => getWeeklyLogs(holdingId),
    enabled: !!holdingId,
  });
}
