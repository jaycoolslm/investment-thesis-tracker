# Spec 06 — Bulk upload: CSV-only, no inline spreadsheet editing

<!--
  Simplification programme — spec 6 of 7. Assumes specs 04–05 landed (in-process
  batch runner, polling). This spec shrinks the bulk-upload surface: CSV in, clear
  validation out, no ExcelJS, no in-browser spreadsheet editing.
-->

## Context

Bulk upload currently supports .xlsx and .csv via ExcelJS, generates a downloadable
.xlsx template with ExcelJS, and offers inline editing of invalid rows in a TanStack
Table before generation. That's ~1,200 lines across backend and frontend — and
`TEST-GAPS.md` flags exactly this area as the least-tested code (bulk routes 11%,
file-parser 2%). The workflow it serves is "add N holdings from a list". CSV plus
honest error reporting covers it: a fund manager can export CSV from Excel in one
step, and fixing two bad rows in their own spreadsheet beats editing them in ours.

## Existing implementation & what changes

**Keep:**
- The overall flow: drop file → preview with validation → start generation →
  progress banner → results with per-row retry (all the spec-04/05 machinery).
- `FileDropZone` (configurable — just narrow its accepted types here).
- Per-row Zod validation rules (ticker required/format, direction long|short,
  bullets required) — the rules survive; only the parser feeding them changes.
- The batch runner + polling progress from specs 04–05, and `BulkResultsModal`
  with per-row retry.

**Change:**
- `src/services/file-parser.ts`: CSV only. Parse with plain string handling — split
  lines, handle quoted fields containing commas/newlines (a small hand-rolled RFC
  4180 parser, ~40 lines, with unit tests covering quotes, embedded commas, CRLF,
  BOM) or reuse an existing tiny helper already in the tree. **No ExcelJS, no new
  parsing dependency.** Reject non-CSV uploads (mime/extension) with a clear
  message telling the user to "Save as CSV" from Excel.
- `src/services/template-generator.ts`: replace with a constant CSV string (header
  row + one example row) served by the existing template endpoint as
  `text/csv` with a download filename. Delete ExcelJS usage.
- `pnpm remove exceljs` (backend).
- `BulkUploadModal` / `BulkValidationTable`: the preview still lists every parsed
  row with its validation errors, but **read-only** — no inline editing state, no
  editable cells. Invalid rows are clearly marked and excluded; the user either
  proceeds with the valid rows or fixes the file and re-uploads. Copy must say
  exactly that. If dropping inline editing makes `BulkValidationTable` trivial,
  fold it into the modal and delete the file.
- Frontend accepted file types: `.csv` only (drop-zone copy + accept attribute +
  template link text updated; no mention of Excel/.xlsx as an upload format).
- `CLAUDE.md`: Tech Stack (drop ExcelJS), Project Structure, bulk description.
  `TEST-GAPS.md`: update or delete the entries this spec makes moot.

## Acceptance criteria

1. `grep -ri "exceljs\|xlsx" src/ web/src/ e2e/ package.json web/package.json
   CLAUDE.md README.md` returns nothing (allow a "CSV (export from Excel)" phrasing
   in user-facing copy that names Excel without implying .xlsx upload support).
2. Uploading a valid CSV (including a value with a quoted comma, e.g. company name
   `"Smith, Jones & Co"`) previews correctly and generates holdings (mock) — e2e
   `bulk-upload.spec.ts` updated to use a CSV fixture and passes.
3. Uploading an .xlsx file is rejected before parsing with a human message telling
   the user to save as CSV — no stack trace, no silent failure.
4. A CSV with 2 valid + 1 invalid row: preview shows the invalid row flagged with
   its specific error, offers "Generate 2 valid holdings", and generation proceeds
   with exactly 2. No cell in the preview is editable.
5. The template endpoint returns `text/csv` with the documented columns; the
   frontend "download template" control fetches it and the file opens in Excel.
6. The hand-rolled CSV parser has direct unit tests (quotes, embedded commas, CRLF,
   BOM, empty trailing line) and file-parser coverage is no longer the worst in the
   repo (spot-check with `pnpm test -- --coverage` if configured, else by test count).
7. All four suites green; net LOC down.

## Out of scope

- Changing validation rules or the holdings created.
- Paste-a-list entry (possible future further cut; not this spec).
