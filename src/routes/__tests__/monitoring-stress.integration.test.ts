import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  VALID_WEEKLY_LOG_FIXTURE,
} from "../../agent/__tests__/fixtures.js";

// Mock agent + market data
let mockCallCount = 0;
const mockAnalyseWeekly = vi.fn(async () => {
  mockCallCount++;
  // Simulate small delay
  await new Promise((r) => setTimeout(r, 5));
  return {
    ...VALID_WEEKLY_LOG_FIXTURE,
    priceChangePct: null,
    indexChangePct: null,
    relativePerf: null,
  };
});

vi.mock("../../agent/codex-agent.js", () => ({
  ThesisAgent: class MockThesisAgent {
    generateThesis = vi.fn();
    analyseWeekly = mockAnalyseWeekly;
  },
}));

vi.mock("../../services/market-data.js", () => ({
  MarketDataService: class MockMarketDataService {
    getWeeklyReturn = vi.fn().mockResolvedValue(null);
    getIndexWeeklyReturn = vi.fn().mockResolvedValue(null);
  },
}));

const { db } = await import("../../db/index.js");
const { weeklyLogs } = await import("../../db/schema.js");
const { seedManyHoldings, cleanAllTables } = await import(
  "../../__tests__/helpers.js"
);
const { runMonitoringBatch } = await import("../../jobs/scheduler.js");
const { clearRegistry } = await import("../../services/batch-runner.js");

// Import the service class for direct testing
const { WeeklyMonitoringService } = await import(
  "../../services/weekly-monitoring.js"
);

beforeEach(async () => {
  vi.clearAllMocks();
  clearRegistry();
  mockCallCount = 0;
  await cleanAllTables();
});

/** Simple concurrency limiter */
async function withConcurrency<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
): Promise<{ succeeded: number; failed: number }> {
  let succeeded = 0;
  let failed = 0;
  const queue = [...items];

  async function worker() {
    while (queue.length > 0) {
      const item = queue.shift()!;
      try {
        await fn(item);
        succeeded++;
      } catch {
        failed++;
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return { succeeded, failed };
}

describe("Stress test: 200+ holdings batch (integration)", () => {
  it("scheduler runs 220 holdings through a monitoring batch", { timeout: 60_000 }, async () => {
    await seedManyHoldings(220);

    const result = await runMonitoringBatch();

    expect(result).not.toBeNull();
    expect(result!.weekLabel).toBeDefined();
    expect(result!.total).toBe(220);

    await result!.done;
    const rows = await db.select().from(weeklyLogs);
    expect(rows).toHaveLength(220);
  });

  it("direct monitoring of 200 holdings completes under 60s with mocked agent", { timeout: 120_000 }, async () => {
    const { holdings } = await seedManyHoldings(200);
    const service = new WeeklyMonitoringService();

    const start = performance.now();
    const { succeeded, failed } = await withConcurrency(
      holdings,
      10,
      async (h) => {
        await service.monitorHolding(h.id);
      },
    );
    const elapsed = performance.now() - start;

    expect(succeeded).toBe(200);
    expect(failed).toBe(0);
    expect(elapsed).toBeLessThan(60_000);
  });

  it("all 200 weekly_logs are persisted correctly", { timeout: 120_000 }, async () => {
    const { holdings } = await seedManyHoldings(200);
    const service = new WeeklyMonitoringService();

    await withConcurrency(holdings, 10, async (h) => {
      await service.monitorHolding(h.id);
    });

    const rows = await db.select().from(weeklyLogs);
    expect(rows).toHaveLength(200);

    // Verify each row has the right shape
    for (const row of rows) {
      expect(row.holdingId).toBeDefined();
      expect(row.weekLabel).toBeDefined();
      expect(row.thesisImpact).toBe("strengthened");
      expect(row.summary).toBeTruthy();
    }
  });

  it("batch handles partial failures gracefully (10% failure rate)", { timeout: 120_000 }, async () => {
    const { holdings } = await seedManyHoldings(100);

    // Make agent fail every 10th call
    let callIndex = 0;
    mockAnalyseWeekly.mockImplementation(async () => {
      callIndex++;
      await new Promise((r) => setTimeout(r, 5));
      if (callIndex % 10 === 0) {
        throw new Error(`Simulated failure at call ${callIndex}`);
      }
      return {
        ...VALID_WEEKLY_LOG_FIXTURE,
        priceChangePct: null,
        indexChangePct: null,
        relativePerf: null,
      };
    });

    const service = new WeeklyMonitoringService();
    // Use lower concurrency to avoid DB pool exhaustion in test container
    const { succeeded, failed } = await withConcurrency(
      holdings,
      3,
      async (h) => {
        await service.monitorHolding(h.id);
      },
    );

    // 10% agent failure rate = ~10 failures, ~90 successes
    expect(succeeded).toBeGreaterThanOrEqual(80);
    expect(succeeded).toBeLessThanOrEqual(95);
    expect(failed).toBeGreaterThanOrEqual(5);
    expect(failed).toBeLessThanOrEqual(20);
    expect(succeeded + failed).toBe(100);

    // All succeeded ones should have persisted logs
    const rows = await db.select().from(weeklyLogs);
    expect(rows).toHaveLength(succeeded);
  });
});
