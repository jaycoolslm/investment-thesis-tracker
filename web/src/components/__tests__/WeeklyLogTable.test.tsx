import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WeeklyLogTable } from "../thesis/WeeklyLogTable.tsx";
import type { WeeklyLog } from "../../api/client.ts";

// Mock the hooks
const mockMutate = vi.fn();
const mockTrigger = {
  mutate: mockMutate,
  isPending: false,
};

vi.mock("../../hooks/useWeeklyMonitoring.ts", () => ({
  useTriggerWeeklyMonitoring: () => mockTrigger,
}));

const mockAddToast = vi.fn();
vi.mock("../../hooks/useToast.ts", () => ({
  useToast: () => ({ toasts: [], addToast: mockAddToast, removeToast: vi.fn() }),
}));

function createLog(overrides: Partial<WeeklyLog> = {}): WeeklyLog {
  return {
    id: "log-1",
    holdingId: "h-1",
    weekLabel: "2026-W16",
    weekDate: "2026-04-13",
    priceChangePct: "3.20",
    indexChangePct: "1.10",
    relativePerf: "2.10",
    thesisImpact: "strengthened",
    summary: "Strong earnings beat expectations.",
    sources: null,
    createdAt: "2026-04-17T00:00:00Z",
    ...overrides,
  };
}

function renderTable(
  props: Partial<{
    logs: WeeklyLog[];
    holdingId: string;
    hasThesis: boolean;
  }> = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <WeeklyLogTable
        logs={props.logs ?? []}
        holdingId={props.holdingId ?? "h-1"}
        hasThesis={props.hasThesis ?? true}
      />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockTrigger.isPending = false;
});

describe("WeeklyLogTable", () => {
  it("renders empty state when logs=[] and hasThesis=true", () => {
    renderTable({ logs: [], hasThesis: true });

    expect(
      screen.getByText(/no weekly logs yet/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/run a weekly check to analyse/i),
    ).toBeInTheDocument();
  });

  it("renders different empty state when hasThesis=false", () => {
    renderTable({ logs: [], hasThesis: false });

    expect(
      screen.getByText(/generate a thesis first/i),
    ).toBeInTheDocument();
  });

  it("renders Run Weekly Check button when hasThesis=true", () => {
    renderTable({ hasThesis: true });

    const button = screen.getByRole("button", { name: /run weekly check/i });
    expect(button).toBeInTheDocument();
    expect(button).toBeEnabled();
  });

  it("disables trigger button when hasThesis=false", () => {
    renderTable({ hasThesis: false });

    const button = screen.getByRole("button", { name: /run weekly check/i });
    expect(button).toBeDisabled();
  });

  it("shows Analysing... state when trigger is pending", () => {
    mockTrigger.isPending = true;

    renderTable({ hasThesis: true });

    const button = screen.getByRole("button", { name: /analysing/i });
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("Analysing...");
  });

  it("calls mutate on button click", async () => {
    const user = userEvent.setup();
    renderTable({ hasThesis: true });

    const button = screen.getByRole("button", { name: /run weekly check/i });
    await user.click(button);

    expect(mockMutate).toHaveBeenCalledOnce();
  });

  it("shows error toast on mutation failure", async () => {
    const user = userEvent.setup();

    // Make mutate invoke the onError callback
    mockMutate.mockImplementation((_data: unknown, options: { onError?: (err: Error) => void }) => {
      options?.onError?.(new Error("LLM unavailable"));
    });

    renderTable({ hasThesis: true });

    const button = screen.getByRole("button", { name: /run weekly check/i });
    await user.click(button);

    expect(mockAddToast).toHaveBeenCalledWith("LLM unavailable", "error");
  });

  it("renders log rows with correct data", () => {
    const logs = [
      createLog({
        id: "log-1",
        weekLabel: "2026-W16",
        priceChangePct: "3.20",
        indexChangePct: "1.10",
        relativePerf: "2.10",
        thesisImpact: "strengthened",
        summary: "Strong quarter.",
      }),
      createLog({
        id: "log-2",
        weekLabel: "2026-W15",
        priceChangePct: "-2.50",
        indexChangePct: "0.80",
        relativePerf: "-3.30",
        thesisImpact: "weakened",
        summary: "Missed estimates.",
      }),
    ];

    renderTable({ logs });

    // Week labels rendered
    expect(screen.getByText("2026-W16")).toBeInTheDocument();
    expect(screen.getByText("2026-W15")).toBeInTheDocument();

    // Impact badges
    expect(screen.getByText("Strengthened")).toBeInTheDocument();
    expect(screen.getByText("Weakened")).toBeInTheDocument();

    // Summaries
    expect(screen.getByText("Strong quarter.")).toBeInTheDocument();
    expect(screen.getByText("Missed estimates.")).toBeInTheDocument();

    // Price formatting (+/- with %)
    expect(screen.getByText("+3.20%")).toBeInTheDocument();
    expect(screen.getByText("-2.50%")).toBeInTheDocument();
  });
});
