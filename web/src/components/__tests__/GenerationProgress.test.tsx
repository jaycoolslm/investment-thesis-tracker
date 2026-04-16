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

  it("shows starting state when no events received", () => {
    render(<GenerationProgress {...defaultProps} />);
    expect(screen.getByText("Starting up...")).toBeInTheDocument();
  });

  it("shows timing guidance", () => {
    render(<GenerationProgress {...defaultProps} />);
    expect(
      screen.getByText("This typically takes 30-60 seconds."),
    ).toBeInTheDocument();
  });

  it("has an activity feed region", () => {
    render(<GenerationProgress {...defaultProps} />);
    expect(screen.getByRole("list", { name: /agent activity/i })).toBeInTheDocument();
  });

  it("renders spinner while generating", () => {
    const { container } = render(<GenerationProgress {...defaultProps} />);
    expect(container.querySelector(".animate-spin")).not.toBeNull();
  });
});
