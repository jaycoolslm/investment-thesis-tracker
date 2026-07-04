# Test Coverage Gap Audit — Sprint 9

Generated 2026-04-17. Based on unit + integration coverage reports.

> Amended 2026-07-04 (simplification spec 06): the worst gaps below are closed
> or moot. `file-parser.ts` is now a small hand-rolled CSV parser with 21 unit
> tests; `routes/bulk.ts` has integration tests (preview, Excel rejection,
> start with excluded rows, template download); `template-generator.ts`,
> `BulkValidationTable`, and the queue workers no longer exist. The tables
> below are kept as the historical Sprint 9 snapshot.

## Current Test Counts

| Layer | Files | Tests |
|-------|-------|-------|
| Backend unit | 8 | 78 |
| Backend integration | 7 | 42 |
| Frontend component | 3 | 22 |
| E2E (Playwright) | 3 | 9 |
| **Total** | **21** | **151** |

## Combined Coverage (Unit + Integration)

| Area | Stmts | Branch | Lines | Rating |
|------|-------|--------|-------|--------|
| Agent (codex-agent, prompts, schemas) | 87% | 78% | 89% | Good |
| Services (email-template, market-data) | 92-96% | 75-95% | 92-96% | Good |
| Services (weekly-monitoring) | 83% | 64% | 83% | Good |
| Routes (holdings, theses, generation) | 56-76% | 50-65% | 58-78% | Moderate |
| Routes (monitoring) | 53% | 38% | 55% | Moderate |
| Scheduler | 50% | 38% | 50% | Moderate |
| Routes (bulk) | 11% | 0% | 11% | Critical gap |
| Routes (documents) | 18-31% | 0-13% | 19-31% | Critical gap |
| Services (file-parser) | 2% | 0% | 2% | Critical gap |
| Services (bulk-generation) | 52-65% | 23-27% | 53-68% | Gap |
| Services (template-generator) | 6% | 0% | 7% | Critical gap |
| Jobs (queue, workers) | 11% | 0% | 13% | Critical gap |

## Prioritized Gaps

### High Priority (data correctness / user-facing features)

| Module | Current Coverage | Recommended Tests | Est. Count |
|--------|-----------------|-------------------|------------|
| `src/routes/bulk.ts` | 11% stmts | Integration: parse, start, progress SSE, cancel, retry, template download | 8-10 |
| `src/services/file-parser.ts` | 2% stmts | Unit: CSV/XLSX parsing, column normalization, validation errors, empty rows | 8-10 |
| `src/routes/documents.ts` | 18% stmts | Integration: upload PDF/DOCX, list, delete, file type rejection, size limits | 5-6 |
| `src/services/bulk-generation.ts` | 52% stmts | Integration: batch state in Redis, exclude rows, transaction rollback | 4-5 |

### Medium Priority (operational integrity)

| Module | Current Coverage | Recommended Tests | Est. Count |
|--------|-----------------|-------------------|------------|
| `src/jobs/scheduler.ts` | 50% stmts | Unit: cron validation, stopScheduler; partially covered via monitoring tests | 3-4 |
| `src/jobs/bulk-worker.ts` | 0% stmts | Unit: job processing, retry logic, batch state updates, progress emission | 4-5 |
| `src/jobs/weekly-worker.ts` | 0% stmts | Unit: job processing, digest emission on batch completion | 3-4 |
| `src/services/template-generator.ts` | 6% stmts | Unit: Excel template generation, column headers, sample data | 2-3 |
| `src/services/email.ts` | 54% stmts | Integration: digest query, HTML rendering with real data, SMTP skip logic | 3-4 |

### Low Priority (infrastructure / UI polish)

| Module | Current Coverage | Recommended Tests | Est. Count |
|--------|-----------------|-------------------|------------|
| `web/src/components/HoldingsTable.tsx` | 0% | Component: search, sort, filter, row click, delete | 6-8 |
| `web/src/components/MonitoringHistory.tsx` | 0% | Component: batch history rendering, empty state | 3-4 |
| `web/src/components/BulkUploadModal.tsx` | 0% | Component: multi-step flow, validation, file drop | 5-6 |
| `web/src/components/BulkProgressBanner.tsx` | 0% | Component: progress bar, ETA, cancel button | 3-4 |
| `src/progress.ts` | 0% | Unit: event emitter singleton | 1-2 |
| `src/config.ts` | 75% | Unit: Zod validation, missing vars | 2-3 |

## Frontend Coverage Summary

| Component | Has Tests? | Priority |
|-----------|-----------|----------|
| AddHoldingModal | Yes (9 tests) | - |
| GenerationProgress | Yes (8 tests) | - |
| WeeklyLogTable | Yes (9 tests) | - |
| HoldingsTable | No | Low |
| MonitoringHistory | No | Low |
| BulkUploadModal | No | Low |
| BulkValidationTable | No | Low |
| BulkProgressBanner | No | Low |
| BulkResultsModal | No | Low |
| thesis/* editors | No | Low |

## Recommendations for Sprint 10+

1. **Immediate (Sprint 10)**: Add file-parser unit tests and bulk route integration tests — these are the highest-risk untested paths with complex parsing and validation logic.

2. **Next (Sprint 11)**: Add document upload integration tests and worker unit tests — these cover operational paths that could silently fail in production.

3. **Deferred**: Frontend component tests for dashboard components — lower risk since they're primarily display logic backed by tested API endpoints.

4. **Layer 5 (Prompt Regression)**: Set up `src/agent/__evals__/` directory with golden fixtures and a `run-evals.ts` script for manual prompt regression testing. This is NOT automated CI — it's a developer workflow for validating prompt changes.

5. **Layer 6 (Migration Smoke)**: Add one test: fresh Postgres → run all migrations → should not throw. Trivial to implement, catches the worst DB deployment bugs.
