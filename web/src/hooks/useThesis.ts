import { useQuery } from "@tanstack/react-query";
import { getThesis, getHolding } from "../api/client.ts";

export function useThesis(holdingId: string) {
  return useQuery({
    queryKey: ["thesis", holdingId],
    queryFn: () => getThesis(holdingId),
    enabled: !!holdingId,
  });
}

export function useHolding(holdingId: string) {
  return useQuery({
    queryKey: ["holding", holdingId],
    queryFn: () => getHolding(holdingId),
    enabled: !!holdingId,
  });
}
