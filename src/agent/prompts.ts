export interface GenerationInput {
  ticker: string;
  companyName: string;
  direction: "long" | "short";
  bullets: string;
  benchmarkIndex: string;
  researchFilePaths: string[];
}

export function buildGenerationPrompt(input: GenerationInput): string {
  const {
    ticker,
    companyName,
    direction,
    bullets,
    benchmarkIndex,
    researchFilePaths,
  } = input;

  const positionType = direction === "long" ? "LONG (bullish)" : "SHORT (bearish)";

  let prompt = `You are an investment research analyst writing a thesis document.

TASK: Write an investment thesis for ${companyName} (${ticker}).
POSITION: ${positionType}
BENCHMARK: ${benchmarkIndex}

THE ANALYST'S KEY ARGUMENTS:
${bullets}

INSTRUCTIONS:
1. Search the web for current information about ${ticker}:
   - Latest financial results (revenue, margins, FCF, ROIC)
   - Recent earnings call highlights
   - Relevant news and developments
   - Competitive landscape and sector trends
   - Current stock price and valuation metrics

2. Using the analyst's arguments above and your web research, write a comprehensive
   investment thesis as a well-structured **Markdown document** in the "content" field.

3. Shape the document to the situation. A strong thesis usually covers (use markdown
   "##" headings; adapt, add, or drop sections as the case warrants):
   - Summary — a 2-3 paragraph elevator pitch
   - Thesis Pillars — the discrete, falsifiable arguments with supporting evidence
   - Quality Assessment — financial strength, competitive position, ESG
   - Valuation — methodology and upside/base/downside scenarios
   - Key Assumptions — the measurable conditions the thesis depends on
   - Risks — specific risks, each labelled High / Medium / Low

4. Be specific, not generic. Every argument, assumption, and risk should be specific
   to ${companyName}, not applicable to any company in the sector.

5. Every financial metric must have a source. Do not hallucinate numbers. Populate the
   "sources" field with everything you cite.`;

  if (researchFilePaths.length > 0) {
    prompt += `

BROKER RESEARCH FILES (read these for additional context):
${researchFilePaths.map((p) => `- ${p}`).join("\n")}

Incorporate relevant insights from these documents into the thesis. Cite them in the sources.`;
  }

  return prompt;
}

// ── Weekly monitoring prompt ──────────────────────────────────────────

export interface WeeklyAnalysisInput {
  ticker: string;
  companyName: string;
  direction: "long" | "short";
  benchmarkIndex: string;
  thesisContent: string;
  researchFilePaths: string[];
  priceData: {
    priceChangePct: number | null;
    indexChangePct: number | null;
    relativePerf: number | null;
  };
  weekLabel: string;
  weekDate: string;
}

export function buildWeeklyPrompt(input: WeeklyAnalysisInput): string {
  const {
    ticker,
    companyName,
    direction,
    benchmarkIndex,
    thesisContent,
    researchFilePaths,
    priceData,
    weekLabel,
    weekDate,
  } = input;

  const positionType =
    direction === "long" ? "LONG (bullish)" : "SHORT (bearish)";

  let priceSection: string;
  if (
    priceData.priceChangePct != null &&
    priceData.indexChangePct != null &&
    priceData.relativePerf != null
  ) {
    const sign = (n: number) => (n >= 0 ? "+" : "");
    priceSection = `VERIFIED PRICE DATA (use these exact figures):
- ${ticker} weekly change: ${sign(priceData.priceChangePct)}${priceData.priceChangePct.toFixed(2)}%
- ${benchmarkIndex} weekly change: ${sign(priceData.indexChangePct)}${priceData.indexChangePct.toFixed(2)}%
- Relative performance: ${sign(priceData.relativePerf)}${priceData.relativePerf.toFixed(2)}%

The above price data has been verified from market data feeds. Use these exact figures in your output. Do NOT search for or estimate price data.`;
  } else {
    priceSection = `PRICE DATA: Unavailable for this week. Set priceChangePct, indexChangePct, and relativePerf to null in your output. Focus on qualitative analysis from news and research.`;
  }

  let prompt = `You are an investment research analyst performing a weekly monitoring update.

TASK: Analyse the past week's developments for ${companyName} (${ticker}) against the existing investment thesis.
POSITION: ${positionType}
BENCHMARK: ${benchmarkIndex}
WEEK: ${weekLabel} (week of ${weekDate})

${priceSection}

EXISTING THESIS (Markdown):
${thesisContent}

INSTRUCTIONS:
1. Search the web for news and developments about ${companyName} (${ticker}) from the past week.
2. Read the thesis above and assess whether this week's news strengthens, weakens, or leaves each part of it intact. Cite specific evidence.
3. Write a 2-3 sentence summary that, in prose, names which parts of the thesis were affected and how.
4. Set thesisImpact to "strengthened", "weakened", or "unchanged" based on the overall weight of evidence.
5. Cite all sources (web articles, filings, broker research).

Be specific and evidence-based. Every claim must have a source.`;

  if (researchFilePaths.length > 0) {
    prompt += `

BROKER RESEARCH FILES (read these for additional context):
${researchFilePaths.map((p) => `- ${p}`).join("\n")}

Incorporate relevant insights from these documents. Cite them in the sources section.`;
  }

  return prompt;
}
