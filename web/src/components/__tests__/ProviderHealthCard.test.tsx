import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProviderHealthCard } from "../ProviderHealthCard.tsx";
import { getProviderHealth, type ProviderHealth } from "../../api/client.ts";

vi.mock("../../api/client.ts", () => ({
  getProviderHealth: vi.fn(),
}));

const mockedHealth = vi.mocked(getProviderHealth);

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

const healthPayload: ProviderHealth = {
  status: "ok",
  articleCount: 145,
  bodyCount: 12,
  sources: [
    {
      source: "ft",
      lastRun: {
        id: 7,
        source: "ft",
        startedAt: "2026-07-18T06:00:01.000Z",
        finishedAt: "2026-07-18T06:03:22.000Z",
        articlesSeen: 140,
        articlesNew: 9,
        error: null,
      },
    },
  ],
};

describe("ProviderHealthCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders crawl stats when the proxy returns health data", async () => {
    mockedHealth.mockResolvedValue(healthPayload);

    renderWithClient(<ProviderHealthCard />);

    expect(await screen.findByText("Data Provider")).toBeInTheDocument();
    expect(screen.getByText("Healthy")).toBeInTheDocument();
    // New-article count and total article count from lastRun/health
    expect(screen.getByText("9")).toBeInTheDocument();
    expect(screen.getByText("145")).toBeInTheDocument();
  });

  it("hides the card entirely when the provider is not configured", async () => {
    mockedHealth.mockResolvedValue(null);

    const { container } = renderWithClient(<ProviderHealthCard />);

    // Give the query a tick to resolve, then assert nothing rendered.
    await Promise.resolve();
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText("Data Provider")).not.toBeInTheDocument();
  });

  it("shows an error state when the provider is unreachable", async () => {
    mockedHealth.mockRejectedValue(new Error("Data provider unreachable"));

    renderWithClient(<ProviderHealthCard />);

    expect(await screen.findByText("Unreachable")).toBeInTheDocument();
  });

  it("surfaces a crawl error reported by the provider", async () => {
    mockedHealth.mockResolvedValue({
      ...healthPayload,
      sources: [
        {
          source: "ft",
          lastRun: {
            ...healthPayload.sources[0].lastRun!,
            error: "FT cookie expired",
          },
        },
      ],
    });

    renderWithClient(<ProviderHealthCard />);

    expect(await screen.findByText("Crawl error")).toBeInTheDocument();
    expect(screen.getByText("FT cookie expired")).toBeInTheDocument();
  });
});
