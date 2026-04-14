import { useState, useEffect, useRef, useCallback } from "react";
import { generateThesis } from "../api/client.ts";

export type StepStatus = "pending" | "active" | "completed" | "failed";

export interface ProgressStep {
  id: string;
  label: string;
  status: StepStatus;
}

const STEP_ORDER = [
  "generation_started",
  "searching_market_data",
  "analysing_broker_research",
  "building_thesis_pillars",
  "compiling_document",
  "generation_complete",
] as const;

function buildSteps(hasDocuments: boolean): ProgressStep[] {
  const steps: ProgressStep[] = [
    { id: "searching_market_data", label: "Searching for latest market data...", status: "pending" },
  ];
  if (hasDocuments) {
    steps.push({ id: "analysing_broker_research", label: "Analysing broker research...", status: "pending" });
  }
  steps.push(
    { id: "building_thesis_pillars", label: "Building thesis pillars...", status: "pending" },
    { id: "compiling_document", label: "Compiling thesis document...", status: "pending" },
  );
  return steps;
}

export function useGenerationProgress(
  holdingId: string | null,
  bullets: string,
  hasDocuments: boolean,
) {
  const [steps, setSteps] = useState<ProgressStep[]>(() => buildSteps(hasDocuments));
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generationFired = useRef(false);

  const updateStep = useCallback((stepId: string) => {
    setSteps((prev) =>
      prev.map((s) => {
        if (s.id === stepId) return { ...s, status: "active" };
        const stepIndex = STEP_ORDER.indexOf(stepId as (typeof STEP_ORDER)[number]);
        const currentIndex = STEP_ORDER.indexOf(s.id as (typeof STEP_ORDER)[number]);
        if (currentIndex < stepIndex && s.status !== "completed") {
          return { ...s, status: "completed" };
        }
        return s;
      }),
    );
  }, []);

  useEffect(() => {
    if (!holdingId) return;

    setSteps(buildSteps(hasDocuments));
    setIsComplete(false);
    setError(null);

    let cancelled = false;

    // Connect SSE directly to API server — Vite's proxy buffers streaming responses
    // which prevents EventSource from receiving events. In production, use relative URL.
    const baseUrl = import.meta.env.DEV ? "http://localhost:3001" : "";
    const es = new EventSource(`${baseUrl}/api/holdings/${holdingId}/progress`);

    es.onmessage = (event) => {
      if (cancelled) return;
      try {
        const data = JSON.parse(event.data);
        if (data.step === "generation_complete") {
          setSteps((prev) => prev.map((s) => ({ ...s, status: "completed" })));
          setIsComplete(true);
          es.close();
        } else if (data.step === "generation_failed") {
          setError("Generation failed. Please try again.");
          es.close();
        } else {
          updateStep(data.step);
        }
      } catch {
        // ignore malformed
      }
    };

    es.onerror = () => {
      // EventSource auto-reconnects on transient errors.
      // If the stream was intentionally closed (generation_complete), this fires
      // once more — but cancelled/isComplete guards prevent side effects.
    };

    // Fire generation AFTER EventSource is open (onopen fires when connected)
    es.onopen = () => {
      if (cancelled) return;
      if (generationFired.current) return;
      generationFired.current = true;

      generateThesis(holdingId, bullets).catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Generation failed.");
          es.close();
        }
      });
    };

    return () => {
      cancelled = true;
      generationFired.current = false;
      es.close();
    };
  }, [holdingId, bullets, hasDocuments, updateStep]);

  return { steps, isComplete, error };
}
