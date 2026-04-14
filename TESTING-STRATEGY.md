# Thesis Tracker -- Testing Strategy

**Version**: 1.0
**Date**: 2026-04-14
**Status**: Draft

---

## Guiding Principles

One developer. MVP. Every test must earn its place by preventing a specific class of bug that would otherwise ship. The system's core value is AI-generated content, which is non-deterministic -- so the strategy draws a hard line between **structural correctness** (testable, automatable) and **content quality** (manual review, prompt regression snapshots).

**What we test automatically**: data flows in, gets stored correctly, comes out in the right shape, errors are handled, the UI renders and responds to interaction.

**What we do NOT unit test**: whether the AI wrote a good thesis. That is a prompt engineering problem, not a software testing problem.

---

## Test Tooling

| Tool | Purpose | Config file |
|------|---------|-------------|
| Vitest | Unit + integration tests (backend and frontend) | `vitest.config.ts`, `web/vitest.config.ts` |
| Playwright | E2E browser tests | `playwright.config.ts` |
| Testcontainers | Disposable Postgres + Redis for integration tests | used inside Vitest setup files |
| Supertest | HTTP assertions against Express app | used in API integration tests |
| MSW (Mock Service Worker) | Mock API responses in frontend component tests | `web/src/mocks/` |
| Zod | Runtime schema validation (doubles as test assertions) | `src/agent/schemas.ts` |

### Project layout for tests

```
src/
  agent/
    __tests__/
      codex-agent.test.ts        -- ThesisAgent mock tests
      prompts.test.ts            -- prompt construction tests
      schemas.test.ts            -- schema validation tests
  services/
    __tests__/
      thesis-generation.test.ts  -- generation orchestration
      weekly-monitoring.test.ts  -- weekly job orchestration
  routes/
    __tests__/
      holdings.test.ts           -- API integration
      theses.test.ts
      documents.test.ts
      bulk.test.ts
  jobs/
    __tests__/
      weekly-worker.test.ts      -- BullMQ worker logic
      bulk-worker.test.ts
  db/
    __tests__/
      schema.test.ts             -- migration smoke test
web/
  src/
    components/
      __tests__/
        HoldingsTable.test.tsx
        ThesisView.test.tsx
        PillarEditor.test.tsx
        DocumentUpload.test.tsx
e2e/
  thesis-lifecycle.spec.ts       -- single critical path
  bulk-upload.spec.ts            -- bulk happy path
```

Tests live next to the code they test. No top-level `tests/` directory.

---

## Layer 1: Unit Tests

### 1A. ThesisAgent Wrapper (`src/agent/codex-agent.ts`)

**What to test**: the wrapper correctly calls the SDK, passes the right prompt, and parses the response. NOT whether the AI gives good answers.

**Mocking strategy**: Mock the `@openai/codex-sdk` module at the import level. The SDK surface we use is tiny -- `new Codex()`, `codex.startThread()`, `thread.run(prompt)`. Mock all three.

```typescript
// src/agent/__tests__/codex-agent.test.ts
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ThesisAgent } from '../codex-agent';

// Mock the entire SDK module
vi.mock('@openai/codex-sdk', () => {
  const mockRun = vi.fn();
  const mockStartThread = vi.fn(() => ({ run: mockRun }));
  return {
    Codex: vi.fn(() => ({ startThread: mockStartThread })),
    __mockRun: mockRun,           // expose for test assertions
    __mockStartThread: mockStartThread,
  };
});

import { __mockRun, __mockStartThread } from '@openai/codex-sdk';

describe('ThesisAgent.generateThesis', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('passes ticker, direction, and bullets into the prompt', async () => {
    __mockRun.mockResolvedValueOnce(JSON.stringify(VALID_THESIS_FIXTURE));

    const agent = new ThesisAgent();
    await agent.generateThesis({
      ticker: 'AAPL',
      companyName: 'Apple Inc.',
      direction: 'long',
      bullets: 'Strong services growth',
      benchmarkIndex: 'S&P 500',
      researchFilePaths: [],
    });

    const prompt = __mockRun.mock.calls[0][0];
    expect(prompt).toContain('AAPL');
    expect(prompt).toContain('long');
    expect(prompt).toContain('Strong services growth');
    expect(prompt).toContain('S&P 500');
  });

  it('includes broker research file paths when provided', async () => {
    __mockRun.mockResolvedValueOnce(JSON.stringify(VALID_THESIS_FIXTURE));

    const agent = new ThesisAgent();
    await agent.generateThesis({
      ticker: 'AAPL',
      companyName: 'Apple Inc.',
      direction: 'long',
      bullets: 'test',
      benchmarkIndex: 'S&P 500',
      researchFilePaths: ['/data/documents/1/goldman-report.pdf'],
    });

    const prompt = __mockRun.mock.calls[0][0];
    expect(prompt).toContain('goldman-report.pdf');
  });

  it('throws a typed error when SDK returns unparseable response', async () => {
    __mockRun.mockResolvedValueOnce('not json at all');

    const agent = new ThesisAgent();
    await expect(
      agent.generateThesis({ /* valid input */ })
    ).rejects.toThrow(/parse|invalid|schema/i);
  });

  it('throws when SDK rejects (network error, rate limit)', async () => {
    __mockRun.mockRejectedValueOnce(new Error('429 Too Many Requests'));

    const agent = new ThesisAgent();
    await expect(
      agent.generateThesis({ /* valid input */ })
    ).rejects.toThrow('429');
  });
});

describe('ThesisAgent.analyseWeekly', () => {
  it('includes the full current thesis in the prompt', async () => {
    __mockRun.mockResolvedValueOnce(JSON.stringify(VALID_WEEKLY_LOG_FIXTURE));

    const agent = new ThesisAgent();
    await agent.analyseWeekly({
      holding: HOLDING_FIXTURE,
      thesis: THESIS_FIXTURE,
      researchFilePaths: [],
    });

    const prompt = __mockRun.mock.calls[0][0];
    // The weekly prompt must include pillar titles so the agent can reference them
    expect(prompt).toContain(THESIS_FIXTURE.pillars[0].title);
  });
});
```

**Test count**: ~8-10 tests. Fast (no I/O).

**What this catches**: prompt construction regressions, response parsing bugs, error handling gaps.

### 1B. Prompt Construction (`src/agent/prompts.ts`)

**What to test**: `buildGenerationPrompt()` and `buildWeeklyPrompt()` produce prompts that contain all required sections. These are pure functions -- easiest tests in the project.

```typescript
// src/agent/__tests__/prompts.test.ts
describe('buildGenerationPrompt', () => {
  it('includes the JSON schema for structured output', () => {
    const prompt = buildGenerationPrompt(SAMPLE_INPUT);
    expect(prompt).toContain('"pillars"');
    expect(prompt).toContain('"assumptions"');
    expect(prompt).toContain('"risks"');
  });

  it('omits broker research section when no files provided', () => {
    const prompt = buildGenerationPrompt({ ...SAMPLE_INPUT, researchFilePaths: [] });
    expect(prompt).not.toContain('BROKER RESEARCH');
  });

  it('includes broker research section when files are provided', () => {
    const prompt = buildGenerationPrompt({
      ...SAMPLE_INPUT,
      researchFilePaths: ['/data/documents/1/report.pdf'],
    });
    expect(prompt).toContain('BROKER RESEARCH');
    expect(prompt).toContain('report.pdf');
  });
});

describe('buildWeeklyPrompt', () => {
  it('includes the benchmark index for relative performance', () => {
    const prompt = buildWeeklyPrompt(SAMPLE_WEEKLY_INPUT);
    expect(prompt).toContain('FTSE 100');
  });

  it('includes all pillar titles from the current thesis', () => {
    const prompt = buildWeeklyPrompt(SAMPLE_WEEKLY_INPUT);
    SAMPLE_WEEKLY_INPUT.thesis.pillars.forEach(p => {
      expect(prompt).toContain(p.title);
    });
  });
});
```

**Test count**: ~6 tests. Milliseconds to run.

### 1C. Schema Validation (`src/agent/schemas.ts`)

This is the most important unit test file in the project. The Zod schemas that validate AI output are the **contract boundary** between non-deterministic AI and deterministic application code. If the schema is wrong, garbage flows into the database.

```typescript
// src/agent/__tests__/schemas.test.ts
import { thesisSchema, weeklyLogSchema } from '../schemas';

describe('thesisSchema', () => {
  it('accepts a valid thesis with 3 pillars', () => {
    const result = thesisSchema.safeParse(VALID_THESIS_FIXTURE);
    expect(result.success).toBe(true);
  });

  it('rejects thesis with 0 pillars', () => {
    const result = thesisSchema.safeParse({ ...VALID_THESIS_FIXTURE, pillars: [] });
    expect(result.success).toBe(false);
  });

  it('rejects thesis with 6+ pillars', () => {
    const sixPillars = Array(6).fill(VALID_THESIS_FIXTURE.pillars[0]);
    const result = thesisSchema.safeParse({ ...VALID_THESIS_FIXTURE, pillars: sixPillars });
    expect(result.success).toBe(false);
  });

  it('rejects thesis with missing summary', () => {
    const { summary, ...noSummary } = VALID_THESIS_FIXTURE;
    const result = thesisSchema.safeParse(noSummary);
    expect(result.success).toBe(false);
  });

  it('rejects risk without severity rating', () => {
    const badRisks = [{ description: 'AWS competition' }]; // missing severity
    const result = thesisSchema.safeParse({ ...VALID_THESIS_FIXTURE, risks: badRisks });
    expect(result.success).toBe(false);
  });

  it('accepts risk severity values: high, medium, low', () => {
    ['high', 'medium', 'low'].forEach(severity => {
      const risks = [{ description: 'test', severity }];
      const result = thesisSchema.safeParse({ ...VALID_THESIS_FIXTURE, risks });
      expect(result.success).toBe(true);
    });
  });

  it('requires at least 1 source', () => {
    const result = thesisSchema.safeParse({ ...VALID_THESIS_FIXTURE, sources: [] });
    expect(result.success).toBe(false);
  });

  it('requires each assumption to be a non-empty string', () => {
    const result = thesisSchema.safeParse({ ...VALID_THESIS_FIXTURE, assumptions: [''] });
    expect(result.success).toBe(false);
  });
});

describe('weeklyLogSchema', () => {
  it('accepts a valid weekly log entry', () => {
    const result = weeklyLogSchema.safeParse(VALID_WEEKLY_LOG_FIXTURE);
    expect(result.success).toBe(true);
  });

  it('requires thesis_impact to be one of three values', () => {
    const result = weeklyLogSchema.safeParse({
      ...VALID_WEEKLY_LOG_FIXTURE,
      thesis_impact: 'maybe',
    });
    expect(result.success).toBe(false);
  });

  it('allows null price fields when data is unavailable', () => {
    const result = weeklyLogSchema.safeParse({
      ...VALID_WEEKLY_LOG_FIXTURE,
      price_change_pct: null,
      index_change_pct: null,
      relative_perf: null,
    });
    expect(result.success).toBe(true);
  });
});
```

**Test count**: ~15 tests. These run in milliseconds and prevent the most damaging class of bugs: malformed AI output silently entering the database.

---

## Layer 2: Integration Tests

### 2A. API Endpoints (Supertest + Testcontainers)

Use Testcontainers to spin up a real Postgres instance per test suite. No mocking the database -- schema bugs, constraint violations, and query issues are the exact bugs integration tests should catch.

**Setup file** (`src/__tests__/setup.ts`):

```typescript
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createApp } from '../server'; // Express app factory

let container;
let db;
let app;

export async function setupTestDb() {
  container = await new PostgreSqlContainer().start();
  db = drizzle(container.getConnectionUri());
  await migrate(db, { migrationsFolder: './src/db/migrations' });
  app = createApp(db); // inject db into app
  return { db, app };
}

export async function teardownTestDb() {
  await container.stop();
}
```

**Holdings CRUD** -- the most critical API surface:

```typescript
// src/routes/__tests__/holdings.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setupTestDb, teardownTestDb } from '../../__tests__/setup';

describe('Holdings API', () => {
  let app, db;
  beforeAll(async () => { ({ app, db } = await setupTestDb()); });
  afterAll(async () => { await teardownTestDb(); });

  describe('POST /api/holdings', () => {
    it('creates a holding and returns it with an id', async () => {
      const res = await request(app)
        .post('/api/holdings')
        .send({ ticker: 'AAPL', companyName: 'Apple Inc.', direction: 'long', benchmark: 'S&P 500' })
        .expect(201);

      expect(res.body).toMatchObject({
        id: expect.any(Number),
        ticker: 'AAPL',
        direction: 'long',
        benchmark: 'S&P 500',
        status: 'active',
      });
    });

    it('rejects missing ticker', async () => {
      await request(app)
        .post('/api/holdings')
        .send({ direction: 'long' })
        .expect(400);
    });

    it('rejects invalid direction', async () => {
      await request(app)
        .post('/api/holdings')
        .send({ ticker: 'AAPL', direction: 'sideways' })
        .expect(400);
    });

    it('rejects invalid benchmark', async () => {
      await request(app)
        .post('/api/holdings')
        .send({ ticker: 'AAPL', direction: 'long', benchmark: 'MY CUSTOM INDEX' })
        .expect(400);
    });
  });

  describe('GET /api/holdings', () => {
    it('returns all holdings sorted by created_at desc', async () => {
      const res = await request(app).get('/api/holdings').expect(200);
      expect(res.body.length).toBeGreaterThan(0);
    });
  });

  describe('PUT /api/holdings/:id', () => {
    it('updates direction from long to short', async () => {
      // create then update
      const { body: created } = await request(app)
        .post('/api/holdings')
        .send({ ticker: 'TSLA', companyName: 'Tesla', direction: 'long', benchmark: 'S&P 500' });

      const res = await request(app)
        .put(`/api/holdings/${created.id}`)
        .send({ direction: 'short' })
        .expect(200);

      expect(res.body.direction).toBe('short');
    });
  });

  describe('DELETE /api/holdings/:id', () => {
    it('deletes and returns 204', async () => {
      const { body: created } = await request(app)
        .post('/api/holdings')
        .send({ ticker: 'GME', companyName: 'GameStop', direction: 'short', benchmark: 'S&P 500' });

      await request(app).delete(`/api/holdings/${created.id}`).expect(204);
      await request(app).get(`/api/holdings/${created.id}`).expect(404);
    });
  });
});
```

**Thesis editing** -- tests the pillar CRUD which is the most structurally complex API:

```typescript
// src/routes/__tests__/theses.test.ts
describe('Thesis Pillar CRUD', () => {
  it('adds a pillar with correct sort_order', async () => { /* ... */ });
  it('reorders pillars', async () => { /* ... */ });
  it('deletes a pillar and reindexes remaining', async () => { /* ... */ });
  it('rejects pillar with empty title', async () => { /* ... */ });
});

describe('PUT /api/theses/:id', () => {
  it('updates summary text', async () => { /* ... */ });
  it('updates risk severity', async () => { /* ... */ });
  it('auto-saves (returns 200 immediately, no confirmation step)', async () => { /* ... */ });
});
```

**Document upload**:

```typescript
// src/routes/__tests__/documents.test.ts
describe('POST /api/holdings/:id/documents', () => {
  it('accepts a PDF under 50MB', async () => {
    await request(app)
      .post('/api/holdings/1/documents')
      .attach('file', Buffer.from('fake pdf content'), 'research.pdf')
      .expect(201);
  });

  it('rejects files over 50MB', async () => {
    const bigBuffer = Buffer.alloc(51 * 1024 * 1024);
    await request(app)
      .post('/api/holdings/1/documents')
      .attach('file', bigBuffer, 'huge.pdf')
      .expect(413);
  });

  it('rejects unsupported file types', async () => {
    await request(app)
      .post('/api/holdings/1/documents')
      .attach('file', Buffer.from('hello'), 'script.exe')
      .expect(400);
  });
});
```

**Test count**: ~25-30 API tests total. These take 10-20 seconds because of Testcontainers startup, but they catch real database and routing bugs.

### 2B. Weekly Monitoring Pipeline

This tests the full flow: BullMQ job -> worker -> ThesisAgent (mocked) -> DB write. The AI is mocked, but everything else is real.

```typescript
// src/jobs/__tests__/weekly-worker.test.ts
import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest';

// Mock only the agent -- everything else is real
vi.mock('../../agent/codex-agent', () => ({
  ThesisAgent: vi.fn(() => ({
    analyseWeekly: vi.fn().mockResolvedValue(VALID_WEEKLY_LOG_FIXTURE),
  })),
}));

describe('Weekly monitoring worker', () => {
  let app, db;
  beforeAll(async () => {
    ({ app, db } = await setupTestDb());
    // Seed: create a holding with a thesis and pillars
    await seedHoldingWithThesis(db);
  });

  it('creates a weekly log entry for an active holding', async () => {
    await runWeeklyWorker(db, { holdingId: 1 });

    const logs = await db.select().from(weeklyLogs).where(eq(weeklyLogs.holdingId, 1));
    expect(logs).toHaveLength(1);
    expect(logs[0].thesis_impact).toMatch(/strengthened|weakened|unchanged/);
    expect(logs[0].week_label).toBeDefined();
  });

  it('updates holding.latest_impact after log entry', async () => {
    const holding = await db.select().from(holdings).where(eq(holdings.id, 1));
    expect(holding[0].latest_impact).toBe(VALID_WEEKLY_LOG_FIXTURE.thesis_impact);
  });

  it('is idempotent -- skips if log for this week already exists', async () => {
    await runWeeklyWorker(db, { holdingId: 1 }); // run again
    const logs = await db.select().from(weeklyLogs).where(eq(weeklyLogs.holdingId, 1));
    expect(logs).toHaveLength(1); // still 1, not 2
  });

  it('skips holdings with status "paused" or "closed"', async () => {
    await db.update(holdings).set({ status: 'paused' }).where(eq(holdings.id, 1));
    await runWeeklyWorker(db, { holdingId: 1 });
    // should not add a second log
  });

  it('stores pillar_refs as JSONB matching pillar IDs', async () => {
    const logs = await db.select().from(weeklyLogs).where(eq(weeklyLogs.holdingId, 1));
    expect(logs[0].pillar_refs).toBeInstanceOf(Array);
    // Each ref should have a pillar_id that exists in thesis_pillars
  });
});
```

**Test count**: ~6-8 tests. These catch the bugs that actually break the weekly monitoring in production: duplicate logs, wrong status filtering, bad JSON in pillar_refs.

### 2C. Bulk Generation

```typescript
// src/jobs/__tests__/bulk-worker.test.ts
describe('Bulk generation', () => {
  it('processes all valid rows from a spreadsheet', async () => {
    const result = await processBulkUpload(db, VALID_SPREADSHEET_FIXTURE);
    expect(result.succeeded).toBe(3);
    expect(result.failed).toBe(0);
  });

  it('continues past a failed row and reports it', async () => {
    // Row 2 has an invalid ticker format
    const result = await processBulkUpload(db, SPREADSHEET_WITH_BAD_ROW);
    expect(result.succeeded).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.errors[0]).toMatchObject({
      row: 2,
      error: expect.stringContaining('ticker'),
    });
  });

  it('handles spreadsheet with only header row', async () => {
    const result = await processBulkUpload(db, EMPTY_SPREADSHEET_FIXTURE);
    expect(result.succeeded).toBe(0);
    expect(result.errors[0].error).toMatch(/no data rows/i);
  });

  it('validates required columns exist', async () => {
    await expect(
      processBulkUpload(db, MISSING_COLUMNS_SPREADSHEET)
    ).rejects.toThrow(/missing.*column/i);
  });

  it('trims whitespace and normalises ticker casing', async () => {
    const result = await processBulkUpload(db, MESSY_SPREADSHEET_FIXTURE);
    const holdings = await db.select().from(holdingsTable);
    expect(holdings[0].ticker).toBe('AAPL'); // was " aapl  "
  });
});
```

**Test count**: ~6 tests. The AI agent is mocked here too -- we are testing spreadsheet parsing, validation, and partial failure handling.

---

## Layer 3: Frontend Component Tests

Use Vitest + React Testing Library. Mock API calls with MSW. Do NOT test styling or pixel positions -- test user interactions and data display.

### Priority components (test these):

**HoldingsTable** -- the dashboard. If this breaks, the whole app feels broken.

```typescript
// web/src/components/__tests__/HoldingsTable.test.tsx
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

describe('HoldingsTable', () => {
  it('renders all holdings with ticker, direction, and status', () => {
    render(<HoldingsTable holdings={MOCK_HOLDINGS} />);
    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText('Long')).toBeInTheDocument();
  });

  it('filters by ticker when user types in search bar', async () => {
    render(<HoldingsTable holdings={MOCK_HOLDINGS} />);
    await userEvent.type(screen.getByRole('searchbox'), 'AAPL');
    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.queryByText('TSLA')).not.toBeInTheDocument();
  });

  it('sorts by last updated when column header is clicked', async () => {
    render(<HoldingsTable holdings={MOCK_HOLDINGS} />);
    await userEvent.click(screen.getByText('Last Updated'));
    const rows = screen.getAllByRole('row');
    // verify order changed
  });

  it('shows colour-coded status: green for strengthened, red for weakened', () => {
    render(<HoldingsTable holdings={MOCK_HOLDINGS} />);
    const strengthened = screen.getByText('Strengthened');
    expect(strengthened.className).toMatch(/green/i);
  });

  it('focuses search bar on "/" keypress', async () => {
    render(<HoldingsTable holdings={MOCK_HOLDINGS} />);
    await userEvent.keyboard('/');
    expect(screen.getByRole('searchbox')).toHaveFocus();
  });
});
```

**PillarEditor** -- the most interactive component. Block editing is easy to break.

```typescript
// web/src/components/__tests__/PillarEditor.test.tsx
describe('PillarEditor', () => {
  it('renders existing pillars in sort order', () => { /* ... */ });
  it('adds a new pillar at the end', async () => { /* ... */ });
  it('removes a pillar and calls onDelete', async () => { /* ... */ });
  it('reorders pillars via drag handle (or move up/down buttons)', async () => { /* ... */ });
  it('enters edit mode on click and saves on blur', async () => { /* ... */ });
});
```

**DocumentUpload** -- file validation happens client-side and must be tested:

```typescript
describe('DocumentUpload', () => {
  it('accepts PDF files', async () => { /* ... */ });
  it('accepts DOCX files', async () => { /* ... */ });
  it('rejects files over 50MB with visible error', async () => { /* ... */ });
  it('rejects unsupported file types with visible error', async () => { /* ... */ });
  it('shows upload progress', async () => { /* ... */ });
});
```

### Lower priority (skip for MVP, add when it breaks):

- `ThesisView` tab navigation -- low bug surface, mostly Radix primitives
- `WeeklyLogTable` -- it is a read-only table, unlikely to break
- `BulkUpload` progress bar -- hard to test meaningfully without real WebSocket

**Test count**: ~20 frontend tests total. Run in under 5 seconds.

---

## Layer 4: End-to-End Tests (Playwright)

**Philosophy**: For an MVP with one developer, maintain exactly two E2E tests. Each covers a critical user journey that crosses all layers (browser -> API -> DB -> agent -> DB -> browser). If these pass, the app works. If they are flaky, delete them and rely on integration tests.

### E2E Test 1: Single Thesis Lifecycle

```typescript
// e2e/thesis-lifecycle.spec.ts
import { test, expect } from '@playwright/test';

test('create holding, generate thesis, view thesis, edit pillar', async ({ page }) => {
  // 1. Dashboard loads
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Add Holding' })).toBeVisible();

  // 2. Create a holding
  await page.getByRole('button', { name: 'Add Holding' }).click();
  await page.getByLabel('Ticker').fill('AAPL');
  await page.getByLabel('Direction').selectOption('long');
  await page.getByLabel('Benchmark').selectOption('S&P 500');
  await page.getByLabel('Thesis Bullets').fill('Strong services revenue growth\nExpanding margins');
  await page.getByRole('button', { name: /generate/i }).click();

  // 3. Progress indicator appears
  await expect(page.getByText(/searching for market data/i)).toBeVisible({ timeout: 5000 });

  // 4. Thesis renders (use generous timeout -- AI generation can be slow)
  await expect(page.getByText(/investment thesis/i)).toBeVisible({ timeout: 90000 });

  // 5. Thesis has pillars
  await expect(page.getByText(/pillar/i)).toBeVisible();

  // 6. Edit a pillar title
  const firstPillar = page.locator('[data-testid="pillar-title"]').first();
  await firstPillar.click();
  await firstPillar.fill('Updated Pillar Title');
  await firstPillar.blur();

  // 7. Reload and verify edit persisted
  await page.reload();
  await expect(page.getByText('Updated Pillar Title')).toBeVisible();
});
```

### E2E Test 2: Bulk Upload Happy Path

```typescript
// e2e/bulk-upload.spec.ts
test('upload spreadsheet and see holdings appear on dashboard', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /bulk upload/i }).click();

  // Upload a fixture spreadsheet
  await page.setInputFiles('input[type="file"]', 'e2e/fixtures/sample-portfolio.xlsx');

  // Preview table appears
  await expect(page.getByText('AAPL')).toBeVisible();
  await expect(page.getByText('TSLA')).toBeVisible();

  // Start generation
  await page.getByRole('button', { name: /generate all/i }).click();

  // Progress shows
  await expect(page.getByText(/generating/i)).toBeVisible();

  // Eventually completes (generous timeout)
  await expect(page.getByText(/complete/i)).toBeVisible({ timeout: 300000 });

  // Navigate to dashboard -- holdings exist
  await page.goto('/');
  await expect(page.getByText('AAPL')).toBeVisible();
});
```

**E2E environment**: These tests run against the real app with a real database but a **mocked AI agent** that returns fixture data. Do NOT run E2E tests against Azure OpenAI -- they will be slow, expensive, and flaky. Set an env var (`MOCK_AGENT=true`) that makes the ThesisAgent return canned responses.

**When to run**: Before every deploy. Not on every commit (too slow). Use CI with `playwright test` in a separate stage.

**Test count**: 2 tests. If you find yourself wanting a third, question whether it could be an integration test instead.

---

## Layer 5: AI Output Quality -- Prompt Regression Testing

This is not automated testing in the traditional sense. It is a **manual review workflow with tooling support**.

### The Problem

You cannot assert that "this thesis is good". But you CAN detect when a prompt change makes output worse. The strategy: maintain a small set of golden inputs, run them through the real agent periodically, and diff the outputs.

### Approach: Snapshot Evaluation

```
src/agent/
  __evals__/
    fixtures/
      aapl-long.input.json        -- input for Apple long thesis
      nvda-short.input.json       -- input for Nvidia short thesis
      hsbc-long-ftse.input.json   -- non-US holding with FTSE benchmark
    snapshots/
      aapl-long.snapshot.json     -- last known good output
      nvda-short.snapshot.json
      hsbc-long-ftse.snapshot.json
    run-evals.ts                  -- script to regenerate snapshots
```

**`run-evals.ts`** -- a script, NOT a test:

```typescript
// src/agent/__evals__/run-evals.ts
// Run manually: npx tsx src/agent/__evals__/run-evals.ts

import { ThesisAgent } from '../codex-agent';
import { thesisSchema } from '../schemas';
import { readdir, readFile, writeFile } from 'fs/promises';

const agent = new ThesisAgent(); // real agent, real API calls

for (const fixture of await readdir('./src/agent/__evals__/fixtures')) {
  const input = JSON.parse(await readFile(`./fixtures/${fixture}`, 'utf-8'));
  const result = await agent.generateThesis(input);

  // 1. Structural validation (this MUST pass)
  const parsed = thesisSchema.safeParse(result);
  if (!parsed.success) {
    console.error(`STRUCTURAL FAILURE: ${fixture}`, parsed.error);
    process.exit(1);
  }

  // 2. Heuristic checks (warnings, not failures)
  const warnings = [];
  if (parsed.data.pillars.length < 2) warnings.push('Only 1 pillar generated');
  if (parsed.data.sources.length < 3) warnings.push('Fewer than 3 sources');
  if (parsed.data.summary.length < 200) warnings.push('Summary suspiciously short');
  if (warnings.length) console.warn(`WARNINGS for ${fixture}:`, warnings);

  // 3. Save new snapshot for human diff review
  const snapshotPath = `./snapshots/${fixture.replace('.input.', '.snapshot.')}`;
  await writeFile(snapshotPath, JSON.stringify(parsed.data, null, 2));
}

console.log('Eval complete. Review snapshots/ for quality changes.');
```

**Workflow**:
1. Change a prompt in `prompts.ts`
2. Run `npx tsx src/agent/__evals__/run-evals.ts`
3. `git diff src/agent/__evals__/snapshots/` to see what changed
4. Human reviews: did quality improve, regress, or stay the same?
5. If good, commit the new snapshots. If bad, revert the prompt change.

**Cost**: 3-5 API calls per eval run. Run manually, not in CI. Takes 2-5 minutes.

**Heuristic checks to add over time** (as patterns of bad output emerge):
- Pillar titles should not be generic ("Growth", "Valuation") -- check minimum length
- Assumptions should not start with "The company" (generic phrasing)
- Risks should contain at least one specific entity or date
- Sources should contain URLs, not just "web search"

---

## Layer 6: Database Migration Smoke Test

One test. Catches the worst database bug: a migration that does not apply cleanly.

```typescript
// src/db/__tests__/schema.test.ts
describe('Database migrations', () => {
  it('all migrations apply cleanly to a fresh database', async () => {
    const container = await new PostgreSqlContainer().start();
    const db = drizzle(container.getConnectionUri());
    await expect(migrate(db, { migrationsFolder: './src/db/migrations' })).resolves.not.toThrow();
    await container.stop();
  });
});
```

---

## Test Fixtures

Maintain a single fixtures file per domain object. These are reused across all test layers.

```typescript
// src/__tests__/fixtures.ts

export const VALID_THESIS_FIXTURE = {
  summary: 'Apple is well-positioned for continued growth...',
  pillars: [
    { title: 'Services Revenue Acceleration', body: 'Services grew 18% YoY...' },
    { title: 'Installed Base Monetisation', body: 'With 2.2B active devices...' },
    { title: 'Capital Return Programme', body: '$110B buyback authorization...' },
  ],
  quality_assessment: {
    financial_strength: 'ROIC 62%, gross margin 46%, net cash $57B',
    competitive_position: 'Ecosystem lock-in, 87% retention rate',
    esg_governance: 'None identified',
  },
  valuation: {
    current_price: '$198.50',
    investment_goal: 'Re-rate to 32x forward P/E on services mix shift',
    upside_case: 'Services hits 30% of revenue, multiple expansion to 35x',
    base_case: 'Steady 10% EPS growth, multiple holds at 28x',
    downside_case: 'China revenue declines 20%, multiple compresses to 22x',
  },
  assumptions: [
    'Services revenue sustains >15% growth through FY27',
    'No material antitrust action in US or EU',
    'iPhone replacement cycle remains ~4 years',
  ],
  risks: [
    { description: 'EU Digital Markets Act forces App Store fee reduction by 2027', severity: 'high' },
    { description: 'China smartphone market share drops below 15%', severity: 'medium' },
    { description: 'AR/VR hardware fails to gain enterprise traction', severity: 'low' },
  ],
  sources: [
    { title: 'Apple Q1 2026 Earnings Call', date: '2026-01-30', url: 'https://...' },
    { title: 'Morgan Stanley: Apple Services Deep Dive', date: '2026-03-15' },
    { title: 'Reuters: EU DMA enforcement timeline', date: '2026-04-01', url: 'https://...' },
  ],
};

export const VALID_WEEKLY_LOG_FIXTURE = {
  week_label: '2026-04-07',
  price_change_pct: 2.3,
  index_change_pct: 0.8,
  relative_perf: 1.5,
  thesis_impact: 'strengthened' as const,
  summary: 'Pillar 1 strengthened: Services revenue guidance raised 200bps at investor day. Assumption 1 intact.',
  pillar_refs: [
    { pillar_id: 1, impact: 'strengthened', note: 'Services guidance raised' },
  ],
  sources: [
    { title: 'Apple Investor Day 2026', url: 'https://...' },
  ],
};

export const HOLDING_FIXTURE = {
  id: 1,
  ticker: 'AAPL',
  companyName: 'Apple Inc.',
  direction: 'long' as const,
  benchmark: 'S&P 500',
  status: 'active' as const,
};
```

---

## Coverage Targets

Do NOT chase a coverage number. Use these as rough guidelines for where effort should go, not as gates.

| Area | Target | Rationale |
|------|--------|-----------|
| `src/agent/schemas.ts` | 100% | The contract boundary. Every branch matters. |
| `src/agent/prompts.ts` | 90%+ | Pure functions, easy to test, prompt bugs are hard to debug in prod. |
| `src/agent/codex-agent.ts` | 80% | Mock tests for all public methods. Skip internal helpers. |
| `src/routes/` | 80% | All happy paths + key error paths. Skip middleware boilerplate. |
| `src/services/` | 70% | Core orchestration logic. Mocked agent. |
| `src/jobs/workers/` | 70% | Idempotency, error handling, status updates. |
| `web/src/components/` | 50% | Dashboard table + pillar editor. Skip read-only views. |
| E2E | Not measured | 2 tests. Pass/fail only. |

---

## CI Pipeline

```yaml
# .github/workflows/test.yml (or equivalent)
test:
  steps:
    - npm ci
    - npx vitest run --project backend    # unit + integration (~30s)
    - npx vitest run --project frontend   # component tests (~10s)
    # E2E runs in a separate job with Docker Compose
e2e:
  services: [postgres, redis]
  env:
    MOCK_AGENT: 'true'
  steps:
    - docker compose up -d
    - npx playwright test               # ~2 min with mocked agent
```

**Run on every push**: unit + integration + frontend component tests (under 60 seconds).
**Run before deploy**: E2E tests (additional 2-3 minutes).
**Run manually**: prompt eval snapshots (not in CI -- costs money, requires human review).

---

## What NOT to Test

Explicit decisions about where testing effort is wasted:

| Skip | Why |
|------|-----|
| AI output content quality in automated tests | Non-deterministic. Use eval snapshots instead. |
| Codex SDK internals (startThread, run) | Not our code. If the SDK breaks, our mock-based tests still pass and that is correct -- the bug is upstream. |
| Drizzle query builder correctness | Test the route/service behaviour, not the ORM. If Drizzle generates bad SQL, the integration test fails. |
| CSS / visual layout | For an MVP with one developer, visual bugs are caught by using the app. Add visual regression later if the team grows. |
| WebSocket message format | Test the data flow (job status updates reach the client), not the wire format. |
| PDF export rendering | P1 feature. When built, a single integration test that "export returns a non-empty PDF buffer" is sufficient. |
| Authentication / authorization | No auth in v1 per PRD. Add auth tests when auth exists. |
| Load testing / performance | The bottleneck is AI inference (seconds per call), not application throughput. Premature to load test. |

---

## Summary: Test Budget

For one developer on an MVP, this is approximately:

| Layer | Test count | Run time | What it catches |
|-------|-----------|----------|-----------------|
| Unit: schemas | ~15 | <1s | Malformed AI output entering DB |
| Unit: prompts | ~6 | <1s | Prompt construction regressions |
| Unit: agent wrapper | ~10 | <1s | SDK interaction bugs, error handling |
| Integration: API | ~25-30 | ~20s | Routing, validation, DB constraint bugs |
| Integration: workers | ~12 | ~15s | Job processing, idempotency, partial failure |
| Frontend: components | ~20 | ~5s | Dashboard rendering, interactive editing |
| E2E | 2 | ~3min | Full stack smoke test |
| Prompt eval | 3-5 snapshots | manual | Output quality regression |
| DB migration | 1 | ~5s | Schema breakage |
| **Total** | **~90-100** | **<1 min (unit+integration), ~3 min (E2E)** | |

Build the schema validation tests first. Then API integration tests. Then the two E2E tests. Everything else fills in around those as you build each feature. If you are short on time, the schema tests and the weekly monitoring idempotency test are the two that prevent the most damage.
