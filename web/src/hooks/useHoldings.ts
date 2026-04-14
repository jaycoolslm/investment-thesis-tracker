import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getHoldings,
  createHolding,
  deleteHolding,
  type CreateHoldingInput,
} from "../api/client.ts";

export function useHoldings() {
  return useQuery({
    queryKey: ["holdings"],
    queryFn: getHoldings,
  });
}

export function useCreateHolding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateHoldingInput) => createHolding(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["holdings"] }),
  });
}

export function useDeleteHolding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteHolding(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["holdings"] }),
  });
}
