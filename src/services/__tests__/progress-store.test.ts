import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  startGeneration,
  appendGenerationEvent,
  finishGeneration,
  getGenerationProgress,
  clearProgressStore,
} from "../progress-store.js";

describe("progress-store", () => {
  beforeEach(() => {
    clearProgressStore();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns null for an unknown holding", () => {
    expect(getGenerationProgress("nope")).toBeNull();
  });

  it("tracks a running generation and its events", () => {
    startGeneration("h1");
    appendGenerationEvent("h1", 'Searching: "AAPL earnings"');
    appendGenerationEvent("h1", "Compiling thesis...");

    const state = getGenerationProgress("h1");
    expect(state?.status).toBe("running");
    expect(state?.events).toEqual([
      'Searching: "AAPL earnings"',
      "Compiling thesis...",
    ]);
    expect(state?.startedAt).toBeDefined();
  });

  it("caps events at the most recent 50", () => {
    startGeneration("h1");
    for (let i = 1; i <= 60; i++) {
      appendGenerationEvent("h1", `event ${i}`);
    }
    const events = getGenerationProgress("h1")!.events;
    expect(events).toHaveLength(50);
    expect(events[0]).toBe("event 11");
    expect(events[49]).toBe("event 60");
  });

  it("marks completion and failure with error message", () => {
    startGeneration("h1");
    finishGeneration("h1", "complete");
    expect(getGenerationProgress("h1")?.status).toBe("complete");

    startGeneration("h2");
    finishGeneration("h2", "failed", "boom");
    const failed = getGenerationProgress("h2");
    expect(failed?.status).toBe("failed");
    expect(failed?.error).toBe("boom");
  });

  it("re-running a generation resets the entry", () => {
    startGeneration("h1");
    appendGenerationEvent("h1", "old event");
    finishGeneration("h1", "complete");

    startGeneration("h1");
    const state = getGenerationProgress("h1");
    expect(state?.status).toBe("running");
    expect(state?.events).toEqual([]);
  });

  it("evicts finished entries after the TTL but keeps running ones", () => {
    vi.useFakeTimers();
    startGeneration("done");
    finishGeneration("done", "complete");
    startGeneration("running");

    vi.advanceTimersByTime(11 * 60 * 1000);

    expect(getGenerationProgress("done")).toBeNull();
    expect(getGenerationProgress("running")?.status).toBe("running");
  });

  it("ignores appends and finishes for unknown holdings", () => {
    appendGenerationEvent("ghost", "line");
    finishGeneration("ghost", "complete");
    expect(getGenerationProgress("ghost")).toBeNull();
  });
});
