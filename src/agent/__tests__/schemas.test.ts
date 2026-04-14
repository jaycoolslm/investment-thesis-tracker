import { describe, it, expect } from "vitest";
import {
  thesisOutputSchema,
  pillarSchema,
  riskSchema,
  sourceSchema,
  valuationSchema,
} from "../schemas.js";
import { VALID_THESIS_FIXTURE } from "./fixtures.js";

describe("pillarSchema", () => {
  it("accepts a valid pillar", () => {
    const result = pillarSchema.safeParse({
      title: "Strong moat",
      body: "The company has a defensible competitive position.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty title", () => {
    const result = pillarSchema.safeParse({ title: "", body: "Some body" });
    expect(result.success).toBe(false);
  });

  it("rejects empty body", () => {
    const result = pillarSchema.safeParse({ title: "Title", body: "" });
    expect(result.success).toBe(false);
  });
});

describe("riskSchema", () => {
  it("accepts valid risk with severity", () => {
    const result = riskSchema.safeParse({
      description: "Regulatory headwinds in EU",
      severity: "high",
    });
    expect(result.success).toBe(true);
  });

  it("rejects risk without severity", () => {
    const result = riskSchema.safeParse({
      description: "Some risk",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid severity value", () => {
    const result = riskSchema.safeParse({
      description: "Some risk",
      severity: "critical",
    });
    expect(result.success).toBe(false);
  });
});

describe("valuationSchema", () => {
  it("accepts full valuation", () => {
    const result = valuationSchema.safeParse({
      methodology: "DCF with 9.5% WACC",
      currentPrice: 232.5,
      upsideCase: "Target $280",
      baseCase: "Target $250",
      downsideCase: "Target $195",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valuation with null optional fields", () => {
    const result = valuationSchema.safeParse({
      methodology: "Relative P/E comparison",
      currentPrice: null,
      upsideCase: null,
      baseCase: null,
      downsideCase: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty methodology", () => {
    const result = valuationSchema.safeParse({ methodology: "" });
    expect(result.success).toBe(false);
  });
});

describe("thesisOutputSchema", () => {
  it("accepts a valid complete thesis", () => {
    const result = thesisOutputSchema.safeParse(VALID_THESIS_FIXTURE);
    expect(result.success).toBe(true);
  });

  it("rejects 0 pillars", () => {
    const result = thesisOutputSchema.safeParse({
      ...VALID_THESIS_FIXTURE,
      pillars: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects 1 pillar (minimum is 2)", () => {
    const result = thesisOutputSchema.safeParse({
      ...VALID_THESIS_FIXTURE,
      pillars: [VALID_THESIS_FIXTURE.pillars[0]],
    });
    expect(result.success).toBe(false);
  });

  it("accepts 2 pillars (minimum)", () => {
    const result = thesisOutputSchema.safeParse({
      ...VALID_THESIS_FIXTURE,
      pillars: VALID_THESIS_FIXTURE.pillars.slice(0, 2),
    });
    expect(result.success).toBe(true);
  });

  it("accepts 5 pillars (maximum)", () => {
    const fivePillars = [
      ...VALID_THESIS_FIXTURE.pillars,
      { title: "Pillar 4", body: "Evidence for pillar 4." },
      { title: "Pillar 5", body: "Evidence for pillar 5." },
    ];
    const result = thesisOutputSchema.safeParse({
      ...VALID_THESIS_FIXTURE,
      pillars: fivePillars,
    });
    expect(result.success).toBe(true);
  });

  it("rejects 6 pillars (over maximum)", () => {
    const sixPillars = [
      ...VALID_THESIS_FIXTURE.pillars,
      { title: "Pillar 4", body: "Body 4." },
      { title: "Pillar 5", body: "Body 5." },
      { title: "Pillar 6", body: "Body 6." },
    ];
    const result = thesisOutputSchema.safeParse({
      ...VALID_THESIS_FIXTURE,
      pillars: sixPillars,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing summary", () => {
    const { summary: _, ...noSummary } = VALID_THESIS_FIXTURE;
    const result = thesisOutputSchema.safeParse(noSummary);
    expect(result.success).toBe(false);
  });

  it("rejects summary shorter than 10 characters", () => {
    const result = thesisOutputSchema.safeParse({
      ...VALID_THESIS_FIXTURE,
      summary: "Too short",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty assumptions array", () => {
    const result = thesisOutputSchema.safeParse({
      ...VALID_THESIS_FIXTURE,
      assumptions: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty risks array", () => {
    const result = thesisOutputSchema.safeParse({
      ...VALID_THESIS_FIXTURE,
      risks: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty sources array", () => {
    const result = thesisOutputSchema.safeParse({
      ...VALID_THESIS_FIXTURE,
      sources: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects qualityAssessment shorter than 10 characters", () => {
    const result = thesisOutputSchema.safeParse({
      ...VALID_THESIS_FIXTURE,
      qualityAssessment: "Short",
    });
    expect(result.success).toBe(false);
  });

  it("accepts sources with null url and type", () => {
    const result = thesisOutputSchema.safeParse({
      ...VALID_THESIS_FIXTURE,
      sources: [{ title: "Analyst report on sector trends", url: null, type: null }],
    });
    expect(result.success).toBe(true);
  });
});
