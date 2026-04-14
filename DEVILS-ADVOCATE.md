# Devil's Advocate Review — Thesis Tracker PRD v1.1

**Reviewed**: 2026-04-14
**Reviewer role**: Pre-build stress test. The goal is to find the things that will hurt at week 6, not week 1.

---

## 1. Assumptions That Could Kill This

### "Fund managers will type 3-5 bullet points per holding"

This is the foundational input to the entire system, and it is under-examined. A PM running 80 positions is not going to sit down and write 240-400 bullet points. The PRD assumes the user has pre-formed, articulable convictions for every holding that they are willing to type into a text box. In practice:

- Many positions were inherited, or the conviction is "the CIO told me to buy it."
- The thesis lives in the PM's head as a feeling, not discrete bullet points.
- For a bulk upload of 50 stocks, the user needs to fill a spreadsheet column with free-text bullets for every row. That is not a 30-minute task. That is a half-day task, and it will feel like homework.

**Consequence**: The bulk upload feature (US-2, the "< 30 min for 50 stocks" goal) is measuring system time, not user time. The bottleneck is the human, not the AI. If the input friction is too high, the tool never gets past a handful of holdings and the weekly monitoring loop (the real value) never reaches critical mass.

**What to do**: Consider a "low-input mode" where the user provides just a ticker and direction, and the AI generates a draft thesis from web research alone. The user refines afterward. This flips the interaction from "write then generate" to "generate then edit" — which matches how these people actually work. They react to drafts; they don't write from scratch.

### "Public web search produces thesis-quality financial data"

The PRD relies on web search for: (a) enriching the initial thesis with market context, (b) sourcing financial metrics for the Quality Assessment section (ROIC, margins, FCF conversion, leverage), (c) weekly news monitoring, and (d) share price data. That is four critical functions resting on a single, unvalidated data source.

Problems:

- **Financial metrics from web search are unreliable.** Google a company's ROIC and you will get three different numbers from three different sites, computed differently, from different fiscal periods. A fund manager who sees an incorrect margin figure will lose trust in the entire document instantly. These people live in Bloomberg and FactSet — they know the real numbers.
- **Share price data from web search is fragile.** Web scraping for prices is subject to format changes, geo-restrictions, stale caches, and inconsistent timestamps. "Week-over-week close price" requires knowing the exact close on two specific dates in the holding's local exchange. Web search does not reliably deliver this.
- **News search has a quality floor problem.** For large-cap US stocks, web search returns decent results. For mid-cap European or Asian equities, the results will be thin, repetitive, or irrelevant. The PRD makes no distinction — it assumes uniform coverage across all equities.

**Consequence**: The Quality Assessment section will contain wrong numbers for a meaningful percentage of holdings. Weekly price data will have gaps or errors. The PM will notice, and the tool's credibility collapses. In finance, being wrong about a number once is worse than having no number at all.

**What to do**: At minimum, the PRD should acknowledge this risk and define a fallback strategy. Better: integrate a proper market data API (even a free tier like Yahoo Finance's unofficial API, Polygon.io, or Twelve Data) for price data, and flag the Quality Assessment metrics as "AI-sourced, verify independently" with a visual distinction.

### "GPT 5.1 Codex via Azure is the right model for financial analysis"

The PRD specifies the model as a resolved question (Q2), but the rationale is missing. Codex models are optimized for code generation, not financial reasoning or structured document synthesis. Key concerns:

- The template requires the AI to produce falsifiable assumptions, severity-rated risks, and pillar-specific weekly assessments. This demands strong reasoning, not code completion.
- Financial hallucination is a well-documented problem with LLMs. The PRD has no guardrails against the model fabricating metrics, misattributing sources, or generating plausible-sounding but factually wrong analysis.
- The Codex CLI SDK constraint appears to be driven by infrastructure requirements ("client's Azure OpenAI instance"), not by model suitability for the task. The PRD should at least acknowledge this tradeoff.

**Consequence**: The AI generates confident-sounding financial analysis that contains subtle errors. A busy PM skims it, trusts it, and makes a decision on flawed information. This is the worst outcome — worse than the tool not existing, because at least without the tool the PM knows they are operating on incomplete information.

**What to do**: Add an explicit requirement for source attribution on every factual claim in the thesis. Anything the AI states as fact (a metric, a date, an event) must link to its source. If the AI cannot cite it, it should not state it. This is table stakes for finance.

### "The pillar-based template will feel helpful, not bureaucratic"

The template has 10 distinct sections: Header, Investment Thesis, Thesis Pillars, Quality Assessment, Valuation & Expected Return, Key Assumptions, Risks, Sources, and Weekly Log. The PRD calls this a "one-pager" but it is structurally a 2-3 page document.

For a PM reviewing 80 holdings in a portfolio review meeting, this is a lot of surface area. The pillar structure is intellectually elegant, but the question is whether the user will actually read and maintain all 10 sections, or whether they will skim the summary and ignore the rest — at which point the structure is overhead, not value.

**Consequence**: Users engage with the first section (Investment Thesis summary) and the weekly log, and ignore everything in between. The middle sections go stale. The tool becomes a glorified news digest with a pretty header.

**What to do**: Design the UI so the summary and weekly log are primary, and the supporting sections (pillars, quality, valuation) are expandable/collapsible. Track which sections users actually read and edit. If nobody touches the Quality Assessment section after 60 days, cut it.

---

## 2. Scope & Phasing Risks

### Phase 1 is not 5-7 weeks of work. It is 5-7 weeks of optimistic work.

Phase 1 includes: single thesis generation (R1), bulk upload (R2), the full pillar-based template (R3), the holdings dashboard (R5), inline thesis editing (R6), the AI agent abstraction layer (R7), and broker research upload with vector indexing (R9). That is seven requirements, several of which are individually multi-week efforts.

Breaking it down honestly:

| Requirement | Realistic Estimate | Why |
|---|---|---|
| R1: Single thesis generation | 1.5-2 weeks | Form + web search integration + AI prompt engineering + template rendering. Prompt engineering alone for a 10-section template is iterative and slow. |
| R2: Bulk upload | 1-1.5 weeks | File parsing + validation + progress UI + error handling + cancellation. CSV is easy; XLSX parsing with messy real-world data is not. |
| R3: Template | Embedded in R1, but 0.5-1 week of prompt iteration | Getting the AI to consistently produce all 10 sections with the right level of detail across different companies is harder than it looks. |
| R5: Dashboard | 1 week | Sorting, filtering, CRUD — straightforward but not trivial. |
| R6: Inline editing | 0.5-1 week | Autosave, rich text or markdown editing, state management. |
| R7: Abstraction layer | 1-1.5 weeks | Interface design, two implementations (even if the second is a stub), configuration switching, testing. Doing this well in v1 adds complexity to every AI call. |
| R9: Broker research upload | 2-3 weeks | This is the sleeper. PDF/DOCX parsing, text extraction, chunking strategy, vector store setup, retrieval pipeline, relevance tuning, upload UI. This is an entire sub-project. |

**Total realistic estimate: 8-11 weeks**, assuming one engineer, no major blockers, and no time lost to environment setup, Azure access provisioning, or vector store evaluation.

**Consequence**: The team hits week 7 with R9 (broker research) half-done or cut, which means Phase 2's weekly monitoring (which depends on broker research integration) is also compromised. The schedule cascades.

**What to do**: Move R9 (broker research upload) to Phase 2 or split it into "upload and store" (Phase 1) and "vector index and retrieve" (Phase 2). Phase 1 should ship a working thesis generator with web search only. Broker research is a power-user feature; it should not gate the core loop.

### The AI agent abstraction layer is YAGNI in Phase 1

R7 requires an `AgentProvider` interface with a default Codex implementation and the ability to swap in an Anthropic provider "without changing business logic." This is a laudable architectural goal, but in Phase 1 of a greenfield product with one confirmed provider, it adds complexity to every AI interaction for a benefit that may never be realized.

The abstraction must account for differences in: tool calling conventions, streaming behavior, error handling semantics, context window sizes, token limits, and response formats. A genuinely provider-agnostic interface that handles all of this well is a non-trivial design problem. A thin interface that papers over the differences will leak abstractions the moment you try the second provider.

**Consequence**: The team spends a week designing an interface that is either too thin to be useful when the second provider arrives, or too thick and adds friction to every AI feature in the meantime. Either way, it slows Phase 1 without delivering user value.

**What to do**: In Phase 1, write clean code with the Codex SDK directly. Isolate AI calls into a service module. When (if) the second provider is needed, refactor then. The cost of refactoring later is lower than the cost of abstracting prematurely now.

### Where the team will get stuck: prompt engineering

The PRD specifies the template in detail but says nothing about how the AI will be instructed to produce it. Getting an LLM to reliably generate a 10-section document with: (a) the right number of pillars (2-5), (b) falsifiable assumptions, (c) specific (not generic) risks with severity ratings, (d) correct financial metrics, and (e) proper source citations — across different companies, sectors, and market caps — is a prompt engineering project in itself.

This will require dozens of iterations, a test suite of diverse holdings, and a quality evaluation framework. None of this is in the PRD or the timeline.

**Consequence**: The team ships a prompt that works well for large-cap US tech stocks and produces garbage for a Brazilian mining company or a Japanese pharmaceutical firm. The PM notices on day one.

**What to do**: Add an explicit requirement for prompt quality testing across a defined set of representative holdings (e.g., 10 companies spanning US large-cap, European mid-cap, Asian small-cap, different sectors). Define what "good enough" looks like for the generated output before starting Phase 1.

---

## 3. User Experience Red Flags

### "Super simple UX" vs. what the PRD actually describes

The UX principles section is excellent in intent ("Would a PM who lives in Excel and Bloomberg find this obvious?"). But the feature set described contradicts the simplicity goal:

- Single thesis generation form
- Bulk upload via spreadsheet (with template, validation, progress, cancellation, error reporting)
- Broker research PDF upload (drag-and-drop, per-holding association, viewing, deleting)
- 10-section thesis template with inline editing and autosave
- Holdings dashboard with sorting
- Weekly log with pillar-specific analysis

This is not a simple tool. This is a full-featured application. The UX principles call for "No onboarding wizard" and "one button: Add Holding" — but the user then needs to understand: the thesis template structure, what bullet points to provide, how to upload broker research, how to interpret pillar-based weekly assessments, and how to use inline editing.

**Consequence**: The first-time experience is not the 5-minute path the PRD envisions. The user clicks "Add Holding," sees a form asking for bullet points (what format? how many? how detailed?), and stalls.

**What to do**: Design the input form to be progressive. Start with just ticker and direction. Show a "quick generate" button that produces a draft with web research only. Then offer "refine with your own notes" as a secondary action. Broker research upload should be discoverable but not part of the primary flow.

### What happens when the AI generates a bad thesis?

The PRD has one acceptance criterion for failure: "If generation fails, user sees a clear error message with a retry option." But the more common failure mode is not a hard error — it is a thesis that generates successfully but is low quality. Examples:

- The AI hallucinates a financial metric. The ROIC says 24% but the real number is 12%.
- The pillars are generic and could apply to any company in the sector.
- The risks section says "increased competition" and "macroeconomic headwinds" — exactly the generic output the PRD says to avoid.
- The AI misidentifies the company (ticker collision: is "POOL" Pool Corporation or a swimming pool company?).

There is no quality check, no user confirmation step, no "does this look right?" prompt, and no feedback mechanism. The thesis is generated and saved. If the user notices a problem, the only recourse is manual editing.

**Consequence**: Bad theses accumulate silently. Weekly monitoring runs against flawed pillars and assumptions, producing log entries that reference incorrect foundations. The error compounds.

**What to do**: Add a "review and confirm" step after generation. Show the thesis in a preview state. Let the user approve it (which saves it to the dashboard) or regenerate it (with an option to provide additional guidance). This adds one click to the happy path but prevents a class of silent failures.

### No notification system means the weekly monitoring has no audience

The PRD specifies that weekly monitoring runs automatically every Monday at 6 AM. But there is no mechanism to tell the fund manager that the analysis is ready, or that something important happened. The PM has to remember to open the app every Monday and check.

F4 lists "Slack/email notifications for weekly summaries" as a future consideration (P2). But without notifications, the weekly monitoring feature is a tree falling in an empty forest. The entire value proposition of automated monitoring is that it surfaces information proactively. If the user must pull instead of being pushed, the feature competes with the PM's existing habit of reading their Bloomberg terminal and morning research emails.

**Consequence**: Weekly monitoring runs reliably, but usage drops after the novelty wears off because nothing prompts the user to engage with it. The "80% weekly active usage" target (success metric) becomes unreachable.

**What to do**: Move email notifications to P0 or early P1. At minimum, send a weekly digest email: "Here are your holdings where the thesis was weakened this week." This is a low-effort, high-impact feature. A simple email with 5 lines of text does more for engagement than a polished dashboard that nobody opens.

---

## 4. Technical Blind Spots

### Web search at 500+ holdings will hit rate limits and cost walls

The PRD requires weekly monitoring for 500+ holdings (G5, R8). Each weekly job requires at least one web search per holding (for news), plus a price lookup. That is 1,000+ web search API calls per week, every week. At scale with multiple users, this multiplies quickly.

The PRD marks the specific web search API as an open question (Q8) and says it is non-blocking because it is "abstracted behind the agent layer." But the choice of search API directly impacts: rate limits (Serper: 2,500/month on the free tier), cost (Bing API: ~$3 per 1,000 calls), latency, and result quality. This is not an implementation detail — it is a constraint that shapes the architecture.

Additionally, the LLM calls compound the cost. Each weekly monitoring job requires an AI call that ingests web search results, broker research chunks, the existing thesis, and produces a structured log entry. At 500 holdings, that is 500 LLM calls with substantial context windows. The Azure OpenAI costs could be significant and are not estimated anywhere in the PRD.

**Consequence**: The team picks a search API in week 1, builds against it, and discovers at scale that the rate limits or costs are prohibitive. Or the weekly job for 500 holdings exceeds the 2-hour window because of API throttling.

**What to do**: Estimate the per-holding cost (search API + LLM tokens) and multiply by 500. Put a dollar figure on the weekly run. If it is more than $50/week per user, that changes the business model. This estimate should happen before Phase 1 starts, not after.

### Vector store for broker research has under-specified requirements

R9 says "documents are parsed, chunked, and indexed for retrieval," but the PRD does not address:

- **Document freshness**: A broker initiates coverage with a 40-page report, then publishes 10 updates over the next year. Does the system treat all of them equally? Does the latest update supersede earlier ones? If the AI retrieves a chunk from a 6-month-old report that has been contradicted by a newer one, the analysis is wrong.
- **Conflicting research**: Two brokers cover the same stock with opposing views. The vector store will retrieve chunks from both. How does the AI handle contradictions? Does it present both views, or does it arbitrarily pick one?
- **Chunk quality**: Financial PDFs are notorious for poor text extraction — tables, charts, footnotes, multi-column layouts. The "parse PDF to text" step will lose most of the quantitative content that makes broker research valuable.

**Consequence**: The broker research feature becomes a "checkbox feature" — it exists, but the retrieved content is stale, contradictory, or garbled, so users stop uploading documents after their first bad experience.

**What to do**: Define a document lifecycle. At minimum: (1) newer documents from the same broker on the same holding should be flagged as superseding older ones, (2) the AI prompt should include the publication date of each retrieved chunk, and (3) the system should prefer recent chunks over old ones in retrieval ranking.

### Price data accuracy is a trust-destroying problem

This deserves its own section because it is the most visible and most verifiable output the system produces. Every weekly log entry shows a price change percentage. Fund managers know their stock prices. If the weekly log says AAPL was down 3.2% and the PM knows it was down 1.8%, the entire tool loses credibility.

Web search for price data will fail for:

- **Non-US equities**: Try web-searching the weekly close price of a stock listed on the Tokyo Stock Exchange or the Johannesburg Stock Exchange. The results are inconsistent at best.
- **Currency-adjusted returns**: The PRD says "local currency of the holding" — but does the web search know which currency that is?
- **Adjusted vs. unadjusted prices**: Dividends, stock splits, and corporate actions affect closing prices. Without a proper data source, the weekly return calculation will be wrong during these events.
- **Index returns**: Relative performance requires the benchmark index return for the same period. This is a second web search that must align on exact dates.

**Consequence**: Price data errors are not subtle. They are the first thing the user checks and the fastest way to destroy trust. One wrong number in week 2 and the PM mentally demotes the tool to "interesting experiment" status.

**What to do**: Use a real market data API for price data. This is non-negotiable for a finance tool. Free options exist (Yahoo Finance via yfinance, Alpha Vantage free tier, Twelve Data). The PRD's decision to avoid "paid market data API dependency at launch" saves a few hundred dollars a month and costs the product its credibility.

### Consistent AI output across sectors and geographies

The template requires the AI to fill: financial metrics (ROIC, margins, FCF), competitive position analysis, ESG considerations, valuation scenarios (upside/base/downside), and sector-specific risks. The quality of this output will vary wildly depending on:

- **Information availability**: A US mega-cap tech company has abundant web data. A Malaysian palm oil producer does not.
- **Sector differences**: "Competitive position" means something very different for a bank vs. a biotech vs. a REIT. The template is sector-agnostic, but the analysis cannot be.
- **Language barriers**: For non-English-market equities, web search results may be in the local language. The AI may not handle this well, or may miss critical local-language sources.

**Consequence**: The system produces excellent theses for FAANG stocks and mediocre-to-bad theses for everything else. Since fund managers who need thesis tracking tend to have diverse, global portfolios (not just FAANG), the tool fails for a significant portion of their book.

**What to do**: Define a "coverage tier" system. Tier 1 (US/UK large-cap): full template, high confidence. Tier 2 (developed market mid-cap): full template with caveats. Tier 3 (EM/small-cap): reduced template, clearly flagged as lower confidence. This sets expectations honestly instead of pretending the AI is equally capable everywhere.

---

## 5. What's Missing From This PRD

### No data model or schema

The PRD defines the thesis template in detail but says nothing about how the data is stored. This matters because:

- The thesis needs to be editable section-by-section (R6), which implies a structured data model, not a blob of markdown.
- Weekly log entries need to reference specific pillars and assumptions, which implies pillars have stable identifiers.
- Future requirements (F5: version history, F6: sentiment scoring) require schema decisions made now.
- The search/filter behavior on the dashboard depends on indexed fields.

Without a data model, the first engineering decision will be "how do I store this?" and the answer will shape (or constrain) every feature that follows.

### No authentication or authorization model

The PRD says "single-user or small-team usage first" (NG4) and lists multi-user access as a future consideration (F1) with the note "data model should have a user/org dimension from day one." But there is no requirement for authentication in v1. Can anyone with the URL access the tool? Is there a login screen? If it is a single-user tool deployed on a PM's desktop, that changes the architecture fundamentally compared to a hosted web app.

This is not a minor detail. It affects: deployment model, data isolation, session management, and whether the weekly cron job runs on a server or on the user's machine.

### No error handling or degradation strategy

The PRD's error handling is limited to: "If generation fails, user sees a clear error message with a retry option" and "If price data is unavailable, the entry notes this and still provides the news summary." But there are many more failure modes:

- Web search returns no useful results for a holding.
- The LLM returns a response that does not conform to the template.
- The vector store is unreachable.
- Azure OpenAI has an outage during the weekly job window.
- A broker PDF is encrypted or image-based (scanned) and cannot be parsed.

Each of these needs a defined behavior, not just a generic error message.

### No compliance or data sensitivity considerations

Q7 says "None identified — no special handling required" for compliance on broker research storage. This is almost certainly wrong. Broker research PDFs are proprietary, copyrighted documents distributed under license agreements. Storing them, chunking them, and feeding them to a third-party LLM (Azure OpenAI) raises:

- **Copyright and licensing issues**: Broker research is not free content. Uploading it to a system that sends it to an LLM may violate the distribution terms.
- **Data residency**: Where is the vector store hosted? If the fund is in the EU, GDPR applies to any personally identifiable information in the documents.
- **LLM data usage**: Does Azure OpenAI use the data for training? The fund manager needs to know their proprietary research is not leaking.

"None identified" is not an answer — it is an admission that nobody asked the compliance team.

### No definition of "active holding" vs. "closed position"

The PRD references "active holdings" in multiple places (G2: "100% of active holdings receive a weekly log entry") but never defines what makes a holding active or how a user marks a position as closed. What happens when a PM sells a stock? Does the weekly monitoring stop? Can they archive a thesis? Is there a status field?

### No offline or export/backup strategy

The thesis documents are the PM's intellectual property and institutional knowledge. If the tool goes down, or the team decides to stop maintaining it, can the user export all their data? The PRD has PDF export as P1 for individual theses but no bulk export or data portability feature.

### No concurrency conflict handling

What happens if the weekly job updates a thesis while the user is editing it? The job appends a log entry, but what if the user is mid-edit on a pillar that the log entry references? Autosave plus background job writes is a recipe for lost edits or inconsistent state without explicit conflict resolution.

---

## 6. The Three Things I'd Fix Before Writing Any Code

### 1. Replace web search for price data with a real market data API

This is the single highest-risk technical decision in the PRD. Price data is the most visible, most verifiable output the system produces. Getting it wrong destroys trust immediately and irreversibly. The cost of a market data API (free tier or $50-100/month) is negligible compared to the cost of shipping a finance tool that shows wrong prices.

**Specifically**: Integrate Alpha Vantage, Twelve Data, or Yahoo Finance (via yfinance) for closing prices and index returns. Keep web search for news and qualitative context. This splits the data sourcing into "verified numbers" and "AI-enriched narrative" — which is the right trust boundary.

### 2. Move broker research upload (R9) out of Phase 1

R9 (broker research upload with vector indexing) is the most complex requirement in Phase 1. It involves PDF/DOCX parsing, text chunking, vector store evaluation and setup, retrieval pipeline tuning, and upload UX — easily 2-3 weeks of work on its own. Including it in Phase 1 puts the entire timeline at risk and delays the core feature (thesis generation from web search + user bullets).

**Specifically**: Ship Phase 1 with thesis generation from user bullets + web search only. Add a placeholder in the UI: "Broker research upload coming soon." Move the full R9 to early Phase 2. This lets Phase 1 ship in 5-6 weeks and proves the core value proposition before investing in the document pipeline.

### 3. Add a "review and confirm" step after thesis generation, and email notifications for weekly monitoring

These are two UX gaps that will determine whether the tool gets used past the first week:

- **Review and confirm**: After the AI generates a thesis, show it in preview mode. The user reviews it and clicks "Save to portfolio" or "Regenerate." This prevents bad theses from silently entering the system and gives the user a sense of control. Without this, the first time the AI gets something wrong, the user's mental model becomes "this tool makes mistakes I have to hunt for."

- **Email notifications**: After the weekly job completes, send the user an email with a summary: which holdings had their thesis strengthened/weakened, any new risks identified, and the top movers. This is the hook that brings the user back every week. Without it, the weekly monitoring feature is passive infrastructure that nobody checks. A simple email with 10 lines of text is more important than the entire dashboard for driving engagement.

**Specifically**: Add both as P0 requirements. The review step adds 1-2 days of development. The email notification adds 1-3 days. Together they cost less than a week and they determine whether the product has a retention loop or not.

---

*This review is intentionally adversarial. The PRD is well-structured and thoughtful — the template design, UX principles, and phasing approach show clear product thinking. The gaps identified above are the kind that only surface under stress testing, and addressing them before development starts will save weeks of rework later.*
