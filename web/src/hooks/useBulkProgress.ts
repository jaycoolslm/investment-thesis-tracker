import { useEffect, useRef, useState } from "react";
import type { BulkFailure } from "../api/bulk.ts";

export interface BulkProgressState {
  completed: number;
  failed: number;
  total: number;
  currentTicker: string | null;
  isComplete: boolean;
  failures: BulkFailure[];
  estimatedTimeRemaining: string | null;
}

const isDev = window.location.port === "5173";
const API_BASE = isDev ? "http://localhost:3001" : "";

export function useBulkProgress(batchId: string | null): BulkProgressState {
  const [state, setState] = useState<BulkProgressState>({
    completed: 0,
    failed: 0,
    total: 0,
    currentTicker: null,
    isComplete: false,
    failures: [],
    estimatedTimeRemaining: null,
  });

  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!batchId) return;

    startTimeRef.current = Date.now();

    const es = new EventSource(
      `${API_BASE}/api/bulk-generate/${batchId}/progress`,
    );

    es.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "progress") {
        const completed = data.completed ?? 0;
        const total = data.total ?? 0;
        const remaining = total - completed - (data.failed ?? 0);

        // ETA calculation
        let eta: string | null = null;
        if (completed > 0 && remaining > 0) {
          const elapsed = Date.now() - startTimeRef.current;
          const avgMs = elapsed / completed;
          const remainingMs = avgMs * remaining;
          const remainingSec = Math.ceil(remainingMs / 1000);
          eta =
            remainingSec < 60
              ? "Less than a minute"
              : `${Math.ceil(remainingSec / 60)} minutes`;
        }

        setState((prev) => ({
          ...prev,
          completed,
          failed: data.failed ?? prev.failed,
          total,
          currentTicker: data.currentTicker ?? prev.currentTicker,
          estimatedTimeRemaining: eta,
        }));
      }

      if (data.type === "holding_failed") {
        setState((prev) => ({
          ...prev,
          failures: [
            ...prev.failures,
            {
              holdingId: data.holdingId,
              ticker: data.ticker,
              error: data.error,
            },
          ],
        }));
      }

      if (data.type === "batch_complete") {
        setState((prev) => ({
          ...prev,
          completed: data.completed ?? prev.completed,
          failed: data.failed ?? prev.failed,
          total: data.total ?? prev.total,
          isComplete: true,
          failures: data.failures ?? prev.failures,
          estimatedTimeRemaining: null,
        }));
        es.close();
      }
    };

    es.onerror = () => {
      // EventSource auto-reconnects; no special handling needed
    };

    return () => es.close();
  }, [batchId]);

  return state;
}
