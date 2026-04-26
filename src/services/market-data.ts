import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance();

const BENCHMARK_SYMBOLS: Record<string, string> = {
  "S&P 500": "^GSPC",
  "NASDAQ Composite": "^IXIC",
  "Dow Jones": "^DJI",
  "Russell 2000": "^RUT",
  "FTSE 100": "^FTSE",
  "Euro Stoxx 50": "^STOXX50E",
  "Nikkei 225": "^N225",
  "Hang Seng": "^HSI",
  "ASX 200": "^AXJO",
};

export interface MarketDataResult {
  priceChangePct: number;
  currentPrice: number;
  previousPrice: number;
  currency: string;
}

const IS_MOCK = process.env.MOCK_AGENT === "true";

export class MarketDataService {
  /**
   * Get the week-over-week return for a ticker.
   * Uses a 10-calendar-day window ending at weekEndDate to find two
   * business-day closes (handles market holidays).
   * Returns null if data is unavailable.
   */
  async getWeeklyReturn(
    ticker: string,
    weekEndDate: Date,
  ): Promise<MarketDataResult | null> {
    if (IS_MOCK) {
      return { priceChangePct: 2.5, currentPrice: 235.0, previousPrice: 229.3, currency: "USD" };
    }
    try {
      const period2 = new Date(weekEndDate);
      period2.setDate(period2.getDate() + 1); // yahoo end date is exclusive

      const period1 = new Date(weekEndDate);
      period1.setDate(period1.getDate() - 10);

      const result = await yahooFinance.chart(ticker, {
        period1,
        period2,
        interval: "1d",
      });

      const quotes = result.quotes.filter(
        (q) => q.close != null && q.close > 0,
      );

      if (quotes.length < 2) return null;

      const previousClose = quotes[0].close!;
      const currentClose = quotes[quotes.length - 1].close!;
      const priceChangePct =
        ((currentClose - previousClose) / previousClose) * 100;

      return {
        priceChangePct: Math.round(priceChangePct * 100) / 100,
        currentPrice: currentClose,
        previousPrice: previousClose,
        currency: result.meta.currency ?? "USD",
      };
    } catch {
      return null;
    }
  }

  /**
   * Get the week-over-week return for a benchmark index.
   * Maps human-readable benchmark names to Yahoo Finance symbols.
   * Returns null if the benchmark is unrecognised or data is unavailable.
   */
  async getIndexWeeklyReturn(
    benchmarkName: string,
    weekEndDate: Date,
  ): Promise<MarketDataResult | null> {
    if (IS_MOCK) {
      return { priceChangePct: 1.1, currentPrice: 5050, previousPrice: 4995, currency: "USD" };
    }

    const symbol = BENCHMARK_SYMBOLS[benchmarkName];
    if (!symbol) return null;
    return this.getWeeklyReturn(symbol, weekEndDate);
  }
}
