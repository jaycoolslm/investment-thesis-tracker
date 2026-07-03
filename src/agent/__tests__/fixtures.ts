import type { ThesisOutput, WeeklyLogOutput } from "../schemas.js";
import type { GenerationInput, WeeklyAnalysisInput } from "../prompts.js";

export const VALID_THESIS_FIXTURE: ThesisOutput = {
  content: `## Summary

Apple demonstrates strong competitive positioning driven by its services ecosystem and installed base of over 2 billion active devices. The company's transition toward higher-margin services revenue provides a durable earnings growth trajectory, while disciplined capital allocation through buybacks enhances per-share economics.

## Thesis Pillars

### Services Revenue Flywheel

Apple's services segment grew 14% YoY to $24.2B in Q1 FY25, now representing 27% of total revenue. The installed base of 2.2B active devices creates a recurring revenue stream with 70%+ gross margins, significantly above the 36% hardware margin.

### Pricing Power and Brand Moat

Apple raised iPhone ASPs by 8% over the past two years with minimal volume impact. The ecosystem lock-in (iCloud, Apple Watch, AirPods) drives a switching cost moat that sustains premium pricing across product lines.

### Capital Return Program

Apple has returned $700B+ to shareholders since 2012 through buybacks and dividends. The company repurchased $25B in Q1 FY25 alone, reducing share count by ~3% annually and driving EPS growth above revenue growth.

## Quality Assessment

Financial Strength: ROIC of 58%, net cash position of $51B, FCF margin of 28%. Competitive Position: Dominant in premium smartphones (85% of industry profits), growing services moat. ESG: Carbon neutral since 2020 for corporate operations, supply chain target 2030.

## Valuation

DCF with terminal growth rate of 3%, WACC of 9.5%.

- **Upside case:** Services re-rate drives P/E to 35x — target $280 (+20%)
- **Base case:** Steady growth at current multiple — target $250 (+8%)
- **Downside case:** China weakness + regulatory headwinds — target $195 (-16%)

## Key Assumptions

- Services revenue grows >15% annually through FY27
- iPhone unit volumes remain flat to slightly positive
- Gross margin expands 50-100bps annually from services mix shift
- Share buyback program continues at $90B+ annually

## Risks

- **High:** EU Digital Markets Act forces sideloading and alternative payment systems, reducing App Store revenue by 10-15%
- **Medium:** China revenue declines accelerate due to Huawei competition and geopolitical tensions
- **Medium:** AI features fail to drive meaningful iPhone upgrade cycle in FY26`,
  sources: [
    {
      title: "Apple Q1 FY25 Earnings Release",
      url: "https://investor.apple.com/sec-filings",
      type: "filing",
    },
    {
      title: "Apple Services Revenue Analysis — Bloomberg Intelligence",
      url: null,
      type: "web",
    },
    {
      title: "EU Digital Markets Act Impact Assessment",
      url: "https://ec.europa.eu/digital-markets-act",
      type: "news",
    },
  ],
};

export const VALID_GENERATION_INPUT: GenerationInput = {
  ticker: "AAPL",
  companyName: "Apple Inc.",
  direction: "long",
  bullets:
    "Strong services growth — 14% YoY, now 27% of revenue\nPricing power — raised ASPs 8% with no volume loss\nMassive buyback program — $25B in Q1 alone",
  benchmarkIndex: "S&P 500",
  researchFilePaths: [],
};

export const GENERATION_INPUT_WITH_FILES: GenerationInput = {
  ticker: "SHEL.L",
  companyName: "Shell plc",
  direction: "long",
  bullets:
    "Transitioning to renewables while maintaining upstream cash flow\nStrong FCF yield of 10%+",
  benchmarkIndex: "FTSE 100",
  researchFilePaths: [
    "/data/documents/abc-123/shell-broker-report.pdf",
    "/data/documents/abc-123/shell-earnings-q4.docx",
  ],
};

// ── Weekly monitoring fixtures ────────────────────────────────────────

export const VALID_WEEKLY_LOG_FIXTURE: WeeklyLogOutput = {
  weekLabel: "2026-W21",
  weekDate: "2026-05-19",
  priceChangePct: 3.2,
  indexChangePct: 1.1,
  relativePerf: 2.1,
  thesisImpact: "strengthened",
  summary:
    "The Services Revenue Flywheel pillar strengthened: Q2 services revenue beat consensus by 8%, confirming the thesis. The key assumption of >15% services growth remains intact — services grew 16% YoY.",
  sources: [
    {
      title: "Apple Q2 FY26 Earnings Release",
      url: "https://investor.apple.com",
      type: "filing",
    },
  ],
};

export const VALID_WEEKLY_ANALYSIS_INPUT: WeeklyAnalysisInput = {
  ticker: "AAPL",
  companyName: "Apple Inc.",
  direction: "long",
  benchmarkIndex: "S&P 500",
  thesisContent: VALID_THESIS_FIXTURE.content,
  researchFilePaths: [],
  priceData: { priceChangePct: 3.2, indexChangePct: 1.1, relativePerf: 2.1 },
  weekLabel: "2026-W21",
  weekDate: "2026-05-19",
};
