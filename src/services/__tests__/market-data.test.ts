import { describe, it, expect, vi, beforeEach } from "vitest";

const mockChart = vi.fn();

vi.mock("yahoo-finance2", () => ({
  default: class MockYahooFinance {
    chart(...args: unknown[]) {
      return mockChart(...args);
    }
  },
}));

const { MarketDataService } = await import("../market-data.js");

describe("MarketDataService", () => {
  let service: InstanceType<typeof MarketDataService>;
  const weekEndDate = new Date("2026-05-22"); // a Friday

  beforeEach(() => {
    vi.clearAllMocks();
    service = new MarketDataService();
  });

  describe("getWeeklyReturn", () => {
    it("calculates correct percentage change from two closes", async () => {
      mockChart.mockResolvedValueOnce({
        quotes: [
          { date: new Date("2026-05-15"), close: 150 },
          { date: new Date("2026-05-16"), close: 152 },
          { date: new Date("2026-05-19"), close: 153 },
          { date: new Date("2026-05-20"), close: 155 },
          { date: new Date("2026-05-22"), close: 157.5 },
        ],
        meta: { currency: "USD" },
      });

      const result = await service.getWeeklyReturn("AAPL", weekEndDate);

      expect(result).not.toBeNull();
      expect(result!.priceChangePct).toBe(5);
      expect(result!.currentPrice).toBe(157.5);
      expect(result!.previousPrice).toBe(150);
      expect(result!.currency).toBe("USD");
    });

    it("returns null when chart throws (network error)", async () => {
      mockChart.mockRejectedValueOnce(new Error("Network timeout"));

      const result = await service.getWeeklyReturn("AAPL", weekEndDate);

      expect(result).toBeNull();
    });

    it("returns null when fewer than 2 data points", async () => {
      mockChart.mockResolvedValueOnce({
        quotes: [{ date: new Date("2026-05-22"), close: 157.5 }],
        meta: { currency: "USD" },
      });

      const result = await service.getWeeklyReturn("AAPL", weekEndDate);

      expect(result).toBeNull();
    });

    it("filters out quotes with null close", async () => {
      mockChart.mockResolvedValueOnce({
        quotes: [
          { date: new Date("2026-05-15"), close: null },
          { date: new Date("2026-05-16"), close: 150 },
          { date: new Date("2026-05-22"), close: 153 },
        ],
        meta: { currency: "USD" },
      });

      const result = await service.getWeeklyReturn("AAPL", weekEndDate);

      expect(result).not.toBeNull();
      expect(result!.previousPrice).toBe(150);
      expect(result!.currentPrice).toBe(153);
    });

    it("handles negative price change", async () => {
      mockChart.mockResolvedValueOnce({
        quotes: [
          { date: new Date("2026-05-15"), close: 200 },
          { date: new Date("2026-05-22"), close: 190 },
        ],
        meta: { currency: "GBp" },
      });

      const result = await service.getWeeklyReturn("SHEL.L", weekEndDate);

      expect(result).not.toBeNull();
      expect(result!.priceChangePct).toBe(-5);
      expect(result!.currency).toBe("GBp");
    });
  });

  describe("getIndexWeeklyReturn", () => {
    it("maps S&P 500 to ^GSPC", async () => {
      mockChart.mockResolvedValueOnce({
        quotes: [
          { date: new Date("2026-05-15"), close: 5000 },
          { date: new Date("2026-05-22"), close: 5050 },
        ],
        meta: { currency: "USD" },
      });

      await service.getIndexWeeklyReturn("S&P 500", weekEndDate);

      expect(mockChart).toHaveBeenCalledWith(
        "^GSPC",
        expect.any(Object),
      );
    });

    it("maps FTSE 100 to ^FTSE", async () => {
      mockChart.mockResolvedValueOnce({
        quotes: [
          { date: new Date("2026-05-15"), close: 8000 },
          { date: new Date("2026-05-22"), close: 8100 },
        ],
        meta: { currency: "GBP" },
      });

      await service.getIndexWeeklyReturn("FTSE 100", weekEndDate);

      expect(mockChart).toHaveBeenCalledWith("^FTSE", expect.any(Object));
    });

    it("maps Nikkei 225 to ^N225", async () => {
      mockChart.mockResolvedValueOnce({
        quotes: [
          { date: new Date("2026-05-15"), close: 38000 },
          { date: new Date("2026-05-22"), close: 38500 },
        ],
        meta: { currency: "JPY" },
      });

      await service.getIndexWeeklyReturn("Nikkei 225", weekEndDate);

      expect(mockChart).toHaveBeenCalledWith("^N225", expect.any(Object));
    });

    it("returns null for unrecognised benchmark", async () => {
      const result = await service.getIndexWeeklyReturn(
        "Unknown Index",
        weekEndDate,
      );

      expect(result).toBeNull();
      expect(mockChart).not.toHaveBeenCalled();
    });

    it("maps all 9 global benchmarks", async () => {
      const benchmarks = [
        ["S&P 500", "^GSPC"],
        ["NASDAQ Composite", "^IXIC"],
        ["Dow Jones", "^DJI"],
        ["Russell 2000", "^RUT"],
        ["FTSE 100", "^FTSE"],
        ["Euro Stoxx 50", "^STOXX50E"],
        ["Nikkei 225", "^N225"],
        ["Hang Seng", "^HSI"],
        ["ASX 200", "^AXJO"],
      ] as const;

      for (const [name, symbol] of benchmarks) {
        mockChart.mockResolvedValueOnce({
          quotes: [
            { date: new Date("2026-05-15"), close: 100 },
            { date: new Date("2026-05-22"), close: 101 },
          ],
          meta: { currency: "USD" },
        });

        await service.getIndexWeeklyReturn(name, weekEndDate);

        expect(mockChart).toHaveBeenLastCalledWith(
          symbol,
          expect.any(Object),
        );
      }
    });
  });
});
