import { EventEmitter } from "events";
import { eq } from "drizzle-orm";
import type { ThreadEvent } from "@openai/codex-sdk";
import { db } from "../db/index.js";
import { holdings, theses, thesisPillars, documents } from "../db/schema.js";
import { ThesisAgent } from "../agent/codex-agent.js";
import { type ThesisOutput } from "../agent/schemas.js";
import path from "node:path";

export type ProgressEvent =
  | { type: "started" }
  | { type: "web_search"; query: string }
  | { type: "file_read"; path: string }
  | { type: "activity"; message: string }
  | { type: "complete" }
  | { type: "failed"; error: string };

export class ThesisGenerationService extends EventEmitter {
  private agent: ThesisAgent;

  constructor(agent?: ThesisAgent) {
    super();
    this.agent = agent ?? new ThesisAgent();
  }

  async generate(holdingId: string, bullets: string): Promise<string> {
    // 1. Validate holding exists
    const [holding] = await db
      .select()
      .from(holdings)
      .where(eq(holdings.id, holdingId));

    if (!holding) {
      throw new HoldingNotFoundError(holdingId);
    }

    this.emitProgress({ type: "started" });

    // 2. Fetch uploaded documents
    const docs = await db
      .select()
      .from(documents)
      .where(eq(documents.holdingId, holdingId));
    const filePaths = docs.map((d) => d.filePath);

    // 3. Call agent with streaming events
    let result: ThesisOutput;
    try {
      result = await this.agent.generateThesis(
        {
          ticker: holding.ticker,
          companyName: holding.companyName,
          direction: holding.direction,
          bullets,
          benchmarkIndex: holding.benchmark,
          researchFilePaths: filePaths,
        },
        AbortSignal.timeout(900_000),
        (event) => this.handleAgentEvent(event),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      this.emitProgress({ type: "failed", error: message });
      throw err;
    }

    // 4. Persist in transaction
    const thesisId = await this.persistThesis(holdingId, result);

    this.emitProgress({ type: "complete" });

    return thesisId;
  }

  private lastWebSearchCompleted = false;

  private handleAgentEvent(event: ThreadEvent): void {
    switch (event.type) {
      case "item.started":
        if (event.item.type === "file_change") {
          const filePath = event.item.changes?.[0]?.path;
          if (filePath) {
            this.emitProgress({
              type: "file_read",
              path: path.basename(filePath),
            });
          }
        }
        // When agent_message starts after searches, the model is compiling
        if (event.item.type === "agent_message" && this.lastWebSearchCompleted) {
          this.emitProgress({
            type: "activity",
            message: "Compiling thesis...",
          });
        }
        break;

      case "item.completed":
        if (event.item.type === "web_search" && event.item.query) {
          this.lastWebSearchCompleted = true;
          this.emitProgress({
            type: "web_search",
            query: event.item.query,
          });
        }
        break;
    }
  }

  private emitProgress(event: ProgressEvent): void {
    this.emit("progress", event);
  }

  private async persistThesis(
    holdingId: string,
    output: ThesisOutput,
  ): Promise<string> {
    return await db.transaction(async (tx) => {
      const [thesis] = await tx
        .insert(theses)
        .values({
          holdingId,
          summary: output.summary,
          qualityAssess: output.qualityAssessment,
          valuation: output.valuation,
          assumptions: output.assumptions,
          risks: output.risks,
          sources: output.sources,
        })
        .returning();

      if (output.pillars.length > 0) {
        await tx.insert(thesisPillars).values(
          output.pillars.map((p, i) => ({
            thesisId: thesis.id,
            title: p.title,
            body: p.body,
            sortOrder: i,
          })),
        );
      }

      await tx
        .update(holdings)
        .set({ lastUpdated: new Date() })
        .where(eq(holdings.id, holdingId));

      return thesis.id;
    });
  }
}

export class HoldingNotFoundError extends Error {
  constructor(holdingId: string) {
    super(`Holding not found: ${holdingId}`);
    this.name = "HoldingNotFoundError";
  }
}
