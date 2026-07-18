import { describe, it, expect } from "vitest";
import { buildGenerationPrompt, buildWeeklyPrompt } from "../prompts.js";
import {
  VALID_GENERATION_INPUT,
  GENERATION_INPUT_WITH_FILES,
  VALID_WEEKLY_ANALYSIS_INPUT,
} from "./fixtures.js";

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

  it("omits context documents section when no files", () => {
    const prompt = buildGenerationPrompt(VALID_GENERATION_INPUT);
    expect(prompt).not.toContain("CONTEXT DOCUMENTS");
  });

  it("includes context documents section with file paths", () => {
    const prompt = buildGenerationPrompt(GENERATION_INPUT_WITH_FILES);
    expect(prompt).toContain("CONTEXT DOCUMENTS");
    expect(prompt).toContain("shell-broker-report.pdf");
    expect(prompt).toContain("shell-earnings-q4.docx");
  });

  it("explains the article__*.md news-article convention", () => {
    const prompt = buildGenerationPrompt(GENERATION_INPUT_WITH_FILES);
    expect(prompt).toContain("article__*.md");
    expect(prompt).toContain("rationale");
  });
});

describe("buildWeeklyPrompt", () => {
  it("omits context documents section when no files", () => {
    const prompt = buildWeeklyPrompt(VALID_WEEKLY_ANALYSIS_INPUT);
    expect(prompt).not.toContain("CONTEXT DOCUMENTS");
  });

  it("lists document file paths under the context documents heading", () => {
    const articlePath =
      "/data/documents/abc-123/article__ft__478fe638-84d5-4eab-a2c5-5b43ec106bdf.md";
    const prompt = buildWeeklyPrompt({
      ...VALID_WEEKLY_ANALYSIS_INPUT,
      researchFilePaths: [articlePath],
    });
    expect(prompt).toContain("CONTEXT DOCUMENTS");
    expect(prompt).toContain(articlePath);
  });

  it("explains the article__*.md news-article convention", () => {
    const prompt = buildWeeklyPrompt({
      ...VALID_WEEKLY_ANALYSIS_INPUT,
      researchFilePaths: ["/data/documents/abc/article__ft__x.md"],
    });
    expect(prompt).toContain("article__*.md");
    expect(prompt).toContain("rationale");
  });
});
