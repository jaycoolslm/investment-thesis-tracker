import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { generateThesis, getGenerationStatus } from "../api/client.ts";

export interface ActivityItem {
  id: string;
  type: "web_search" | "file_read" | "activity";
  text: string;
}

function toActivityItem(line: string, index: number): ActivityItem {
  const type = line.startsWith("Searching:")
    ? "web_search"
    : line.startsWith("Reading:")
      ? "file_read"
      : "activity";
  return { id: String(index), type, text: line };
}

/**
 * Fires the generation request (unless resuming after a reload) and polls
 * GET /api/holdings/:id/generation-status for the live activity feed.
 */
export function useGenerationProgress(
  holdingId: string | null,
  bullets: string,
  resume = false,
) {
  const [requestError, setRequestError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
  const generationFired = useRef(false);

  useEffect(() => {
    if (!holdingId || resume || generationFired.current) return;
    generationFired.current = true;
    generateThesis(holdingId, bullets).catch((err) => {
      setRequestError(
        err instanceof Error ? err.message : "Generation failed.",
      );
    });
  }, [holdingId, bullets, resume]);

  const query = useQuery({
    queryKey: ["generationStatus", holdingId],
    queryFn: () => getGenerationStatus(holdingId!),
    enabled: !!holdingId && !requestError && !isStale,
    retry: false,
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      return status === "complete" || status === "failed" ? false : 2000;
    },
  });

  // Resuming after a reload: if the server no longer tracks this generation
  // (restart or eviction), the restored state is stale — stop polling.
  useEffect(() => {
    if (resume && query.data === null) setIsStale(true);
  }, [resume, query.data]);

  const events = query.data?.events;
  const activity = useMemo(
    () => (events ?? []).map(toActivityItem),
    [events],
  );

  const status = query.data?.status;
  const error =
    requestError ??
    (status === "failed"
      ? (query.data?.error ?? "Generation failed. Please try again.")
      : null);

  return { activity, isComplete: status === "complete", error, isStale };
}
