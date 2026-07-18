import { useQuery } from "@tanstack/react-query";
import { getProviderHealth, type ProviderHealth } from "../api/client.ts";

export function useProviderHealth() {
  return useQuery<ProviderHealth | null>({
    queryKey: ["providerHealth"],
    queryFn: getProviderHealth,
    refetchInterval: 60_000,
  });
}
