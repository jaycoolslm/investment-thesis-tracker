import { eq } from "drizzle-orm";
import type { ThreadEvent } from "@openai/codex-sdk";
import { db } from "../db/index.js";
import { holdings, theses, documents } from "../db/schema.js";
import { ThesisAgent } from "../agent/codex-agent.js";
import { type ThesisOutput } from "../agent/schemas.js";
import {
  startGeneration,
  appendGenerationEvent,
  finishGeneration,
} from "./progress-store.js";
import path from "node:path";

export class ThesisGenerationService {
  private agent: ThesisAgent;

  constructor(agent?: ThesisAgent) {
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

    startGeneration(holdingId);

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
        (event) => this.handleAgentEvent(holdingId, event),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      finishGeneration(holdingId, "failed", message);
      throw err;
    }

    // 4. Persist in transaction
    const thesisId = await this.persistThesis(holdingId, result);

    finishGeneration(holdingId, "complete");

    return thesisId;
  }

  private lastWebSearchCompleted = false;

  private handleAgentEvent(holdingId: string, event: ThreadEvent): void {
    switch (event.type) {
      case "item.started":
        if (event.item.type === "file_change") {
          const filePath = event.item.changes?.[0]?.path;
          if (filePath) {
            appendGenerationEvent(
              holdingId,
              `Reading: ${path.basename(filePath)}`,
            );
          }
        }
        // When agent_message starts after searches, the model is compiling
        if (event.item.type === "agent_message" && this.lastWebSearchCompleted) {
          appendGenerationEvent(holdingId, "Compiling thesis...");
        }
        break;

      case "item.completed":
        if (event.item.type === "web_search" && event.item.query) {
          this.lastWebSearchCompleted = true;
          appendGenerationEvent(holdingId, `Searching: "${event.item.query}"`);
        }
        break;
    }
  }

  private async persistThesis(
    holdingId: string,
    output: ThesisOutput,
  ): Promise<string> {
    const [thesis] = await db
      .insert(theses)
      .values({
        holdingId,
        content: output.content,
        sources: output.sources,
      })
      .returning();

    return thesis.id;
  }
}

export class HoldingNotFoundError extends Error {
  constructor(holdingId: string) {
    super(`Holding not found: ${holdingId}`);
    this.name = "HoldingNotFoundError";
  }
}
