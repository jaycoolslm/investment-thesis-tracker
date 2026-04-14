import { EventEmitter } from "events";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { holdings, theses, thesisPillars, documents } from "../db/schema.js";
import { ThesisAgent } from "../agent/codex-agent.js";
import { type ThesisOutput } from "../agent/schemas.js";

export type GenerationStep =
  | "generation_started"
  | "searching_market_data"
  | "analysing_broker_research"
  | "building_thesis_pillars"
  | "compiling_document"
  | "generation_complete"
  | "generation_failed";

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

    this.emit("progress", "generation_started" satisfies GenerationStep);

    // 2. Fetch uploaded documents
    const docs = await db
      .select()
      .from(documents)
      .where(eq(documents.holdingId, holdingId));
    const filePaths = docs.map((d) => d.filePath);

    this.emit("progress", "searching_market_data" satisfies GenerationStep);

    if (filePaths.length > 0) {
      this.emit(
        "progress",
        "analysing_broker_research" satisfies GenerationStep,
      );
    }

    // 3. Call agent with 60s timeout
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
      );
    } catch (err) {
      this.emit("progress", "generation_failed" satisfies GenerationStep);
      throw err;
    }

    this.emit("progress", "building_thesis_pillars" satisfies GenerationStep);

    // 4. Persist in transaction
    const thesisId = await this.persistThesis(holdingId, result);

    this.emit("progress", "compiling_document" satisfies GenerationStep);
    this.emit("progress", "generation_complete" satisfies GenerationStep);

    return thesisId;
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
