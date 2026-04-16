import { Codex, type ThreadEvent } from "@openai/codex-sdk";
import * as z from "zod";
import {
  thesisOutputSchema,
  type ThesisOutput,
  type WeeklyLogOutput,
} from "./schemas.js";
import { buildGenerationPrompt, type GenerationInput } from "./prompts.js";
import { config } from "../config.js";

export class ThesisAgent {
  private codex: Codex;

  constructor(codex?: Codex) {
    this.codex =
      codex ??
      new Codex(
        config.AZURE_OPENAI_ENDPOINT
          ? {
            config: {
              model: "gpt-5.4-mini",
              model_provider: "azure",
              model_providers: {
                azure: {
                  name: "Azure",
                  base_url: config.AZURE_OPENAI_ENDPOINT,
                  wire_api: "responses",
                  query_params: { "api-version": "2025-04-01-preview" },
                  env_key: "AZURE_OPENAI_API_KEY",
                },
              },
            },
            env: {
              AZURE_OPENAI_API_KEY: config.AZURE_OPENAI_API_KEY ?? "",
            },
          }
          : {
            apiKey: config.OPENAI_API_KEY,
          },
      );
  }

  async generateThesis(
    input: GenerationInput,
    signal?: AbortSignal,
    onEvent?: (event: ThreadEvent) => void,
  ): Promise<ThesisOutput> {
    const thread = this.codex.startThread({
      workingDirectory: process.cwd(),
      additionalDirectories:
        input.researchFilePaths.length > 0 ? ["/data/documents"] : [],
      sandboxMode: "read-only",
      webSearchMode: "live",
      networkAccessEnabled: true,
      approvalPolicy: "never",
      modelReasoningEffort: "low", // TODO: bump to high for production
      skipGitRepoCheck: true,
    });

    const prompt = buildGenerationPrompt(input);
    const jsonSchema = z.toJSONSchema(thesisOutputSchema);

    const { events } = await thread.runStreamed(prompt, {
      outputSchema: jsonSchema,
      signal,
    });

    let finalText = "";
    for await (const event of events) {
      onEvent?.(event);
      if (
        event.type === "item.completed" &&
        event.item.type === "agent_message"
      ) {
        finalText = event.item.text;
      }
      if (event.type === "turn.failed") {
        throw new Error(event.error.message);
      }
    }

    return thesisOutputSchema.parse(JSON.parse(finalText));
  }

  /**
   * Analyse a holding's weekly news, price action, and broker research
   * against its thesis pillars and assumptions. Phase 2 implementation.
   */
  async analyseWeekly(
    _holdingId: string,
    _thesisId: string,
    _signal?: AbortSignal,
  ): Promise<WeeklyLogOutput> {
    throw new Error("Not implemented — Phase 2");
  }
}
