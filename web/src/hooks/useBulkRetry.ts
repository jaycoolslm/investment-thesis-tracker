import { useMutation, useQueryClient } from "@tanstack/react-query";
import { retryBulkGeneration } from "../api/bulk.ts";

interface RetryParams {
  batchId: string;
  holdingIds?: string[];
}

export function useBulkRetry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ batchId, holdingIds }: RetryParams) =>
      retryBulkGeneration(batchId, holdingIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holdings"] });
    },
  });
}
