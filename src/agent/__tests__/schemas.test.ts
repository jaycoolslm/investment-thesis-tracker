import { describe, it, expect } from "vitest";
import {
  thesisOutputSchema,
  weeklyLogOutputSchema,
  sourceSchema,
} from "../schemas.js";
import { VALID_THESIS_FIXTURE, VALID_WEEKLY_LOG_FIXTURE } from "./fixtures.js";

describe("sourceSchema", () => {
  it("accepts a full source", () => {
    const result = sourceSchema.safeParse({
      title: "Q1 filing",
      url: "https://example.com",
      type: "filing",
    });
    expect(result.success).toBe(true);
  });

  it("accepts null url and type", () => {
    const result = sourceSchema.safeParse({
      title: "Analyst note",
      url: null,
      type: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty title", () => {
    const result = sourceSchema.safeParse({ title: "", url: null, type: null });
    expect(result.success).toBe(false);
  });

  it("rejects invalid type value", () => {
    const result = sourceSchema.safeParse({
      title: "X",
      url: null,
      type: "blog",
    });
    expect(result.success).toBe(false);
  });
});

describe("thesisOutputSchema", () => {
  it("accepts a valid markdown thesis", () => {
    const result = thesisOutputSchema.safeParse(VALID_THESIS_FIXTURE);
    expect(result.success).toBe(true);
  });

  it("rejects content shorter than 200 characters", () => {
    const result = thesisOutputSchema.safeParse({
      ...VALID_THESIS_FIXTURE,
      content: "## Summary\n\nToo short.",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing content", () => {
    const { content: _content, ...noContent } = VALID_THESIS_FIXTURE;
    const result = thesisOutputSchema.safeParse(noContent);
    expect(result.success).toBe(false);
  });

  it("rejects empty sources array", () => {
    const result = thesisOutputSchema.safeParse({
      ...VALID_THESIS_FIXTURE,
      sources: [],
    });
    expect(result.success).toBe(false);
  });

  it("accepts sources with null url and type", () => {
    const result = thesisOutputSchema.safeParse({
      ...VALID_THESIS_FIXTURE,
      sources: [
        { title: "Analyst report on sector trends", url: null, type: null },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe("weeklyLogOutputSchema", () => {
  it("accepts a valid weekly log", () => {
    const result = weeklyLogOutputSchema.safeParse(VALID_WEEKLY_LOG_FIXTURE);
    expect(result.success).toBe(true);
  });

  it("rejects an invalid thesisImpact", () => {
    const result = weeklyLogOutputSchema.safeParse({
      ...VALID_WEEKLY_LOG_FIXTURE,
      thesisImpact: "bad",
    });
    expect(result.success).toBe(false);
  });

  it("accepts null price fields", () => {
    const result = weeklyLogOutputSchema.safeParse({
      ...VALID_WEEKLY_LOG_FIXTURE,
      priceChangePct: null,
      indexChangePct: null,
      relativePerf: null,
    });
    expect(result.success).toBe(true);
  });
});
