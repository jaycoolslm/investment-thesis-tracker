import { EventEmitter } from "events";
import { eq, and, desc } from "drizzle-orm";
import type { ThreadEvent } from "@openai/codex-sdk";
import path from "node:path";
import { db } from "../db/index.js";
import { holdings, theses, weeklyLogs, documents } from "../db/schema.js";
import { ThesisAgent } from "../agent/codex-agent.js";
import { MarketDataService } from "./market-data.js";
import type { WeeklyAnalysisInput } from "../agent/prompts.js";

export type MonitoringProgressEvent =
  | { type: "started" }
  | { type: "fetching_prices" }
  | { type: "prices_fetched"; priceChangePct: number | null }
  | { type: "web_search"; query: string }
  | { type: "activity"; message: string }
  | { type: "complete" }
  | { type: "failed"; error: string }
  | { type: "skipped"; reason: string };

/**
 * Compute ISO 8601 week label, the Monday date, and the Friday date
 * for the given date (defaults to now).
 */
export function getCurrentWeek(now: Date = new Date()): {
  weekLabel: string;
  weekDate: string;
  fridayDate: Date;
} {
  // Find Monday of current week (ISO: Monday = 1)
  const dayOfWeek = now.getDay(); // 0 = Sun, 1 = Mon, ...
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - daysFromMonday);
  monday.setHours(0, 0, 0, 0);

  // Friday = Monday + 4
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);

  // ISO week number
  const jan4 = new Date(monday.getFullYear(), 0, 4);
  const jan4DayOfWeek = jan4.getDay() === 0 ? 7 : jan4.getDay();
  const isoWeekStart = new Date(jan4);
  isoWeekStart.setDate(jan4.getDate() - jan4DayOfWeek + 1);

  const weekNumber =
    Math.ceil(
      ((monday.getTime() - isoWeekStart.getTime()) / 86_400_000 + 1) / 7,
    );

  const weekLabel = `${monday.getFullYear()}-W${String(weekNumber).padStart(2, "0")}`;
  const weekDate = monday.toISOString().split("T")[0];

  return { weekLabel, weekDate, fridayDate: friday };
}

export class WeeklyMonitoringService extends EventEmitter {
  private agent: ThesisAgent;
  private marketData: MarketDataService;

  constructor(agent?: ThesisAgent, marketData?: MarketDataService) {
    super();
    this.agent = agent ?? new ThesisAgent();
    this.marketData = marketData ?? new MarketDataService();
  }

  async monitorHolding(holdingId: string): Promise<string> {
    // 1. Compute week label (ISO 8601)
    const { weekLabel, weekDate, fridayDate } = getCurrentWeek();

    // 2. Idempotency check
    const [existing] = await db
      .select()
      .from(weeklyLogs)
      .where(
        and(
          eq(weeklyLogs.holdingId, holdingId),
          eq(weeklyLogs.weekLabel, weekLabel),
        ),
      );

    if (existing) {
      this.emitProgress({ type: "skipped", reason: "already_exists" });
      return existing.id;
    }

    // 3. Load holding
    const [holding] = await db
      .select()
      .from(holdings)
      .where(eq(holdings.id, holdingId));

    if (!holding) {
      throw new HoldingNotFoundError(holdingId);
    }

    if (holding.status !== "active") {
      this.emitProgress({ type: "skipped", reason: "not_active" });
      return "";
    }

    this.emitProgress({ type: "started" });

    // 4. Load latest thesis
    const [thesis] = await db
      .select()
      .from(theses)
      .where(eq(theses.holdingId, holdingId))
      .orderBy(desc(theses.createdAt))
      .limit(1);

    if (!thesis) {
      const error = new NoThesisError(holdingId);
      this.emitProgress({ type: "failed", error: error.message });
      throw error;
    }

    // 5. Load broker research file paths
    const docs = await db
      .select()
      .from(documents)
      .where(eq(documents.holdingId, holdingId));

    // 6. Fetch market data
    this.emitProgress({ type: "fetching_prices" });

    const priceResult = await this.marketData.getWeeklyReturn(
      holding.ticker,
      fridayDate,
    );
    const indexResult = await this.marketData.getIndexWeeklyReturn(
      holding.benchmark,
      fridayDate,
    );

    const priceChangePct = priceResult?.priceChangePct ?? null;
    const indexChangePct = indexResult?.priceChangePct ?? null;
    const relativePerf =
      priceChangePct != null && indexChangePct != null
        ? Math.round((priceChangePct - indexChangePct) * 100) / 100
        : null;

    this.emitProgress({ type: "prices_fetched", priceChangePct });

    // 7. Build input and call agent
    const input: WeeklyAnalysisInput = {
      ticker: holding.ticker,
      companyName: holding.companyName,
      direction: holding.direction,
      benchmarkIndex: holding.benchmark,
      thesisContent: thesis.content ?? "",
      researchFilePaths: docs.map((d) => d.filePath),
      priceData: { priceChangePct, indexChangePct, relativePerf },
      weekLabel,
      weekDate,
    };

    let result;
    try {
      result = await this.agent.analyseWeekly(
        input,
        AbortSignal.timeout(120_000),
        (event) => this.handleAgentEvent(event),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      this.emitProgress({ type: "failed", error: message });
      throw err;
    }

    // 8. Overwrite price fields with verified market data values
    result.priceChangePct = priceChangePct;
    result.indexChangePct = indexChangePct;
    result.relativePerf = relativePerf;

    // 9. Persist in transaction
    const logId = await db.transaction(async (tx) => {
      const [log] = await tx
        .insert(weeklyLogs)
        .values({
          holdingId,
          weekLabel,
          weekDate,
          priceChangePct: priceChangePct?.toString(),
          indexChangePct: indexChangePct?.toString(),
          relativePerf: relativePerf?.toString(),
          thesisImpact: result.thesisImpact,
          summary: result.summary,
          sources: result.sources,
        })
        .returning();

      await tx
        .update(holdings)
        .set({
          latestImpact: result.thesisImpact,
          lastUpdated: new Date(),
        })
        .where(eq(holdings.id, holdingId));

      return log.id;
    });

    this.emitProgress({ type: "complete" });
    return logId;
  }

  private handleAgentEvent(event: ThreadEvent): void {
    switch (event.type) {
      case "item.started":
        if (event.item.type === "file_change") {
          const filePath = event.item.changes?.[0]?.path;
          if (filePath) {
            this.emitProgress({
              type: "activity",
              message: `Reading ${path.basename(filePath)}...`,
            });
          }
        }
        if (event.item.type === "agent_message") {
          this.emitProgress({
            type: "activity",
            message: "Compiling weekly analysis...",
          });
        }
        break;

      case "item.completed":
        if (event.item.type === "web_search" && event.item.query) {
          this.emitProgress({
            type: "web_search",
            query: event.item.query,
          });
        }
        break;
    }
  }

  private emitProgress(event: MonitoringProgressEvent): void {
    this.emit("progress", event);
  }

}

export class HoldingNotFoundError extends Error {
  constructor(holdingId: string) {
    super(`Holding not found: ${holdingId}`);
    this.name = "HoldingNotFoundError";
  }
}

export class NoThesisError extends Error {
  constructor(holdingId: string) {
    super(
      `No thesis exists for holding ${holdingId}. Generate a thesis first.`,
    );
    this.name = "NoThesisError";
  }
}
