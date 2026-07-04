import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  runBatch,
  registerBatch,
  getBatch,
  cancelBatch,
  clearRegistry,
  type BatchItem,
} from "../batch-runner.js";

function items(n: number): BatchItem[] {
  return Array.from({ length: n }, (_, i) => ({
    holdingId: `holding-${i}`,
    ticker: `TICK${i}`,
  }));
}

beforeEach(() => {
  clearRegistry();
});

describe("registry", () => {
  it("registerBatch creates an active entry readable via getBatch", () => {
    registerBatch("b1", "bulk", 5);
    expect(getBatch("b1")).toMatchObject({
      kind: "bulk",
      total: 5,
      completed: 0,
      failed: 0,
      status: "active",
    });
  });

  it("getBatch returns null for unknown batches", () => {
    expect(getBatch("nope")).toBeNull();
  });

  it("cancelBatch only flags active batches", () => {
    registerBatch("b1", "monitoring", 1);
    expect(cancelBatch("b1")).toBe(true);
    expect(getBatch("b1")!.status).toBe("cancelled");
    expect(cancelBatch("b1")).toBe(false); // already cancelled
    expect(cancelBatch("missing")).toBe(false);
  });
});

describe("runBatch", () => {
  it("runs every item and marks the batch complete", async () => {
    registerBatch("b1", "bulk", 10);
    const work = vi.fn().mockResolvedValue(undefined);
    const onItemDone = vi.fn();

    const state = await runBatch("b1", items(10), work, {
      concurrency: 3,
      retries: 1,
      onItemDone,
    });

    expect(work).toHaveBeenCalledTimes(10);
    expect(onItemDone).toHaveBeenCalledTimes(10);
    expect(state).toMatchObject({
      completed: 10,
      failed: 0,
      status: "complete",
    });
  });

  it("respects the concurrency limit", async () => {
    registerBatch("b1", "bulk", 12);
    let inFlight = 0;
    let maxInFlight = 0;

    const state = await runBatch(
      "b1",
      items(12),
      async () => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((r) => setTimeout(r, 10));
        inFlight--;
      },
      { concurrency: 3, retries: 0 },
    );

    expect(maxInFlight).toBeLessThanOrEqual(3);
    expect(state.completed).toBe(12);
  });

  it("retries a failing item, then counts it failed exactly once", async () => {
    registerBatch("b1", "bulk", 3);
    const attempts = new Map<string, number>();
    const onItemFailed = vi.fn();

    const state = await runBatch(
      "b1",
      items(3),
      async (item) => {
        attempts.set(item.holdingId, (attempts.get(item.holdingId) ?? 0) + 1);
        if (item.holdingId === "holding-1") throw new Error("boom");
      },
      { concurrency: 2, retries: 1, retryDelayMs: 1, onItemFailed },
    );

    // retries: 1 → two attempts for the failing item
    expect(attempts.get("holding-1")).toBe(2);
    // ...but `failed` increments once per item, never per attempt
    expect(state.failed).toBe(1);
    expect(state.completed).toBe(2);
    expect(onItemFailed).toHaveBeenCalledTimes(1);
    expect(state.failures).toEqual([
      { holdingId: "holding-1", ticker: "TICK1", error: "boom" },
    ]);
    expect(state.status).toBe("complete");
  });

  it("a retried item that succeeds on the second attempt counts as completed", async () => {
    registerBatch("b1", "bulk", 1);
    let calls = 0;

    const state = await runBatch(
      "b1",
      items(1),
      async () => {
        calls++;
        if (calls === 1) throw new Error("transient");
      },
      { concurrency: 1, retries: 1, retryDelayMs: 1 },
    );

    expect(calls).toBe(2);
    expect(state.completed).toBe(1);
    expect(state.failed).toBe(0);
  });

  it("completion fires exactly once with concurrently finishing items", async () => {
    registerBatch("b1", "monitoring", 20);
    let completions = 0;

    // All items resolve on the same tick to maximise finish-race pressure
    await runBatch(
      "b1",
      items(20),
      () => new Promise((r) => setTimeout(r, 5)),
      { concurrency: 20, retries: 0 },
    ).then((state) => {
      if (state.status === "complete") completions++;
    });

    expect(completions).toBe(1);
    const state = getBatch("b1")!;
    expect(state.completed + state.failed).toBe(state.total);
  });

  it("cancel stops unstarted items and preserves cancelled status", async () => {
    registerBatch("b1", "bulk", 10);
    const started: string[] = [];

    const running = runBatch(
      "b1",
      items(10),
      async (item) => {
        started.push(item.holdingId);
        await new Promise((r) => setTimeout(r, 20));
      },
      { concurrency: 2, retries: 0 },
    );

    // Let the first pair start, then cancel
    await new Promise((r) => setTimeout(r, 5));
    cancelBatch("b1");
    const state = await running;

    expect(state.status).toBe("cancelled");
    expect(started.length).toBeLessThan(10);
    // In-flight items still get counted; unstarted ones never ran
    expect(state.completed).toBe(started.length);
  });

  it("throws when the batch is not registered", async () => {
    await expect(
      runBatch("ghost", items(1), async () => {}, {
        concurrency: 1,
        retries: 0,
      }),
    ).rejects.toThrow("not registered");
  });
});
