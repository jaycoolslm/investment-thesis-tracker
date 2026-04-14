# Thesis Tracker — Product Requirements Document

**Version**: 2.1
**Date**: 2026-04-14
**Author**: Product / Engineering
**Status**: Draft — usability fixes applied, benchmark index promoted to P0

---

## Problem Statement

Fund managers maintain investment theses for every holding in their portfolio, but the process of writing, formatting, and keeping these documents current is entirely manual. A typical PM covers 30–100+ positions — each thesis needs to reflect the original conviction, incorporate relevant market context, and stay updated as news breaks. Today this means hours of copy-pasting from broker PDFs, news sites, and spreadsheets into Word docs that immediately go stale.

The cost of not solving this: thesis documents are outdated within weeks, portfolio reviews rely on memory instead of written rationale, and there is no audit trail linking a position to the evolving evidence for or against it.

---

## Goals

| # | Goal | Measure |
|---|------|---------|
| G1 | Reduce time to produce a thesis one-pager from hours to minutes | < 5 min per holding (single); < 30 min for a 50-stock bulk upload |
| G2 | Keep every thesis current with weekly automated monitoring | 100% of active holdings receive a weekly log entry |
| G3 | Surface share price performance alongside qualitative analysis | Every weekly log includes week-over-week price move and relative-to-index performance |
| G4 | Make the tool usable by non-technical fund managers with zero training | First-time user can generate a thesis without reading docs or asking for help |
| G5 | Architect for scale and AI-provider portability | System handles 500+ holdings on weekly schedule; AI agent layer is swappable |

---

## Non-Goals

| # | Non-Goal | Rationale |
|---|----------|-----------|
| NG1 | Portfolio management or trade execution | This is a thesis documentation tool, not an OMS/PMS |
| NG2 | Proprietary financial modelling or valuation | Fund managers have their own models — we document conviction, not calculate it |
| NG3 | Real-time price alerts or intraday monitoring | Weekly cadence is the target; real-time is a different product |
| NG4 | Multi-user collaboration or permissions in v1 | Single-user or small-team usage first; RBAC comes later |
| NG5 | Mobile app | Web-first; finance desktops are the primary workspace |

---

## User Personas

### Fund Manager (primary)
- Non-technical. Comfortable with Excel, email, and web browsers.
- Manages 30–100+ holdings across equities.
- Cares about: speed, clarity, structured output, not learning new tools.
- Frustration: "I spend more time formatting documents than thinking about stocks."

### Developer / Integrator (secondary)
- Builds and maintains the system.
- Cares about: modularity, scalability, using the client's existing Azure OpenAI instance.
- Constraint: must use Codex CLI SDK for JavaScript.

---

## User Stories

### Thesis Generation

| ID | Story | Priority |
|----|-------|----------|
| US-1 | As a fund manager, I want to enter a ticker, my position (long/short), and 3–5 bullet points of my thesis so that AI generates a formatted one-page thesis document. | P0 |
| US-2 | As a fund manager, I want to upload an Excel/CSV with multiple holdings and bullet points so that thesis one-pagers are bulk-generated for my entire portfolio. | P0 |
| US-3 | As a fund manager, I want the AI to search the web for current information about each stock so that the generated thesis includes relevant market context I didn't have to provide. | P0 |
| US-4 | As a fund manager, I want the one-pager to follow a consistent, professional structure so that every thesis in my portfolio is easy to read and compare. | P0 |

### Weekly Monitoring

| ID | Story | Priority |
|----|-------|----------|
| US-5 | As a fund manager, I want AI to automatically check the latest news for each holding every week so that a log entry is added with insights on whether recent developments strengthen or weaken my thesis. | P0 |
| US-6 | As a fund manager, I want each weekly log entry to show the week date, share price move (absolute), and share price move relative to a benchmark index so that I can correlate news with price action. | P0 |
| US-7 | As a fund manager, I want to upload broker research PDFs and other private documents so that the weekly analysis incorporates high-quality proprietary data alongside web search. | P0 |

### Thesis Management

| ID | Story | Priority |
|----|-------|----------|
| US-8 | As a fund manager, I want to view all my holdings in a simple list/table with their current thesis status so that I have a dashboard of my portfolio's thesis coverage. | P0 |
| US-9 | As a fund manager, I want to edit the generated thesis directly so that I can refine the AI's output with my own judgment. | P0 |
| US-10 | As a fund manager, I want to export a thesis (with its log history) as a PDF so that I can share it in portfolio review meetings. | P1 |

### Technical / Developer

| ID | Story | Priority |
|----|-------|----------|
| US-11 | As a developer, I want to use the Codex CLI SDK for JavaScript with the client's Azure OpenAI instance so that the system runs on approved infrastructure. | P0 |
| US-12 | As a developer, I want the weekly monitoring jobs to run concurrently and scale to hundreds of stocks so that the system doesn't bottleneck as portfolios grow. | P0 |
| US-13 | As a developer, I want the AI agent layer to be modular (behind an interface) so that I can swap in the Anthropic Agent SDK or another provider without rewriting business logic. | P0 |

---

## Requirements

### Must-Have (P0)

#### R1: Single Thesis Generation
The user enters a ticker, position direction (long/short), benchmark index, and freeform bullet points. The system:
1. Accepts the input via a simple form (ticker, direction, benchmark, text area for bullets, optional file upload).
2. Runs a web search to gather current context about the company.
3. Retrieves any uploaded broker research associated with the holding (if available).
4. Passes the user's bullets + web context + broker research to the AI agent.
5. Produces a structured thesis document with pillars, assumptions, and quality assessment.

**Acceptance Criteria**
- [ ] User can enter a ticker symbol (validated against known tickers or accepted freeform).
- [ ] User can select Long or Short.
- [ ] User can select a benchmark index (default: S&P 500) from a dropdown.
- [ ] User can enter bullet points as plain text. Placeholder text models good input (e.g., "Strong pricing power — raised prices 8% with no volume loss").
- [ ] User can optionally upload broker research files during the Add Holding flow.
- [ ] System performs web search and incorporates at least 3 relevant data points.
- [ ] Generated thesis follows the standard template (see Thesis Template below).
- [ ] Generation completes in under 60 seconds for a single holding.
- [ ] User sees a **multi-step progress indicator** during generation: "Searching for market data..." → "Analysing broker research..." → "Building thesis pillars..." → "Compiling document..."
- [ ] If generation fails, user sees a clear error message with a retry option.

#### R2: Bulk Generation via Spreadsheet
The user uploads an Excel (.xlsx) or CSV file with columns: Ticker, Direction, Thesis Bullets. The system generates a thesis for each row.

**Acceptance Criteria**
- [ ] System accepts .xlsx and .csv files.
- [ ] System validates the file and shows a preview table before generation starts.
- [ ] System shows clear errors for malformed rows (e.g., missing ticker) with inline fix/remove options.
- [ ] System shows progress with estimated time remaining (e.g., "Generating 12 of 47... ~4 min remaining").
- [ ] Bulk generation continues in the background if user navigates away. A persistent banner on the dashboard shows progress.
- [ ] User can cancel a bulk job in progress.
- [ ] Failed rows are reported individually with per-row retry. No re-upload required to fix errors.
- [ ] Successful rows are not blocked by failures.
- [ ] A downloadable template file is provided so users know the expected format.

#### R3: Investment Thesis Template Structure

An investment thesis is a reasoned argument for a particular investment, backed by research and analysis. It documents the conviction, the evidence, and the assumptions — so that the thesis can be revisited, challenged, and updated as new information emerges.

The generated thesis follows a **pillar-based structure**. Each thesis is built on 2–5 core pillars: the fundamental arguments that support the investment case. Pillars make the thesis scannable, debatable, and trackable over time — each weekly log entry can reference which pillars are strengthening or weakening.

**Template**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Company Name] ([Ticker])                [Long/Short]
Generated: [Date] | Benchmark: [Index]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

INVESTMENT THESIS
[2-3 paragraph summary: what is the investment, why now, and
what is the expected outcome. Combines the fund manager's
conviction with AI-enriched market context. This is the
"elevator pitch" — a reader should understand the core
argument in 30 seconds.]

THESIS PILLARS
Each pillar is a discrete, falsifiable argument supporting the position.
The AI derives these from the user's bullet points, enriched with web research.

  Pillar 1: [Title — e.g., "Pricing Power in Inflationary Environment"]
  [2-3 sentences explaining the argument and supporting evidence]

  Pillar 2: [Title — e.g., "Structural Market Share Gains"]
  [2-3 sentences]

  Pillar 3: [Title — e.g., "Capital Allocation Discipline"]
  [2-3 sentences]

  (Up to 5 pillars. Fewer is stronger.)

QUALITY ASSESSMENT
  Financial Strength:  [Key metrics — ROIC, margins, FCF conversion,
                        leverage. Sourced from web search.]
  Competitive Position: [Moat, disruption risk, market position]
  ESG / Governance:     [Material governance or ESG considerations,
                         if relevant. "None identified" is acceptable.]

VALUATION & EXPECTED RETURN
  Current Price:    [At time of generation]
  Investment Goal:  [What the fund manager expects — e.g., "re-rate
                     to sector median P/E over 12-18 months"]
  Upside Case:      [Brief — what goes right]
  Base Case:        [Brief — expected outcome]
  Downside Case:    [Brief — what goes wrong]

KEY ASSUMPTIONS
  • [Assumption 1 — e.g., "Revenue growth sustains >10% through FY27"]
  • [Assumption 2 — e.g., "No regulatory intervention in core market"]
  • [Assumption 3]
  These are the conditions under which the thesis holds. If any assumption
  breaks, the thesis should be re-evaluated. Weekly monitoring checks
  these explicitly.

RISKS & WHAT COULD GO WRONG
  • [Risk 1 — with severity: high/medium/low]
  • [Risk 2]
  • [Risk 3]
  Each risk should be specific and actionable, not generic.
  "Competition" is too vague; "AWS launching a competing product
  in Q3 2026" is useful.

SOURCES & RESEARCH
  • [Web source 1 — title, date]
  • [Web source 2]
  • [Broker research — if uploaded]
  All sources used in generating the thesis are cited here.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WEEKLY LOG
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Week        | Price     | vs Index  | Thesis Impact | Summary
[YYYY-MM-DD]| [+/-X.X%] | [+/-X.X%] | [Strengthened/Weakened/Unchanged] |
[2-3 sentence summary referencing specific pillars and assumptions.
 e.g., "Pillar 2 strengthened: Q1 earnings showed 3pp market share
 gain. Assumption 1 intact — revenue grew 14% YoY."]
```

**Why this structure:**
- **Pillars** give the thesis a skeleton that can be tracked over time. Weekly logs don't just say "thesis strengthened" — they say *which pillar* strengthened and why.
- **Key Assumptions** are explicitly separated from arguments. When an assumption breaks, it's a clear signal to re-evaluate — not buried in prose.
- **Quality Assessment** ensures the AI checks financial strength and competitive positioning (inspired by Morgan Stanley's investment process), not just the user's narrative.
- **Valuation & Expected Return** grounds the thesis in a measurable outcome, making it useful for portfolio reviews.
- **Sources** provide an audit trail — critical when broker research is incorporated alongside web data.

**Acceptance Criteria**
- [ ] All generated theses conform to the pillar-based template.
- [ ] AI generates 2–5 thesis pillars derived from user's bullet points, enriched with web context.
- [ ] Each pillar has a clear title and supporting evidence.
- [ ] Quality Assessment section is populated from web-sourced financial data.
- [ ] Key Assumptions are extracted and listed as discrete, falsifiable statements.
- [ ] Risks are specific (not generic) and severity-rated.
- [ ] All web sources and broker research used are cited in the Sources section.
- [ ] Template sections are clearly delineated and visually scannable.
- [ ] The thesis is editable after generation — user can modify any section, add/remove pillars.
- [ ] Edits are persisted immediately.

#### R4: Weekly Automated Monitoring
A scheduled job runs weekly for every active holding. For each stock it:
1. Searches the web for the latest news and developments.
2. Retrieves any uploaded broker research associated with the holding.
3. Fetches the weekly share price move (close-to-close, week-over-week) in local currency.
4. Fetches the share price move relative to the configured benchmark index (default: S&P 500).
5. Analyses news and research against the thesis **pillars** and **key assumptions** specifically.
6. Assesses whether each development strengthens, weakens, or has no impact on the thesis.
7. Appends a structured log entry to the thesis document.

**Weekly Log Entry Format**
```
Week of [YYYY-MM-DD] | Price: [+/-X.X%] | vs [Index]: [+/-X.X% relative] | [Strengthened/Weakened/Unchanged]
[2-3 sentence summary referencing specific pillars and assumptions.
 e.g., "Pillar 2 strengthened: Q1 earnings confirmed 3pp market share gain.
 Assumption 1 intact — revenue grew 14% YoY. Risk 1 unchanged — no regulatory action."]
Sources: [web source 1], [broker research if used]
```

**Acceptance Criteria**
- [ ] Job runs automatically on a configurable schedule (default: every Monday 6 AM).
- [ ] Each log entry includes: week label, absolute price change (%), relative price change vs index (%).
- [ ] Log entry references specific thesis pillars and assumptions by name.
- [ ] Log entry includes a plain-English summary of key news and research findings.
- [ ] Log entry explicitly states whether thesis is "strengthened", "weakened", or "unchanged".
- [ ] If broker research is available for the holding, it is incorporated into the analysis.
- [ ] Sources (web and broker) used for each log entry are cited.
- [ ] Fund manager can view the full log history for any holding.
- [ ] If price data is unavailable, the entry notes this and still provides the news summary.
- [ ] Job completes for 100 holdings within 2 hours.

#### R5: Holdings Dashboard
A single-screen view showing all holdings with:
- Ticker and company name
- Direction (Long/Short)
- Last weekly price change (%)
- Date thesis was generated
- Last weekly update date
- Latest thesis status (strengthened / weakened / unchanged) — colour-coded

**Acceptance Criteria**
- [ ] Dashboard loads in under 3 seconds.
- [ ] Holdings are sortable by any column.
- [ ] Real-time search/filter bar at the top filters by ticker or company name as the user types.
- [ ] Filter chips for direction (Long/Short) and status (Strengthened/Weakened/Unchanged).
- [ ] Keyboard shortcut (Cmd+K or /) focuses the search bar.
- [ ] Status column uses colour coding: green (strengthened), red (weakened), grey (unchanged).
- [ ] Clicking a holding opens its full thesis + log.
- [ ] User can add a new holding or remove an existing one from the dashboard.

#### R6: Thesis Editing
User can edit any section of a generated thesis inline. The thesis view uses tab navigation to organise sections (not a single long scroll).

**Acceptance Criteria**
- [ ] Thesis view uses tabs or anchored sections: Summary+Pillars | Quality+Valuation | Assumptions+Risks | Sources | Weekly Log.
- [ ] Weekly Log tab shows count badge (e.g., "Weekly Log (12)").
- [ ] Narrative sections (summary, pillar descriptions, quality assessment) use click-to-edit text blocks.
- [ ] Structured items (pillars, assumptions, risks) use discrete editable rows with add/remove/reorder controls.
- [ ] Pillars can be added, removed, reordered, and edited individually (Notion-style block editing).
- [ ] Risk severity (High/Medium/Low) is editable via a dropdown on each risk row.
- [ ] Changes auto-save (no explicit save button needed).
- [ ] Edit history is not required in v1 (but data model should not preclude it).

#### R7: AI Agent — Codex CLI SDK
The AI agent uses the Codex CLI SDK for JavaScript (`@openai/codex-sdk`) with Azure OpenAI (GPT 5.1 Codex). The agent handles web search and file reading natively — no separate search or document processing infrastructure needed.

**Acceptance Criteria**
- [ ] AI calls go through a thin `ThesisAgent` wrapper class that isolates the SDK from business logic.
- [ ] Implementation uses Codex CLI SDK for JavaScript pointing at Azure OpenAI.
- [ ] The wrapper is simple enough that swapping to another SDK (e.g., Anthropic Agent SDK) means rewriting one file, not the whole app.
- [ ] Prompts are in a dedicated file, not inline in business logic.

#### R8: Scalable Job Execution
Weekly monitoring runs concurrently with rate limiting and retry logic.

**Acceptance Criteria**
- [ ] Jobs run with configurable concurrency (default: 10 parallel).
- [ ] Failed jobs retry up to 3 times with exponential backoff.
- [ ] Job status is logged (success/failure/retried) for operational visibility.
- [ ] System handles 500+ holdings without timeout or OOM.

#### R9: Broker Research Upload
User can upload PDF/DOCX research documents and associate them with a holding. The Codex agent reads these files directly during thesis generation and weekly analysis — no parsing pipeline or vector indexing required.

**Acceptance Criteria**
- [ ] User can upload PDF and DOCX files (up to 50 MB each).
- [ ] Files are saved to disk and associated with a specific holding in the database.
- [ ] Thesis generation passes uploaded file paths to the Codex agent for direct reading.
- [ ] Weekly analysis incorporates broker research when available.
- [ ] User can view and delete uploaded documents per holding.
- [ ] Upload UI is drag-and-drop with clear file type/size guidance.

#### R11: Configurable Benchmark Index
User can set the benchmark index per thesis (default S&P 500). This is P0 because non-US holdings measured against S&P 500 produce meaningless relative performance data.

**Acceptance Criteria**
- [ ] User can select from a list of major indices (S&P 500, NASDAQ, FTSE 100, Euro Stoxx 50, Nikkei 225, Hang Seng, ASX 200).
- [ ] Benchmark dropdown is part of the Add Holding form (default: S&P 500).
- [ ] Benchmark is editable on the thesis view after generation.
- [ ] Benchmark is displayed in the thesis header and used for all weekly log relative calculations.

### Nice-to-Have (P1)

#### R10: PDF Export
User can export a thesis with its full log history as a formatted PDF.

**Acceptance Criteria**
- [ ] Export produces a clean, professional PDF.
- [ ] PDF includes all thesis sections and the full weekly log.
- [ ] Export completes in under 10 seconds.

#### R12: Email Digest for Weekly Monitoring
After the weekly monitoring job completes, send an email summary to the fund manager.

**Acceptance Criteria**
- [ ] Email sent after all weekly jobs complete.
- [ ] Email summarises: X holdings updated, Y strengthened, Z weakened.
- [ ] Each holding listed with ticker, price move, and thesis impact.
- [ ] Clicking a holding in the email links to the thesis view.

### Future Considerations (P2)

| ID | Consideration | Design Implication |
|----|---------------|--------------------|
| F1 | Multi-user access with role-based permissions | Data model should have a user/org dimension from day one |
| F2 | Integration with portfolio management systems | Thesis data model should use standard identifiers (ISIN, SEDOL, Bloomberg ticker) |
| F3 | Custom thesis templates per fund/strategy | Template should be data-driven, not hardcoded |
| F4 | Microsoft Teams notifications for weekly summaries | Weekly job should emit events that a notification layer can consume |
| F5 | Version history / diff view on thesis edits | Store thesis as versioned documents (not just latest state) |
| F6 | Sentiment scoring / quantitative thesis strength metric | Weekly log schema should allow numeric scores alongside text |

---

## Thesis One-Pager — UX Principles

These users are finance professionals, not software engineers. Every design decision should pass this test: **"Would a PM who lives in Excel and Bloomberg find this obvious?"**

1. **No onboarding wizard.** The first screen is the dashboard. One button: "Add Holding." That's the entry point.
2. **No jargon.** No "pipelines", "agents", "embeddings". The UI speaks finance: "holdings", "thesis", "weekly update", "broker research".
3. **Spreadsheet upload is drag-and-drop.** Provide a template. Accept messy data gracefully (trim whitespace, normalize tickers).
4. **The thesis is the product.** The one-pager is not buried behind navigation. It IS the main view when you click a holding.
5. **Weekly log reads like a journal.** Reverse chronological. Each entry is self-contained. Scannable in 10 seconds.
6. **Price data is front and centre.** The weekly log table puts the numbers first (week, price move, relative move) then the narrative.
7. **Loading states over empty states.** If something is generating, show progress. Never show a blank screen.

---

## Success Metrics

### Leading Indicators (first 30 days)

| Metric | Target | Stretch | How to Measure |
|--------|--------|---------|----------------|
| Time to generate first thesis | < 5 min from signup | < 2 min | Timer from first login to first thesis saved |
| Bulk upload success rate | > 90% of rows generate successfully | > 98% | Failed rows / total rows across all bulk jobs |
| Weekly job completion rate | 100% of holdings get a log entry each week | — | Holdings with log entry / total active holdings |

### Lagging Indicators (30–90 days)

| Metric | Target | Stretch | How to Measure |
|--------|--------|---------|----------------|
| Weekly active usage | > 80% of users open the app weekly | > 90% | WAU / total registered users |
| Holdings per user | > 20 | > 50 | Avg active holdings per user |
| Thesis edit rate | > 30% of theses are manually refined | > 50% | Theses with edits / total theses |
| Broker research uploads | > 10% of holdings have uploaded research | > 30% | Holdings with docs / total holdings |

---

## Technical Architecture — Key Decisions

### AI Agent — Codex CLI SDK
```
Business Logic → ThesisAgent wrapper → Codex CLI SDK → Azure OpenAI (GPT 5.1 Codex)
```

The Codex agent handles web search and file reading natively. No separate search API, no document parsing pipeline, no vector store. The `ThesisAgent` wrapper isolates the SDK from business logic — simple enough to rewrite for a different provider when needed.

### Price Data
- The Codex agent fetches price data via its built-in web search during weekly analysis.
- Relative performance = holding weekly return − index weekly return.
- All prices shown in local currency of the holding.

### Broker Research
- PDF/DOCX files are saved to disk and associated with a holding.
- File paths are passed to the Codex agent, which reads them directly — no parsing, chunking, or embedding required.

### Deployment
- Containerised (Docker) and cloud-agnostic — three containers: `api`, `postgres`, `redis`.
- No hard dependency on any specific cloud provider's managed services.

### Job Scheduler
- Weekly jobs triggered by node-cron, fanned out via BullMQ with configurable concurrency.
- Each job is idempotent — safe to retry.

---

## Resolved Questions

| # | Question | Decision |
|---|----------|----------|
| Q1 | Which market data source? | Public web search tools initially — no paid market data API dependency at launch. |
| Q2 | Which Azure OpenAI model? | GPT 5.1 Codex via Codex CLI SDK for JavaScript. |
| Q3 | Default benchmark index? | S&P 500 by default, configurable per thesis. |
| Q4 | Preferred spreadsheet format? | .xlsx and .csv only — no additional formats needed. |
| Q5 | Currency handling? | Local currency of the holding. No conversion. |
| Q6 | Deployment target? | Containerised (Docker), cloud-agnostic. No vendor lock-in. |
| Q7 | Compliance requirements for broker research storage? | None identified — no special handling required. |

## Open Questions

All previously open questions resolved. The Codex agent's built-in web search eliminates Q8, and direct file reading eliminates Q9.

---

## Timeline Considerations

### Suggested Phasing

**Phase 1 — Thesis Generation + Research Upload (4-5 weeks)**
- R1: Single thesis generation (with multi-step progress indicator)
- R2: Bulk spreadsheet upload (with background processing + error recovery)
- R3: Investment thesis template (pillar-based)
- R5: Holdings dashboard (with search/filter, colour-coded status)
- R6: Thesis editing (tabbed view, Notion-style block editing)
- R7: AI agent (Codex CLI SDK wrapper)
- R9: Broker research upload
- R11: Configurable benchmark index
- Prerequisite: Azure OpenAI deployment access for GPT 5.1 Codex

**Phase 2 — Weekly Monitoring (3-4 weeks)**
- R4: Weekly automated monitoring (news + price data + broker research)
- R8: Scalable job execution
- R12: Email digest for weekly monitoring

**Phase 3 — Export & Polish (1-2 weeks)**
- R10: PDF export

### Dependencies
- Phase 1 requires Azure OpenAI deployment access (GPT 5.1 Codex).
- Phase 2 builds on the thesis template and broker research from Phase 1.
- No blocking external dependencies remain — all key questions resolved.

---

*This is a living document. Update as open questions are resolved and scope is refined.*
