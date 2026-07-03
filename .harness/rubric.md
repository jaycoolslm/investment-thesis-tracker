# Rubric

What the Evaluator grades against. Three layers:

1. **Spec criteria** — the numbered acceptance criteria in the current spec file.
   Graded one by one; not duplicated here.
2. **Hard gates** — always-on. A gate failure is an automatic FAIL even if the spec
   is otherwise satisfied. If a gate conflicts with a spec decision, the gate wins and
   the spec is recorded as the root defect.
3. **Quality bar** — a qualitative PASS/FAIL judgement. A build can be fully
   spec-conformant and still FAIL here.

---

## 2. Hard gates (always-on — auto-FAIL)

**G1 · Type-safety.** `npx tsc --noEmit` passes in the repo root AND in `web/`.

**G2 · All test suites green.** Run and confirm each yourself:
- `pnpm test` (backend unit)
- `pnpm test:integration` (Testcontainers; Docker must be running)
- `cd web && pnpm test` (frontend)
- `pnpm test:e2e` (Playwright, `MOCK_AGENT=true`; `docker compose up -d --build` first)
Skipped/`.todo`'d tests introduced to force green count as a failure. Test counts may
legitimately *drop* when a spec deletes a feature — deleted tests for deleted
behaviour are correct, not a gap.

**G3 · Nothing half-removed.** When a spec deletes something, zero traces remain:
no orphaned files, imports, routes, components, or hooks; no unused entries in either
`package.json` (lockfiles updated via pnpm, not hand-edited); no dead env vars in
`src/config.ts` / `.env.example`; no dead services in `docker-compose.yml` /
`Dockerfile`; no stale mentions in `CLAUDE.md` or `README.md`. Verify by grepping for
the removed names.

**G4 · The app actually runs.** `docker compose up -d --build` boots cleanly (API
healthy, no crash-loop in `docker compose logs api`); with `MOCK_AGENT=true` the
frontend loads the dashboard, a thesis detail page renders, and the browser console
shows no uncaught errors on those pages.

**G5 · Migration safety.** Every schema change ships a Drizzle migration; `pnpm
db:migrate` runs cleanly on both a fresh database and one carrying pre-change data
(the spec's data-backfill requirements are criteria; losing existing thesis/log data
silently is a gate failure). `src/db/schema.ts` and `src/db/migrations/` agree.

**G6 · Docs truthful.** `CLAUDE.md` (Project Status, Tech Stack, Project Structure,
Running Locally/Tests) and `README.md` describe the repo as it now is — no references
to removed tables, deps, services, endpoints, or files.

---

## 3. Quality bar (qualitative PASS/FAIL)

- **Q1 · Net simplification (highest weight).** The diff removes more than it adds
  (line count, dependency count, moving parts). Removed complexity is not smuggled
  back under a new name (a new queue lib, a new rich-text editor, a hand-rolled
  BullMQ). New abstractions introduced by a spec (e.g. the batch runner) stay at the
  small size the spec sketches — no speculative generality.
- **Q2 · Surviving UX holds up.** Users are non-technical fund managers. After the
  simplification, the affected flows still read clearly: no raw markdown/markup shown
  as literal text where rendering is expected, no dead buttons pointing at removed
  endpoints, loading/empty/error states intact, finance vocabulary preserved.
- **Q3 · Idiomatic with the codebase.** Changes follow the repo's existing
  conventions (Drizzle-only DB access, Zod validation at boundaries, TanStack Query
  on the frontend, Radix primitives, design tokens not raw hex).
- **Q4 · Honest tests.** Updated tests genuinely exercise the new behaviour rather
  than asserting around it.

A PASS requires Q1 and Q2 to be genuinely good — not merely "not broken." When in
doubt, it is not a PASS.
