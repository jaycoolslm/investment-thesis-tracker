import { useState, useEffect, useRef, useCallback } from "react";
import { generateThesis } from "../api/client.ts";

export interface ActivityItem {
  id: string;
  type: "web_search" | "file_read" | "activity";
  text: string;
}

export function useGenerationProgress(
  holdingId: string | null,
  bullets: string,
  hasDocuments: boolean,
) {
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generationFired = useRef(false);
  const activityCounter = useRef(0);

  const addActivity = useCallback(
    (type: ActivityItem["type"], text: string) => {
      const id = String(++activityCounter.current);
      setActivity((prev) => [...prev, { id, type, text }]);
    },
    [],
  );

  useEffect(() => {
    if (!holdingId) return;

    setActivity([]);
    setIsComplete(false);
    setError(null);
    activityCounter.current = 0;

    let cancelled = false;

    // Connect SSE directly to API server in dev (Vite proxy buffers SSE)
    const baseUrl = import.meta.env.DEV ? "http://localhost:3001" : "";
    const es = new EventSource(
      `${baseUrl}/api/holdings/${holdingId}/progress`,
    );

    es.onmessage = (event) => {
      if (cancelled) return;
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case "web_search":
            addActivity("web_search", data.query);
            break;
          case "file_read":
            addActivity("file_read", data.path);
            break;
          case "activity":
            addActivity("activity", data.message);
            break;
          case "complete":
            setIsComplete(true);
            es.close();
            break;
          case "failed":
            setError(data.error ?? "Generation failed. Please try again.");
            es.close();
            break;
          // "started" — no-op, modal is already visible
        }
      } catch {
        // ignore malformed
      }
    };

    es.onerror = () => {
      // EventSource auto-reconnects on transient errors.
    };

    // Fire generation AFTER EventSource is open
    es.onopen = () => {
      if (cancelled) return;
      if (generationFired.current) return;
      generationFired.current = true;

      generateThesis(holdingId, bullets).catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Generation failed.",
          );
          es.close();
        }
      });
    };

    return () => {
      cancelled = true;
      generationFired.current = false;
      es.close();
    };
  }, [holdingId, bullets, hasDocuments, addActivity]);

  return { activity, isComplete, error };
}
