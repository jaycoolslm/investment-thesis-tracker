import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GenerationProgress } from "../GenerationProgress.tsx";
import { generateThesis, getGenerationStatus } from "../../api/client.ts";

// Mock the API layer — the hook fires generateThesis and polls getGenerationStatus
vi.mock("../../api/client.ts", () => ({
  generateThesis: vi.fn().mockResolvedValue({ thesisId: "test" }),
  getGenerationStatus: vi.fn().mockResolvedValue({
    status: "running",
    startedAt: new Date().toISOString(),
    events: [],
  }),
}));

const mockedStatus = vi.mocked(getGenerationStatus);
const mockedGenerate = vi.mocked(generateThesis);

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

describe("GenerationProgress", () => {
  const defaultProps = {
    holdingId: "test-id",
    ticker: "AAPL",
    bullets: "Strong growth",
    onComplete: vi.fn(),
    onRetry: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockedGenerate.mockResolvedValue({ thesisId: "test" });
    mockedStatus.mockResolvedValue({
      status: "running",
      startedAt: new Date().toISOString(),
      events: [],
    });
  });

  it("renders ticker in title", () => {
    renderWithClient(<GenerationProgress {...defaultProps} />);
    expect(
      screen.getByText("Generating thesis for AAPL"),
    ).toBeInTheDocument();
  });

  it("shows starting state when no events received", () => {
    renderWithClient(<GenerationProgress {...defaultProps} />);
    expect(screen.getByText("Starting up...")).toBeInTheDocument();
  });

  it("shows timing guidance", () => {
    renderWithClient(<GenerationProgress {...defaultProps} />);
    expect(
      screen.getByText("This typically takes 30-60 seconds."),
    ).toBeInTheDocument();
  });

  it("has an activity feed region", () => {
    renderWithClient(<GenerationProgress {...defaultProps} />);
    expect(
      screen.getByRole("list", { name: /agent activity/i }),
    ).toBeInTheDocument();
  });

  it("renders spinner while generating", () => {
    const { container } = renderWithClient(
      <GenerationProgress {...defaultProps} />,
    );
    expect(container.querySelector(".animate-spin")).not.toBeNull();
  });

  it("fires the generation request on mount", async () => {
    renderWithClient(<GenerationProgress {...defaultProps} />);
    expect(mockedGenerate).toHaveBeenCalledWith("test-id", "Strong growth");
  });

  it("does not re-trigger generation when resuming after a reload", () => {
    renderWithClient(<GenerationProgress {...defaultProps} resume />);
    expect(mockedGenerate).not.toHaveBeenCalled();
  });

  it("renders polled activity lines in the feed", async () => {
    mockedStatus.mockResolvedValue({
      status: "running",
      startedAt: new Date().toISOString(),
      events: ['Searching: "AAPL earnings"', "Compiling thesis..."],
    });

    renderWithClient(<GenerationProgress {...defaultProps} />);

    expect(
      await screen.findByText('Searching: "AAPL earnings"'),
    ).toBeInTheDocument();
    expect(screen.getByText("Compiling thesis...")).toBeInTheDocument();
  });

  it("shows completed state and calls onComplete when polling reports complete", async () => {
    vi.useFakeTimers();
    try {
      mockedStatus.mockResolvedValue({
        status: "complete",
        startedAt: new Date().toISOString(),
        events: [],
      });
      const onComplete = vi.fn();

      renderWithClient(
        <GenerationProgress {...defaultProps} onComplete={onComplete} />,
      );

      // Let the initial fetch resolve, then the 500ms completion delay elapse
      await vi.waitFor(() => {
        expect(screen.getByText("Thesis ready for AAPL")).toBeInTheDocument();
      });
      await vi.advanceTimersByTimeAsync(600);
      expect(onComplete).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows error state with retry when polling reports failure", async () => {
    mockedStatus.mockResolvedValue({
      status: "failed",
      startedAt: new Date().toISOString(),
      events: [],
      error: "Rate limited",
    });

    renderWithClient(<GenerationProgress {...defaultProps} />);

    expect(await screen.findByText("Generation failed")).toBeInTheDocument();
    expect(screen.getByText("Rate limited")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /try again/i }),
    ).toBeInTheDocument();
  });

  it("calls onStale when a resumed generation is no longer tracked", async () => {
    mockedStatus.mockResolvedValue(null);
    const onStale = vi.fn();

    renderWithClient(
      <GenerationProgress {...defaultProps} resume onStale={onStale} />,
    );

    await vi.waitFor(() => expect(onStale).toHaveBeenCalled());
  });
});
