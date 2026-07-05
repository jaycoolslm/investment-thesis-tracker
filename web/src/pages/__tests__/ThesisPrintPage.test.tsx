import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router";
import { ThesisPrintPage } from "../ThesisPrintPage.tsx";
import type { Thesis, Holding, WeeklyLog } from "../../api/client.ts";

// window.print is not implemented in jsdom
const printSpy = vi.fn();
vi.stubGlobal("print", printSpy);

let thesisData: Thesis | undefined;
let holdingData: Holding | undefined;
let logsData: WeeklyLog[];
let loading = false;

vi.mock("../../hooks/useThesis.ts", () => ({
  useThesis: () => ({ data: thesisData, isLoading: loading }),
  useHolding: () => ({ data: holdingData, isLoading: loading }),
}));

vi.mock("../../hooks/useWeeklyLogs.ts", () => ({
  useWeeklyLogs: () => ({ data: logsData, isLoading: loading }),
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/holdings/h-1/print"]}>
      <Routes>
        <Route path="holdings/:holdingId/print" element={<ThesisPrintPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

const holding: Holding = {
  id: "h-1",
  ticker: "AAPL",
  companyName: "Apple Inc.",
  direction: "long",
  benchmark: "S&P 500",
  status: "active",
  latestImpact: null,
  lastUpdated: null,
  createdAt: "2026-04-01T00:00:00Z",
};

const thesis: Thesis = {
  id: "t-1",
  holdingId: "h-1",
  content: `## Summary

Strong compounder.

## Thesis Pillars

### Ecosystem lock-in

Sticky.`,
  // Legacy stored sources may still carry a `type` field — must render fine
  sources: [
    { title: "Q1 filing", url: "https://ex.com", type: "filing" },
  ] as unknown as Thesis["sources"],
  createdAt: "2026-04-02T00:00:00Z",
  updatedAt: "2026-04-02T00:00:00Z",
};

const log: WeeklyLog = {
  id: "log-1",
  holdingId: "h-1",
  weekLabel: "2026-W16",
  weekDate: "2026-04-13",
  priceChangePct: "3.20",
  indexChangePct: "1.10",
  relativePerf: "2.10",
  thesisImpact: "strengthened",
  summary: "Earnings beat.",
  sources: null,
  createdAt: "2026-04-17T00:00:00Z",
};

beforeEach(() => {
  printSpy.mockClear();
  loading = false;
  thesisData = thesis;
  holdingData = holding;
  logsData = [log];
});

describe("ThesisPrintPage", () => {
  it("renders the markdown thesis, sources, and weekly log from mocked query data", () => {
    renderPage();

    const heading = (name: string) =>
      screen.getByRole("heading", { name });
    expect(heading("AAPL")).toBeInTheDocument();
    expect(screen.getByText("Apple Inc.")).toBeInTheDocument();
    // Section wrapper headings
    expect(heading("Thesis")).toBeInTheDocument();
    expect(heading("Sources")).toBeInTheDocument();
    expect(heading("Weekly Log")).toBeInTheDocument();
    // Markdown rendered as real headings, never raw "##"
    expect(heading("Summary")).toBeInTheDocument();
    expect(heading("Ecosystem lock-in")).toBeInTheDocument();
    expect(screen.getByText("Strong compounder.")).toBeInTheDocument();
    expect(screen.queryByText(/##/)).not.toBeInTheDocument();
    // Sources + weekly log
    expect(screen.getByText("Q1 filing")).toBeInTheDocument();
    expect(screen.getByText("Earnings beat.")).toBeInTheDocument();
  });

  it("calls window.print once data has loaded", () => {
    renderPage();
    expect(printSpy).toHaveBeenCalled();
  });

  it("shows a no-thesis message rather than crashing when there is no thesis", () => {
    thesisData = undefined;
    renderPage();
    expect(
      screen.getByText(/No thesis exists for this holding yet/i),
    ).toBeInTheDocument();
    expect(printSpy).not.toHaveBeenCalled();
  });
});
