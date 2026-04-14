import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { GenerationProgress } from "../GenerationProgress.tsx";

// Mock EventSource
class MockEventSource {
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  close = vi.fn();
}

beforeEach(() => {
  vi.stubGlobal("EventSource", MockEventSource);
});

// Mock the generate API call
vi.mock("../../api/client.ts", () => ({
  generateThesis: vi.fn().mockResolvedValue({ thesisId: "test" }),
  getThesis: vi.fn(),
}));

describe("GenerationProgress", () => {
  const defaultProps = {
    holdingId: "test-id",
    ticker: "AAPL",
    bullets: "Strong growth",
    hasDocuments: false,
    onComplete: vi.fn(),
    onRetry: vi.fn(),
  };

  it("renders ticker in title", () => {
    render(<GenerationProgress {...defaultProps} />);
    expect(
      screen.getByText("Generating thesis for AAPL"),
    ).toBeInTheDocument();
  });

  it("renders progress steps", () => {
    render(<GenerationProgress {...defaultProps} />);
    expect(
      screen.getByText("Searching for latest market data..."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Building thesis pillars..."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Compiling thesis document..."),
    ).toBeInTheDocument();
  });

  it("shows broker research step when hasDocuments is true", () => {
    render(<GenerationProgress {...defaultProps} hasDocuments={true} />);
    expect(
      screen.getByText("Analysing broker research..."),
    ).toBeInTheDocument();
  });

  it("hides broker research step when hasDocuments is false", () => {
    render(<GenerationProgress {...defaultProps} hasDocuments={false} />);
    expect(
      screen.queryByText("Analysing broker research..."),
    ).not.toBeInTheDocument();
  });

  it("shows timing guidance", () => {
    render(<GenerationProgress {...defaultProps} />);
    expect(
      screen.getByText("This typically takes 30-60 seconds."),
    ).toBeInTheDocument();
  });
});
