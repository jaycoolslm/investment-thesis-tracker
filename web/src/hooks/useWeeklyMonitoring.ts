import { useMutation, useQueryClient } from "@tanstack/react-query";
import { triggerWeeklyMonitoring } from "../api/client.ts";

export function useTriggerWeeklyMonitoring(holdingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => triggerWeeklyMonitoring(holdingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["weeklyLogs", holdingId] });
      queryClient.invalidateQueries({ queryKey: ["holdings"] });
    },
  });
}
