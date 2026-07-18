# Implementation Brief — Thesis Tracker Changes

Small, surgical changes to this repo. Read `README.md`, `contracts.md`, and
`shared-types.ts` in this directory first. The weekly monitoring flow already does
the heavy lifting — **`src/services/weekly-monitoring.ts` already loads every
document for a holding and passes the file paths into the weekly prompt** — so the
tracker's job is only: accept markdown article uploads, label them sensibly, and
surface provider health.

## Scope

### 1. Accept `text/markdown` document uploads  (the linchpin)

`src/routes/documents.ts`:
- Add `"text/markdown"` to `ALLOWED_MIMETYPES`.
- Extend the `fileType` derivation (currently ternary pdf→"PDF" else "DOCX") to a
  lookup: `application/pdf`→`PDF`, docx mimetype→`DOCX`, `text/markdown`→`MD`.
- No schema change: `documents.fileType` is a plain `varchar(50)`.
- Keep the 50 MB limit and the multipart field name `file` exactly as they are —
  the mapping agent is built against them (`contracts.md` §4).

### 2. Weekly prompt wording

`src/agent/prompts.ts` (`buildWeeklyPrompt`, and the matching block in
`buildGenerationPrompt`): the file list is currently headed "BROKER RESEARCH FILES".
Mapper-uploaded articles are news, not broker research. Change the heading/lead-in to
cover both, e.g.:

```
CONTEXT DOCUMENTS (broker research and news articles saved for this holding — read these):
- <path>
…
Files named article__*.md are news articles matched to this holding; each has
frontmatter with the source URL and a `rationale` line explaining its relevance
to the thesis. Weigh them as evidence and cite their URLs in the sources.
```

Keep the interface (`researchFilePaths: string[]`) unchanged; only prompt text moves.

### 3. Provider health proxy + monitoring page card

- `src/config.ts`: add optional `DATA_PROVIDER_URL` (Zod: `z.string().url().optional()
  .or(z.literal(""))`, matching the Azure var pattern).
- `src/routes/monitoring.ts`: add `GET /api/provider/health` — when
  `DATA_PROVIDER_URL` unset → 503 `{ error: "Data provider not configured" }`;
  otherwise fetch `${DATA_PROVIDER_URL}/health` with a ~3 s timeout and relay the
  JSON; on fetch failure → 503 `{ error: "Data provider unreachable" }`.
- Frontend: a small provider-health card on the monitoring surface
  (`web/src/components/MonitoringHistory.tsx` area): last crawl time, new-article
  count, and an error state, driven by a new `useProviderHealth` TanStack Query hook
  (`refetchInterval` ~60 s; hide the card entirely on 503-not-configured). Follow
  existing patterns: `web/src/api/client.ts` for the fetch, status tokens for
  colours, text labels on any status badge.

### 4. Cosmetic: document list labelling (optional, small)

`web/src/components/thesis/BrokerResearchPanel.tsx` lists documents by filename.
`.md` article uploads will appear there — acceptable per the design. Optional nicety:
render `fileType === "MD"` rows with a "News article" tag so managers can tell them
from uploaded broker PDFs. Do not add delete-protection or new endpoints; the
existing delete flow applies (deleting one just removes it from future weekly-run
context; the mapper will NOT re-upload it only if it's deleted after its 48 h window
has passed — an accepted quirk).

## Out of scope

- Any new Postgres tables/columns (`contracts.md` §7 — none needed).
- Event-driven analysis of any kind; no changes to `runMonitoringBatch`,
  `batch-runner.ts`, `progress-store.ts`, or the weekly cron.
- Serving article content to the frontend (documents stay download-less as today).
- Talking to the provider's MCP surface (tracker only uses `GET /health`).
- Uploading UI for markdown (the drop zones stay PDF/DOCX-only for humans; markdown
  arrives via API from the mapper).

## Files to modify

| File | Change |
|---|---|
| `src/routes/documents.ts` | mimetype allowlist + fileType map |
| `src/agent/prompts.ts` | context-documents wording (both prompts) |
| `src/config.ts` | `DATA_PROVIDER_URL` |
| `src/routes/monitoring.ts` | `GET /api/provider/health` proxy |
| `web/src/api/client.ts` | `getProviderHealth()` |
| `web/src/hooks/useProviderHealth.ts` | NEW hook |
| `web/src/components/MonitoringHistory.tsx` (or sibling) | health card |
| `web/src/components/thesis/BrokerResearchPanel.tsx` | optional MD tag |
| `.env.example` | document `DATA_PROVIDER_URL` |

## Acceptance criteria

1. `curl -F "file=@a.md;type=text/markdown" POST /api/holdings/:id/documents` → 201
   with `fileType: "MD"`; the row appears in `GET /api/holdings/:id/documents`;
   uploading a `.txt` (`text/plain`) still 400s; PDF/DOCX behavior unchanged.
2. With a holding that has one `.md` article document, triggering
   `POST /api/holdings/:id/weekly-logs/trigger` under `MOCK_AGENT=false` builds a
   prompt containing the document's `filePath` under the new context-documents
   heading (assert via a unit test on `buildWeeklyPrompt`).
3. `GET /api/provider/health`: 503 when unconfigured; relays provider JSON when a
   stub server responds; 503 "unreachable" when the URL refuses connections
   (integration test with a throwaway `http.createServer`).
4. Monitoring page renders the health card when the proxy returns data and hides it
   when not configured (frontend component test with mocked query).
5. Full existing suites stay green: `pnpm test`, `pnpm test:integration`,
   `cd web && pnpm test`, `pnpm test:e2e`.

## Standalone testing

No provider or mapper needed: unit-test the mimetype filter and prompt builder
directly; stub the provider health endpoint with a local HTTP server in integration
tests; `MOCK_AGENT=true` covers any e2e touchpoints. A handy manual check:
`printf -- '---\nkind: mapped-article\n---\n# T\n' > /tmp/a.md` then the curl from
criterion 1.
