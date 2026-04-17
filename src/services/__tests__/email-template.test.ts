import { describe, it, expect } from "vitest";
import {
  buildDigestHtml,
  buildDigestSubject,
  type DigestData,
} from "../email-template.js";

const baseData: DigestData = {
  weekDate: "2026-04-13",
  total: 3,
  strengthened: 1,
  weakened: 1,
  unchanged: 1,
  holdings: [
    {
      holdingId: "aaa-111",
      ticker: "AAPL",
      companyName: "Apple Inc.",
      priceChangePct: "2.50",
      indexChangePct: "0.80",
      thesisImpact: "strengthened",
      summary: "Strong iPhone 16 demand and services revenue beat.",
    },
    {
      holdingId: "bbb-222",
      ticker: "TSLA",
      companyName: "Tesla Inc.",
      priceChangePct: "-3.20",
      indexChangePct: "0.80",
      thesisImpact: "weakened",
      summary: "Delivery miss and margin compression concerns.",
    },
    {
      holdingId: "ccc-333",
      ticker: "MSFT",
      companyName: "Microsoft Corp.",
      priceChangePct: "0.10",
      indexChangePct: "0.80",
      thesisImpact: "unchanged",
      summary: "Azure growth steady, no thesis-altering developments.",
    },
  ],
  appUrl: "http://localhost:5173",
};

describe("buildDigestSubject", () => {
  it("formats the week date into the subject line", () => {
    const subject = buildDigestSubject("2026-04-13");
    expect(subject).toContain("Weekly Thesis Update");
    expect(subject).toContain("2026");
  });
});

describe("buildDigestHtml", () => {
  it("contains the summary counts", () => {
    const html = buildDigestHtml(baseData);
    expect(html).toContain("3 holdings monitored");
    expect(html).toContain("1 strengthened");
    expect(html).toContain("1 weakened");
    expect(html).toContain("1 unchanged");
  });

  it("contains all holding tickers", () => {
    const html = buildDigestHtml(baseData);
    expect(html).toContain("AAPL");
    expect(html).toContain("TSLA");
    expect(html).toContain("MSFT");
  });

  it("links tickers to the app", () => {
    const html = buildDigestHtml(baseData);
    expect(html).toContain("http://localhost:5173/holdings/aaa-111");
    expect(html).toContain("http://localhost:5173/holdings/bbb-222");
  });

  it("color-codes positive and negative price changes", () => {
    const html = buildDigestHtml(baseData);
    // Green for positive
    expect(html).toContain("+2.50%");
    // Red for negative
    expect(html).toContain("-3.20%");
  });

  it("renders impact badges with correct colors", () => {
    const html = buildDigestHtml(baseData);
    // Strengthened green
    expect(html).toContain("#16a34a");
    // Weakened red
    expect(html).toContain("#dc2626");
  });

  it("truncates long summaries", () => {
    const longSummary = "A".repeat(200);
    const data = {
      ...baseData,
      holdings: [
        { ...baseData.holdings[0], summary: longSummary },
      ],
    };
    const html = buildDigestHtml(data);
    expect(html).toContain("...");
    expect(html).not.toContain(longSummary);
  });

  it("handles null values gracefully", () => {
    const data = {
      ...baseData,
      holdings: [
        {
          ...baseData.holdings[0],
          priceChangePct: null,
          indexChangePct: null,
          summary: null,
        },
      ],
    };
    const html = buildDigestHtml(data);
    // Should render em dashes for null values
    expect(html).toContain("\u2014");
  });
});
