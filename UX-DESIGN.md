# Thesis Tracker -- UX Design Review

**Reviewer**: UX Design (AI-assisted)
**Date**: 2026-04-14
**PRD Version Reviewed**: 1.1

---

## Part 1: UX Critique

### What works

**The PRD gets the big things right.** The UX principles section (no onboarding wizard, no jargon, thesis-is-the-product) shows genuine understanding of the target user. Specifically:

1. **Dashboard-first architecture.** Opening straight to the holdings table with a single "Add Holding" action is correct. Fund managers do not want a welcome screen, a tutorial, or a sidebar full of features. They want to see their portfolio. This mirrors Bloomberg's approach: data first, chrome second.

2. **Pillar-based thesis structure.** Structuring the thesis around discrete, named pillars is the single best design decision in the PRD. It makes weekly log entries actionable ("Pillar 2 strengthened") instead of vague ("thesis looks good"). This is how PMs actually think -- they track 3-5 reasons they own a stock.

3. **Reverse-chronological weekly log.** Correct. This is how every finance professional expects time-series commentary to read. Most recent first. No pagination tricks.

4. **Spreadsheet upload with template.** Providing a downloadable template file is essential. The PRD calls this out. Good.

5. **Auto-save on edits.** No save button. This is the right call for a document that users will tweak in small increments.

---

### What needs rethinking

#### Problem 1: The thesis "one-pager" is not a one-pager

The template has **8 sections**: Investment Thesis, Thesis Pillars (2-5 subsections), Quality Assessment, Valuation & Expected Return, Key Assumptions, Risks, Sources, and Weekly Log. With real content, this is 2-4 printed pages minimum. Calling it a "one-pager" sets a false expectation and creates a scrolling problem.

**Proposed fix:** Treat the thesis as a **structured document with a fixed navigation rail**, not a long scroll. Show a left-side or top-tab navigation with section anchors:

```
[Summary] [Pillars] [Quality] [Valuation] [Assumptions] [Risks] [Sources] [Weekly Log]
```

The default view when you open a holding should be the **Summary + Pillars** (the actual "one-pager" content). The weekly log should be a separate tab or a collapsible section below the fold. Do not force users to scroll past 5 thesis sections to reach the weekly log they check every Monday morning.

Better yet: put the **Weekly Log as the first tab after Summary**, since that is what users will access most frequently after initial generation. The thesis sections are "set and forget" -- the log is the living document.

#### Problem 2: The "Add Holding" form undersells the interaction

The PRD describes: ticker, direction (long/short), and a text area for bullet points. Then generation takes up to 60 seconds. This flow has two UX problems:

1. **The bullet points field is doing too much work.** Fund managers think in structured arguments, not freeform text. A single textarea labeled "bullet points" will produce wildly inconsistent input -- some users will write one sentence, others will paste three paragraphs. The quality of the generated thesis depends heavily on input quality, but the form gives no guidance.

2. **60 seconds is a long time to stare at a spinner.** The PRD says "show a loading state" but does not address what that looks like. A generic spinner for a full minute will feel broken.

**Proposed fix for input:**
- Replace the single textarea with **3-5 prompted input fields**: "What is the core investment thesis in one sentence?", "What are the key arguments for this position? (one per line)", "What is the expected return or price target?", "What are the main risks you see?"
- Alternatively, keep the single textarea but add **placeholder text that models good input**: "e.g., Strong pricing power in inflationary environment. Market share gains of 3pp in Q1. FCF yield of 8% supports buyback program. Risk: regulatory review in EU expected Q3 2026."

**Proposed fix for loading:**
- Show a **multi-step progress indicator**: "Searching for market data..." then "Analysing broker research..." then "Generating thesis pillars..." then "Formatting document..." This gives the user confidence the system is working and sets expectations for the wait.
- Consider generating and displaying sections **incrementally** -- show the Investment Thesis summary as soon as it is ready while the Quality Assessment is still generating.

#### Problem 3: Bulk upload UX is underspecified and potentially frustrating

The PRD describes: upload a file, validate rows, show progress ("Generating 12 of 47..."), allow cancel. But consider the actual user experience:

- User uploads 50 holdings. Generation takes up to 60 seconds each. Even with parallelism, this could take 5-10 minutes.
- "Generating 12 of 47" gives no time estimate.
- If rows 3, 17, and 29 fail, how does the user fix them? Re-upload the entire file? Edit inline?
- What happens if the user navigates away during bulk generation?

**Proposed fix:**
- Show an **estimated time remaining** based on average generation time so far.
- After completion, show a **results summary table** with per-row status: green check / red X / yellow warning. Failed rows should show the specific error and offer a **"Retry"** button per row or a **"Retry All Failed"** button.
- Bulk generation should continue in the background if the user navigates to the dashboard. Show a persistent **progress banner** at the top of the dashboard: "Bulk import: 34 of 47 complete. 2 failed. [View Details]"
- Do NOT require re-uploading the file to fix failed rows. Let the user fix the input inline in the results table and retry.

#### Problem 4: Inline editing of AI-generated content is harder than it sounds

The PRD says "every text section of the thesis is editable" with auto-save. But the thesis has structured sections with specific formatting expectations (pillar titles, bullet-pointed assumptions, severity-rated risks). What does "inline editing" actually mean here?

- Can the user edit a pillar title? Add a new pillar? Delete one?
- Can the user reorder pillars?
- Can the user change risk severity ratings?
- Is the editing experience rich text, markdown, or plain text?

**Proposed fix:** Define two editing modes:
1. **Section-level editing**: Click a section, it becomes an editable text block. This works for the narrative sections (Investment Thesis, pillar descriptions).
2. **Structured editing**: For pillars, assumptions, and risks, use structured inputs -- each item is a discrete editable row with add/remove/reorder controls. Do not make the user edit a formatted text blob to change a pillar title.

The editing paradigm should feel like **Notion** (click to edit, structured blocks) rather than **Google Docs** (free-form rich text everywhere).

#### Problem 5: The weekly log table will not scale

The PRD shows the weekly log as a table with columns: Week, Price, vs Index, Thesis Impact, Summary. The "Summary" column contains 2-3 sentences referencing specific pillars. In a table cell, this will either:
- Truncate the text and require hover/click to expand (annoying for scanning), or
- Make every table row extremely tall (breaks the "scannable in 10 seconds" goal)

**Proposed fix:** Use a **two-tier layout** for each weekly log entry:
- **Top line (table-like)**: Date | Price change | vs Index | Impact badge (Strengthened/Weakened/Unchanged as a colored chip)
- **Below the line (expandable)**: The 2-3 sentence narrative summary, with pillar/assumption references as inline links or bold text

This gives users the quick-scan number view they want (like a Bloomberg price table) while preserving the qualitative detail. Default state: collapsed. Most recent 4 weeks: expanded.

#### Problem 6: Broker research upload lacks context about WHEN to upload

The PRD says users can upload PDFs/DOCX and associate them with a holding. But the workflow is unclear:
- Do users upload research before generating a thesis? During? After?
- Is there a prompt during thesis generation that says "Do you have broker research to include?"
- How does the user know the uploaded research was actually incorporated?

**Proposed fix:**
- During the "Add Holding" flow, include an **optional file upload step** after the bullet points: "Have broker research? Drop it here. (Optional -- you can add this later.)"
- On the thesis document view, show a **"Research" sidebar or section** listing all uploaded documents with their upload date and a badge: "Used in thesis generation" or "Used in weekly update (Week of 2026-04-07)".
- After weekly monitoring runs, if broker research was cited, highlight this in the log entry.

#### Problem 7: No explicit "re-generate" or "refresh thesis" action

What happens when a fund manager's thesis fundamentally changes? Say they initially went long on AAPL for hardware innovation, but now they are long for services revenue. The PRD only describes initial generation and weekly log appending. There is no described workflow for:
- Regenerating the thesis with new bullet points
- Updating the core thesis while preserving the weekly log history
- Marking the old thesis as superseded

**Proposed fix:** Add a **"Revise Thesis"** action on the thesis view. This opens the original input form pre-filled with the current thesis content. The user edits their bullets, and the AI regenerates the thesis. The previous version is archived (visible in a "Previous Versions" dropdown). The weekly log continues uninterrupted.

#### Problem 8: Dashboard needs more at-a-glance information

The PRD dashboard shows: Ticker, Company Name, Direction, Date Generated, Last Updated, Latest Status. This is a start but misses what fund managers actually want to see at a glance:
- **Current price and weekly return** -- this is the first thing any PM checks
- **Number of weekly logs** -- is this a new holding or one that has been tracked for months?
- The "Latest Status" (Strengthened/Weakened/Unchanged) needs visual weight -- color coding at minimum

**Proposed fix:** Add columns for "Last Price" and "Week Change (%)" to the dashboard table. Use color coding: green for strengthened, red for weakened, grey for unchanged. Make the status column the most visually prominent. Consider a small inline sparkline for price trend (last 8 weeks) if technically feasible.

#### Problem 9: No search or filter on the dashboard

A fund manager with 80 holdings needs to find a specific stock quickly. The PRD mentions sorting but not searching or filtering. Bloomberg users expect to type a ticker and jump to it instantly.

**Proposed fix:** Add a **keyboard-accessible search/filter bar** at the top of the dashboard. Typing filters the table in real time (like Excel's filter). Support filtering by: ticker, company name, direction, status. Consider keyboard shortcut (Cmd+K or /) to focus the search bar -- this is what power users expect.

#### Problem 10: The configurable benchmark index (R11) is an afterthought

The PRD puts benchmark configuration in P1 (nice-to-have) but the thesis template SHOWS the benchmark in the header and every weekly log entry uses it. If the benchmark is not configurable at launch, every non-US holding will show meaningless relative performance against the S&P 500. A UK fund manager tracking FTSE stocks against the S&P is useless.

**Proposed fix:** Move R11 to P0. At minimum, allow the user to set a default benchmark in their settings and override it per holding at generation time. The "Add Holding" form should include a benchmark dropdown defaulting to the user's configured default.

---

## Part 2: Screen-by-Screen UX Copy

### Dashboard

**Page title:** `Holdings`

**Column headers:**
| Ticker | Company | Direction | Thesis Date | Last Update | Status | Week Chg |
|--------|---------|-----------|-------------|-------------|--------|----------|

**Empty state (no holdings yet):**
> **No holdings yet.**
> Add your first holding to generate an investment thesis.
> [+ Add Holding]
>
> Or import your portfolio from a spreadsheet.
> [Upload Spreadsheet]

**Empty state (holdings exist but no weekly updates yet):**
> Weekly monitoring has not run yet. Updates are generated every Monday at 6:00 AM.

**Status badges:**
- `Strengthened` (green background, dark green text)
- `Weakened` (red background, dark red text)
- `Unchanged` (grey background, dark grey text)
- `Generating...` (blue background, pulsing)
- `New` (outline only, appears before first weekly run)

**Search bar placeholder:** `Search holdings by ticker or company name...`

**Filter chips:** `All` | `Long` | `Short` | `Strengthened` | `Weakened` | `Unchanged`

**Sorting:** Click any column header to sort. Active sort column shows an arrow indicator. Default sort: alphabetical by ticker.

---

### Add Holding Flow

**Trigger:** `+ Add Holding` button (top right of dashboard, always visible)

**Modal or dedicated page title:** `Add Holding`

**Form fields:**

1. **Ticker**
   - Label: `Ticker`
   - Placeholder: `e.g., AAPL, TSLA, VOD.L`
   - Validation error: `Enter a valid ticker symbol.`
   - Helper text (below field): `Use the exchange-specific format for non-US stocks (e.g., VOD.L for London).`

2. **Direction**
   - Label: `Position`
   - Options: `Long` / `Short` (toggle or segmented control, not a dropdown)
   - Default: `Long`

3. **Benchmark Index**
   - Label: `Benchmark`
   - Placeholder: `S&P 500`
   - Helper text: `Performance will be measured against this index.`
   - Options: S&P 500, NASDAQ Composite, FTSE 100, Euro Stoxx 50, Nikkei 225, Hang Seng, ASX 200, Custom...

4. **Thesis Bullets**
   - Label: `Your investment thesis`
   - Placeholder:
     ```
     Write your key arguments for this position, one per line.

     Example:
     Strong pricing power -- raised prices 8% with no volume loss
     Market share gains of 3pp in Q1, driven by new product launch
     FCF yield of 8% supports aggressive buyback program
     Key risk: EU regulatory review expected Q3 2026
     ```
   - Helper text: `The more specific you are, the better the generated thesis. Include your conviction, key data points, and known risks.`

5. **Broker Research (optional)**
   - Label: `Broker Research`
   - Drop zone text: `Drag and drop PDF or DOCX files here, or click to browse.`
   - Constraint text: `PDF or DOCX, up to 50 MB per file.`
   - After upload, show filename with a remove icon.

**Buttons:**
- Primary: `Generate Thesis`
- Secondary: `Cancel`

**Validation state (missing required fields):**
- Ticker empty: `Ticker is required.`
- Thesis bullets empty: `Enter at least one argument for your thesis.`

---

### Generation Loading State

**Title:** `Generating thesis for [TICKER]`

**Progress steps (appear sequentially as each completes):**
1. `Searching for latest market data...` (active: spinner; done: checkmark)
2. `Analysing broker research...` (only if files uploaded)
3. `Building thesis pillars...`
4. `Assessing financial quality...`
5. `Compiling thesis document...`

**Subtext:** `This typically takes 30-60 seconds.`

**Cancel link:** `Cancel generation`

**On completion:** Auto-navigate to the generated thesis. Brief success toast: `Thesis generated for [TICKER].`

---

### Bulk Upload Flow

**Trigger:** `Upload Spreadsheet` button (secondary action on dashboard, or accessible from Add Holding modal)

**Page/modal title:** `Import Holdings from Spreadsheet`

**Instructions:**
> Upload an Excel (.xlsx) or CSV file with your holdings. Each row becomes a thesis.
>
> **Required columns:** Ticker, Direction (Long or Short), Thesis Bullets
>
> [Download Template] (.xlsx)

**Drop zone text:** `Drag and drop your file here, or click to browse.`
**Constraint text:** `.xlsx or .csv files only`

**Validation phase (after upload, before generation):**

Title: `Reviewing your file...`

**Validation results (success):**
> **47 holdings found.** Ready to generate.
>
> | # | Ticker | Direction | Bullets Preview | |
> |---|--------|-----------|-----------------|------|
> | 1 | AAPL | Long | Strong pricing power, market... | [Remove] |
> | 2 | TSLA | Short | Margin compression from price... | [Remove] |
> ...
>
> [Generate All] [Cancel]

**Validation results (with errors):**
> **47 rows found. 3 need attention.**
>
> Rows with errors are highlighted. Fix them below or remove them to continue.
>
> | # | Ticker | Direction | Bullets | Issue |
> |---|--------|-----------|---------|-------|
> | 7 | *(empty)* | Long | Thesis text here... | `Missing ticker` |
> | 23| MSFT | *(empty)* | Thesis text here... | `Missing direction` |
> | 31| GOOG | Long | *(empty)* | `No thesis provided` |
>
> [Fix and Continue] [Skip Errors and Generate 44] [Cancel]

**During bulk generation:**

Persistent banner (stays visible even if user navigates away):
> `Generating theses: 12 of 47 complete.`
> Progress bar: [========================____________________] 26%
> `Estimated time remaining: 4 minutes`
> [Cancel Remaining]

**On completion (all successful):**
> **All 47 theses generated successfully.**
> [View Dashboard]

**On completion (with failures):**
> **44 of 47 theses generated. 3 failed.**
>
> | Ticker | Error | |
> |--------|-------|---|
> | XYZ | No market data found for this ticker. | [Retry] |
> | ABC | Generation timed out. | [Retry] |
> | DEF | Unable to parse broker research file. | [Retry] |
>
> [Retry All Failed] [View Dashboard]

---

### Thesis Document View

**Header bar:**
```
[Back arrow] Holdings / AAPL

Apple Inc. (AAPL)                                    Long
Generated: 2026-04-10 | Benchmark: S&P 500          [Revise Thesis] [Export PDF]
```

**Section navigation (tabs or anchored links):**
`Summary` | `Pillars` | `Quality` | `Valuation` | `Assumptions & Risks` | `Sources` | `Weekly Log (12)`

The number in parentheses after "Weekly Log" shows how many entries exist.

**Section headers as they appear in the UI:**

1. **Investment Thesis** -- displayed as the summary/overview section
   - No explicit header needed if it is the first thing on the page. If a header is used: `Investment Thesis`

2. **Thesis Pillars**
   - Section header: `Thesis Pillars`
   - Each pillar shows as a card or block:
     ```
     Pillar 1
     Pricing Power in Inflationary Environment
     [2-3 sentences of supporting evidence]
     ```
   - Edit affordance: click the pillar title or body to edit inline. "Add Pillar" link at the bottom of the section if fewer than 5 exist.

3. **Quality Assessment**
   - Section header: `Quality Assessment`
   - Sub-labels: `Financial Strength` | `Competitive Position` | `ESG & Governance`

4. **Valuation & Expected Return**
   - Section header: `Valuation & Expected Return`
   - Sub-labels: `Current Price` | `Investment Goal` | `Upside Case` | `Base Case` | `Downside Case`

5. **Key Assumptions**
   - Section header: `Key Assumptions`
   - Each assumption is a discrete item with a bullet. Editable individually. "Add Assumption" link at the bottom.

6. **Risks**
   - Section header: `Risks`
   - Each risk shows as: `[Risk description]` with a severity badge: `High` / `Medium` / `Low`
   - "Add Risk" link at the bottom.

7. **Sources**
   - Section header: `Sources & Research`
   - Web sources show as linked text with date.
   - Broker research shows with a document icon and filename.

8. **Weekly Log**
   - Section header: `Weekly Log`
   - See weekly log presentation below.

**Inline editing states:**
- Hover: subtle border or highlight appears around the editable block
- Active: block becomes a text input/textarea with the current content
- Saving: brief "Saving..." indicator (small, non-blocking, near the edited block)
- Saved: indicator disappears. No confirmation modal. No toast.

**Edit helper text (shown once, dismissible):**
> Click any section to edit. Changes save automatically.

---

### Weekly Log Entry Presentation

Each entry uses a two-tier layout:

**Tier 1 (always visible, single line):**
```
Week of Apr 7, 2026    +3.2%    vs S&P: +1.8%    [Strengthened]
```

Date is left-aligned. Price changes are monospaced for alignment. The status badge is color-coded (green/red/grey). Positive numbers prefixed with `+`. Negative numbers prefixed with `-`.

**Tier 2 (expandable, shown by default for the most recent 4 entries):**
> **Pillar 2 strengthened:** Q1 earnings confirmed 3 percentage point market share gain, driven by new product launch in Western Europe. **Assumption 1 intact** -- revenue grew 14% YoY, above the 10% threshold. Risk 1 unchanged -- no regulatory action announced.
>
> *Sources: Reuters (Apr 5), Morgan Stanley note (Apr 3)*

**Collapsed state (older entries):** Only Tier 1 is visible. Click to expand.

**Empty state (no weekly logs yet):**
> No weekly updates yet. The first update will appear after the next scheduled monitoring run on Monday, April 20.

**If price data was unavailable:**
```
Week of Apr 7, 2026    Price unavailable    [Unchanged]
```
Narrative summary still appears in Tier 2.

---

### Broker Research Upload Area

**On the thesis document view, as a sidebar or collapsible section:**

Section header: `Broker Research`

**Empty state:**
> No research uploaded for this holding.
> Upload broker PDFs or reports to improve thesis quality and weekly analysis.
> [Upload Files]

**Drop zone (when expanded or triggered):**
> Drag and drop files here, or click to browse.
> PDF or DOCX, up to 50 MB per file.

**After upload, file list:**
```
Morgan_Stanley_AAPL_Q1_2026.pdf     12.4 MB    Uploaded Apr 3    [Delete]
Goldman_Sachs_Tech_Sector_Mar26.pdf   8.1 MB    Uploaded Mar 15   [Delete]
```

**Upload progress:** `Uploading Morgan_Stanley_AAPL_Q1_2026.pdf... 67%`

**Upload success:** `File uploaded and indexed. It will be used in future thesis generation and weekly analysis.`

**Upload error (wrong file type):** `This file type is not supported. Please upload a PDF or DOCX file.`

**Upload error (too large):** `This file exceeds the 50 MB limit. Try a smaller file or compress the PDF.`

**Upload error (parsing failed):** `We could not read this file. It may be scanned or image-only. Try a text-based PDF.`

**Delete confirmation:** `Remove Goldman_Sachs_Tech_Sector_Mar26.pdf? This file will no longer be used in weekly analysis.` [Remove] [Keep]

---

### Loading and Generating States

**Single thesis generation:** (See "Generation Loading State" above)

**Bulk generation:** (See "Bulk Upload Flow" above)

**Weekly monitoring in progress (if user happens to be online):**
Dashboard banner:
> `Weekly analysis in progress. Updates will appear as they complete.`

Individual holding row during update:
Status column shows: `Updating...` with a subtle spinner.

**Thesis document loading:**
> Skeleton screen showing the document structure (header, section blocks) with pulsing placeholder bars. No spinner. The structure should be immediately recognizable as a thesis layout.

**Dashboard loading:**
> Skeleton table with pulsing rows. Column headers are visible immediately.

---

### Error Messages

**Thesis generation failed:**
> **Could not generate thesis for [TICKER].**
> [Specific reason if available, e.g., "No market data found for this ticker." or "The AI service is temporarily unavailable."]
> [Try Again] [Edit Input and Retry]

**Weekly monitoring failed for a holding:**
Log entry appears as:
```
Week of Apr 7, 2026    --    --    [Update Failed]
```
Expanding shows: `Weekly analysis could not be completed. Reason: [specific error]. This will be retried automatically.`

**File upload failed:**
> `Upload failed. [Specific reason]. Please try again.`

**Network/connection error:**
> `Connection lost. Your recent edits are saved locally and will sync when the connection is restored.`

**Session timeout:**
> `Your session has expired. Please refresh to continue. Your work has been saved.`

**Invalid ticker (during add holding):**
> `We could not find market data for "[TICKER]". Check the symbol and try again. For non-US stocks, include the exchange suffix (e.g., VOD.L).`

**Bulk upload file format error:**
> `This file does not match the expected format. Please use the [template] and ensure your file has columns for Ticker, Direction, and Thesis Bullets.`

**Rate limit / AI service overloaded:**
> `The AI service is handling a high volume of requests. Your thesis will be generated shortly. Estimated wait: [X] minutes.`

**Generic fallback (should rarely be seen):**
> `Something went wrong. Please try again. If this continues, contact support.`

---

## Part 3: Accessibility Notes

### Data Tables (Holdings Dashboard)

**Keyboard navigation:**
- The holdings table MUST be navigable with Tab/Shift+Tab between interactive elements (sort buttons, row links, action buttons).
- Sort controls on column headers must be operable with Enter/Space.
- Each row should be a link or contain a focusable element that navigates to the thesis view. Do not rely on click handlers on `<tr>` elements alone -- these are not keyboard accessible.
- Screen readers need `<th scope="col">` on column headers and a `<caption>` element: "Portfolio holdings with thesis status and recent performance."

**Color and contrast:**
- The status badges (Strengthened/Weakened/Unchanged) use color coding (green/red/grey). These MUST also include text labels -- color alone is insufficient for colorblind users. The text labels "Strengthened", "Weakened", "Unchanged" already serve this purpose, but ensure the text is always visible (not hidden by CSS and replaced with color-only dots or icons).
- Price change percentages with + / - and red/green coloring: the + / - prefix already differentiates direction, but verify that the red and green colors meet WCAG AA contrast ratio (4.5:1) against their background. Standard "traffic light" red and green often fail this on white backgrounds. Use darker variants: e.g., #1a7f37 for green, #cf222e for red.

**Responsive behavior:**
- The dashboard table should handle horizontal overflow gracefully on smaller screens. Consider a sticky first column (Ticker) so users can scroll horizontally without losing context. This is standard in financial data tables.

### File Upload (Bulk Upload, Broker Research)

**Drag-and-drop accessibility:**
- Drag-and-drop zones MUST have a keyboard-accessible alternative. The "or click to browse" text addresses this, but the underlying `<input type="file">` must be reachable by keyboard (Tab to focus, Enter/Space to activate).
- The drop zone should have `role="button"` and `aria-label="Upload file. Drag and drop or press Enter to browse."` so screen readers announce it clearly.
- Upload progress must be announced to screen readers. Use `aria-live="polite"` on the progress indicator or `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`.

**File validation feedback:**
- Error messages for invalid files must be associated with the upload control using `aria-describedby` or `aria-errormessage`. Do not rely on a red border alone.
- Success messages (file uploaded and indexed) should use `aria-live="polite"` for screen reader announcement.

### Inline Editing (Thesis Document)

**This is the highest accessibility risk in the application.** Inline editing is notoriously difficult to make accessible. Key concerns:

1. **Discoverability:** Sighted users discover editable regions through hover effects (subtle border on hover). Keyboard and screen reader users have no equivalent of "hover." Every editable section must be focusable (Tab navigable) and announce its editable state. Use `role="button"` or `aria-label="Edit [section name]. Click or press Enter to edit."` on each editable block.

2. **Mode switching:** When a user activates an editable section, the content transforms from display text to a textarea/input. This mode switch must be announced to screen readers: `aria-live="assertive"` region or focus management that moves focus into the newly active input.

3. **Save confirmation:** Auto-save is convenient but invisible. Screen reader users need an announcement when save completes. Use a visually hidden `aria-live="polite"` region that says "Changes saved" after each auto-save. Do not announce on every keystroke -- debounce to when the save actually fires.

4. **Escape to cancel:** Users must be able to press Escape to exit edit mode without saving changes. This is a standard interaction pattern for inline editing. The PRD does not mention undo/cancel -- add it.

5. **Structured editing (pillars, assumptions, risks):** If these use add/remove/reorder controls, each control needs proper labeling:
   - "Remove Pillar 2: Structural Market Share Gains" (not just a generic trash icon)
   - "Move Pillar 2 up" / "Move Pillar 2 down" (not just drag handles -- drag-and-drop reordering is not accessible)
   - "Add new pillar after Pillar 3"

**Recommendation:** Provide keyboard-only reordering as the primary mechanism (Up/Down arrow keys or explicit "Move Up"/"Move Down" buttons). Drag-and-drop can be layered on top as an enhancement for mouse users.

### PDF-Style Document View (Thesis)

**Document structure:**
- The thesis document view should use semantic HTML heading hierarchy: `<h1>` for the company name/ticker, `<h2>` for each section (Investment Thesis, Thesis Pillars, Quality Assessment, etc.), `<h3>` for individual pillar titles.
- Screen reader users should be able to navigate by heading (a core screen reader navigation pattern). This makes the thesis scannable for assistive technology just as the visual layout makes it scannable for sighted users.

**Section navigation:**
- If using tabs or anchor links for section navigation (as recommended in the critique), use proper `role="tablist"`, `role="tab"`, `role="tabpanel"` ARIA patterns, or use a `<nav>` with anchor links and `aria-label="Thesis sections"`.
- The active/selected tab must be indicated with `aria-selected="true"` and not just a visual underline.

**Weekly log entries:**
- Expandable/collapsible log entries should use `<details>/<summary>` elements or the disclosure pattern with `aria-expanded="true/false"`. This tells screen reader users whether an entry is expanded or collapsed.
- The status badge within each entry should not rely on color alone (addressed above). Consider adding a visually hidden prefix: `<span class="sr-only">Status:</span> Strengthened`.

### General Accessibility Notes

**Focus management:**
- When a modal opens (Add Holding, bulk upload), focus must move to the modal and be trapped within it until closed. On close, focus returns to the trigger element.
- When navigating from the dashboard to a thesis view, focus should move to the thesis page heading.
- After thesis generation completes and the user is auto-navigated, focus should land on the thesis document heading, not on a random element.

**Motion and animation:**
- Skeleton loading screens and pulsing progress indicators should respect `prefers-reduced-motion`. Users who have enabled reduced motion should see static placeholders instead of pulsing animations.

**Text sizing:**
- Financial data (prices, percentages, dates) is often displayed in small type. Ensure all text meets a minimum of 14px rendered size and that the layout does not break when users zoom to 200% (WCAG AA requirement).

**Touch targets (future mobile consideration):**
- Although mobile is a non-goal for v1, the web app may be accessed on tablets. Ensure interactive elements (buttons, sort headers, expand/collapse toggles) have a minimum 44x44px touch target. This also benefits users with motor impairments using a mouse.

**Language and reading level:**
- The UX copy in this document uses plain language appropriate for the audience. Avoid introducing technical jargon in error messages. "The AI service is temporarily unavailable" is better than "LLM inference endpoint returned 503." The PRD's own UX principles already call for this, but it is worth reinforcing as an accessibility consideration -- plain language benefits users with cognitive disabilities and non-native English speakers.

---

*End of UX Design Review. This document should be treated as a living reference alongside the PRD. Update as design decisions are made and prototypes are tested.*
