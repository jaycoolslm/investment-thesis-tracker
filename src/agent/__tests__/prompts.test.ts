import { describe, it, expect } from "vitest";
import { buildGenerationPrompt } from "../prompts.js";
import { VALID_GENERATION_INPUT, GENERATION_INPUT_WITH_FILES } from "./fixtures.js";

describe("buildGenerationPrompt", () => {
  it("includes ticker and company name", () => {
    const prompt = buildGenerationPrompt(VALID_GENERATION_INPUT);
    expect(prompt).toContain("AAPL");
    expect(prompt).toContain("Apple Inc.");
  });

  it("includes direction as LONG or SHORT", () => {
    const longPrompt = buildGenerationPrompt(VALID_GENERATION_INPUT);
    expect(longPrompt).toContain("LONG (bullish)");

    const shortPrompt = buildGenerationPrompt({
      ...VALID_GENERATION_INPUT,
      direction: "short",
    });
    expect(shortPrompt).toContain("SHORT (bearish)");
  });

  it("includes benchmark index", () => {
    const prompt = buildGenerationPrompt(VALID_GENERATION_INPUT);
    expect(prompt).toContain("S&P 500");
  });

  it("includes analyst bullets", () => {
    const prompt = buildGenerationPrompt(VALID_GENERATION_INPUT);
    expect(prompt).toContain("Strong services growth");
    expect(prompt).toContain("Pricing power");
  });

  it("instructs web search for financials", () => {
    const prompt = buildGenerationPrompt(VALID_GENERATION_INPUT);
    expect(prompt).toContain("Search the web");
    expect(prompt).toContain("financial");
  });

  it("omits broker research section when no files", () => {
    const prompt = buildGenerationPrompt(VALID_GENERATION_INPUT);
    expect(prompt).not.toContain("BROKER RESEARCH FILES");
  });

  it("includes broker research section with file paths", () => {
    const prompt = buildGenerationPrompt(GENERATION_INPUT_WITH_FILES);
    expect(prompt).toContain("BROKER RESEARCH FILES");
    expect(prompt).toContain("shell-broker-report.pdf");
    expect(prompt).toContain("shell-earnings-q4.docx");
  });
});
