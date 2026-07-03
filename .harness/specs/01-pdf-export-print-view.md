# Spec 01 — Replace @react-pdf/renderer with a browser print view

<!--
  Simplification programme — spec 1 of 7. Specs are cumulative and ordered.
  This one runs FIRST deliberately: spec 02 replaces the structured thesis with a
  markdown document, and we don't want anyone rewriting ThesisPdf.tsx for a data
  model that's about to disappear. Once export is "print the web page", spec 02's
  UI change updates the export for free.
-->

## Context

Sprint 10 added `GET /api/holdings/:id/export/pdf` rendering a full thesis PDF via
`@react-pdf/renderer`. That pulled React 19 into the *backend* as a runtime dep,
enabled server-side TSX (`jsx: "react-jsx"` in the backend tsconfig), vendored Inter
WOFF fonts, and depends on the `yoga-layout` native binary working on Alpine. All of
that infrastructure exists to lay out a document the browser can already lay out.
Replace it with a print-friendly view of the thesis page: the "Export PDF" button
opens a print-ready route and triggers the browser's print dialog (Save as PDF).

## Existing implementation & what changes

**Keep (reuse as-is — do NOT touch):**
- `web/src/pages/ThesisDetailPage.tsx` tab content components — the print view reuses
  the same data hooks (`useThesis`, `useHolding`, `useWeeklyLogs`) and the same
  section components in read-only form where practical.
- All thesis/holdings API routes except the export route.

**Remove (completely):**
- `src/pdf/` — the whole directory: `styles.ts`, `html-to-text.ts`, `ThesisPdf.tsx`,
  `components/WeeklyLogTablePdf.tsx`, `fonts/` (including the OFL license file).
- `src/services/pdf-export.tsx`.
- The `GET /api/holdings/:id/export/pdf` route in `src/routes/holdings.ts` and its
  integration tests.
- Backend deps: `@react-pdf/renderer`, `react`, `react-dom` (and `@types/react`,
  `@types/react-dom` from backend devDeps if present) — via `pnpm remove` so the
  lockfile updates. NOTE: these stay in `web/package.json`, obviously.
- `"jsx": "react-jsx"` from the **backend** `tsconfig.json` (only if nothing else in
  the backend needs TSX after this — verify with `npx tsc --noEmit`).

**Add:**
- `web/src/pages/ThesisPrintPage.tsx` + route `/holdings/:id/print` in `App.tsx`: a
  single-scroll, print-oriented rendering of everything the PDF contained — header
  (ticker, company, direction, benchmark, status), summary, pillars, quality,
  valuation, assumptions, risks, sources, and the weekly log table. No tabs, no edit
  affordances, no app chrome (no nav header).
- A print stylesheet (Tailwind `print:` variants and/or an `@media print` block in
  `globals.css`): sensible page margins, `break-inside: avoid` on section blocks and
  table rows, monochrome-safe status badges (they already carry text labels), and the
  weekly-log table headers repeating across pages (`thead` with
  `display: table-header-group` — use a real `<table>` here, not a flexbox grid).
- On mount (once data is loaded) the page calls `window.print()`; it also shows a
  visible "Print / Save as PDF" button for re-triggering.

**Change:**
- The "Export PDF" anchor in the thesis detail header: point it at
  `/holdings/:id/print` (still `window.open` / `target="_blank"` is fine) instead of
  the API route.
- `CLAUDE.md`: Sprint 10 status paragraph, Tech Stack, Project Structure — remove all
  react-pdf material, describe the print view.

## Acceptance criteria

1. `src/pdf/` and `src/services/pdf-export.tsx` no longer exist; `grep -ri
   "react-pdf\|renderToBuffer\|yoga" src/ web/src/ CLAUDE.md README.md package.json`
   returns nothing.
2. Backend `package.json` no longer lists `react`, `react-dom`, or
   `@react-pdf/renderer`; `pnpm install` is clean; backend `npx tsc --noEmit` passes.
3. `GET /api/holdings/:id/export/pdf` returns 404 (route gone); the integration tests
   that covered it are deleted.
4. Visiting `/holdings/:id/print` for a holding with a thesis (MOCK_AGENT data is
   fine) renders every section listed above in one scroll with no app navigation
   chrome, and the browser print preview paginates cleanly (no clipped sections,
   weekly-log header repeats).
5. The "Export PDF" control on the thesis detail page opens the print view in a new
   tab.
6. A holding *without* a thesis: the print route shows a clear "no thesis yet"
   message rather than crashing or printing a blank page.
7. All four test suites green; a frontend test covers ThesisPrintPage rendering the
   main sections from mocked query data.
8. `docker compose build` succeeds (the Dockerfile no longer needs the yoga-layout
   native-binary consideration; remove any related comments).

## Out of scope

- Any change to the thesis data model or editors (spec 02).
- Styling beyond what print legibility requires.
