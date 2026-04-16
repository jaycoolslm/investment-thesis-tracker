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

  let prompt = `You are an investment research analyst generating a structured thesis document.

TASK: Generate an investment thesis for ${companyName} (${ticker}).
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

2. Using the analyst's arguments above and your web research, generate a comprehensive investment thesis.

3. The thesis must include:
   - A 2-3 paragraph summary that reads like an elevator pitch
   - 2-5 thesis pillars (discrete, falsifiable arguments with supporting evidence)
   - A quality assessment covering financial strength, competitive position, and ESG
   - Valuation analysis with upside/base/downside scenarios
   - Key assumptions (measurable conditions the thesis depends on)
   - Specific risks with severity ratings (high/medium/low)
   - All sources cited

4. Be specific, not generic. Every pillar, assumption, and risk should be specific to ${companyName}, not applicable to any company in the sector.

5. Every financial metric must have a source. Do not hallucinate numbers.`;

  if (researchFilePaths.length > 0) {
    prompt += `

BROKER RESEARCH FILES (read these for additional context):
${researchFilePaths.map((p) => `- ${p}`).join("\n")}

Incorporate relevant insights from these documents into the thesis. Cite them in the sources section.`;
  }

  return prompt;
}

// ── Weekly monitoring prompt ──────────────────────────────────────────

export interface WeeklyAnalysisInput {
  ticker: string;
  companyName: string;
  direction: "long" | "short";
  benchmarkIndex: string;
  thesisSummary: string;
  pillars: Array<{ id: string; title: string; body: string | null }>;
  assumptions: string[];
  risks: Array<{ description: string; severity: string }>;
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
    thesisSummary,
    pillars,
    assumptions,
    risks,
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

  const pillarList = pillars
    .map(
      (p, i) =>
        `  Pillar ${i + 1} (id: ${p.id}): "${p.title}"${p.body ? ` — ${p.body}` : ""}`,
    )
    .join("\n");

  const assumptionList = assumptions
    .map((a, i) => `  ${i + 1}. ${a}`)
    .join("\n");

  const riskList = risks
    .map((r, i) => `  ${i + 1}. [${r.severity.toUpperCase()}] ${r.description}`)
    .join("\n");

  let prompt = `You are an investment research analyst performing a weekly monitoring update.

TASK: Analyse the past week's developments for ${companyName} (${ticker}) against the existing investment thesis.
POSITION: ${positionType}
BENCHMARK: ${benchmarkIndex}
WEEK: ${weekLabel} (week of ${weekDate})

${priceSection}

EXISTING THESIS SUMMARY:
${thesisSummary}

THESIS PILLARS (assess each one individually):
${pillarList}

KEY ASSUMPTIONS (check if still intact):
${assumptionList}

KNOWN RISKS:
${riskList}

INSTRUCTIONS:
1. Search the web for news and developments about ${companyName} (${ticker}) from the past week.
2. For EACH thesis pillar listed above, assess whether this week's news strengthens, weakens, or leaves it unchanged. Cite specific evidence.
3. For each key assumption, note whether it remains intact or has been challenged.
4. Write a 2-3 sentence summary that references specific pillars and assumptions by name.
5. Set thesisImpact to "strengthened", "weakened", or "unchanged" based on the overall weight of evidence across all pillars.
6. In pillarRefs, include an entry for each pillar above with its exact pillarId and pillarTitle.
7. Cite all sources (web articles, filings, broker research).

Be specific and evidence-based. Every claim must have a source.`;

  if (researchFilePaths.length > 0) {
    prompt += `

BROKER RESEARCH FILES (read these for additional context):
${researchFilePaths.map((p) => `- ${p}`).join("\n")}

Incorporate relevant insights from these documents. Cite them in the sources section.`;
  }

  return prompt;
}
