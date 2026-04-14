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
