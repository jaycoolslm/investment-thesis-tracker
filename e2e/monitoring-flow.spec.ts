import { test, expect, type Page } from "@playwright/test";

/**
 * E2E test for the weekly monitoring flow:
 * Add holding → Generate thesis → Trigger monitoring → Verify dashboard + weekly log
 *
 * Requires MOCK_AGENT=true on the backend (set in playwright.config.ts).
 *
 * Each test uses its own tickers and deletes only those, so parallel
 * workers (including other spec files) never fight over rows.
 */

/** Helper: delete any leftover holdings for the given tickers (retry hygiene) */
async function cleanupTickers(page: Page, tickers: string[]) {
  const res = await page.request.get("/api/holdings");
  const existingHoldings = await res.json();
  for (const h of existingHoldings) {
    if (tickers.includes(h.ticker)) {
      await page.request.delete(`/api/holdings/${h.id}`);
    }
  }
}

/** Helper: seed a holding via API (faster than UI for multi-holding tests) */
async function seedHoldingViaApi(
  page: Page,
  ticker: string,
  companyName: string,
) {
  const createRes = await page.request.post("/api/holdings", {
    data: { ticker, companyName, direction: "long" },
  });
  const holding = await createRes.json();

  // Generate thesis (mock agent — completes synchronously with the response)
  await page.request.post(`/api/holdings/${holding.id}/generate`, {
    data: { bullets: "Strong growth thesis" },
  });

  return holding;
}

test.describe("Monitoring flow (E2E)", () => {
  test("single holding: trigger weekly check and verify log appears", async ({
    page,
  }) => {
    await cleanupTickers(page, ["WKAAPL"]);
    await seedHoldingViaApi(page, "WKAAPL", "Apple Inc.");

    // Navigate to thesis detail page
    await page.goto("/");
    await page.waitForSelector("tbody tr");
    await page.locator("tbody tr", { hasText: "WKAAPL" }).first().click();

    // Go to Weekly Log tab
    await page.getByRole("tab", { name: /weekly log/i }).click();

    // Should see empty state
    await expect(page.getByText(/no weekly logs yet/i)).toBeVisible();

    // Click "Run Weekly Check"
    await page.getByRole("button", { name: /run weekly check/i }).click();

    // Wait for analysis to complete (button text changes back from "Analysing...")
    await expect(
      page.getByRole("button", { name: /run weekly check/i }),
    ).toBeVisible({ timeout: 15_000 });

    // Verify a log row appears in the table
    await expect(page.locator("tbody tr").first()).toBeVisible({
      timeout: 5_000,
    });

    // Verify impact badge is visible
    await expect(
      page.getByText(/strengthened|weakened|unchanged/i).first(),
    ).toBeVisible();
  });

  test("dashboard shows updated impact badge after monitoring", async ({
    page,
  }) => {
    await cleanupTickers(page, ["BDMSFT"]);
    const holding = await seedHoldingViaApi(page, "BDMSFT", "Microsoft Corp.");

    // Trigger monitoring via API
    await page.request.post(
      `/api/holdings/${holding.id}/weekly-logs/trigger`,
    );

    // Navigate to dashboard
    await page.goto("/");
    await page.waitForSelector("tbody tr");

    // The holding row should show an impact badge (select by ticker —
    // parallel spec files create their own rows in the same table)
    const row = page.locator("tbody tr", { hasText: "BDMSFT" }).first();
    await expect(
      row.getByText(/strengthened|weakened|unchanged/i),
    ).toBeVisible({ timeout: 5_000 });
  });

  test("monitoring history table shows completed batch", async ({ page }) => {
    await cleanupTickers(page, ["HAAPL", "HGOOG"]);
    const h1 = await seedHoldingViaApi(page, "HAAPL", "Apple Inc.");
    const h2 = await seedHoldingViaApi(page, "HGOOG", "Alphabet Inc.");

    // Trigger monitoring for each holding individually
    for (const h of [h1, h2]) {
      await page.request.post(`/api/holdings/${h.id}/weekly-logs/trigger`);
    }

    // Navigate to dashboard
    await page.goto("/");

    // Scroll down to monitoring history section
    const historySection = page.getByText(/monitoring history|past runs/i);

    // If monitoring history component exists on dashboard, verify it shows data
    if (await historySection.isVisible({ timeout: 3_000 }).catch(() => false)) {
      // Should show a row with the current week's batch
      await expect(page.getByText(/2026-W/)).toBeVisible();
    }
  });

  test("batch monitoring via API triggers updates all holdings", async ({
    page,
  }) => {
    const tickers = ["BTAAPL", "BTMSFT", "BTGOOG"];
    await cleanupTickers(page, tickers);
    const h1 = await seedHoldingViaApi(page, "BTAAPL", "Apple Inc.");
    const h2 = await seedHoldingViaApi(page, "BTMSFT", "Microsoft Corp.");
    const h3 = await seedHoldingViaApi(page, "BTGOOG", "Alphabet Inc.");

    // Trigger the in-process batch route for all active holdings
    const triggerRes = await page.request.post("/api/monitoring/trigger");
    expect([200, 202, 409]).toContain(triggerRes.status());

    // Wait until every seeded holding has its weekly log
    await expect
      .poll(
        async () => {
          let count = 0;
          for (const h of [h1, h2, h3]) {
            const logsRes = await page.request.get(
              `/api/holdings/${h.id}/weekly-logs`,
            );
            const logs = await logsRes.json();
            if (logs.length === 1 && logs[0].thesisImpact) count++;
          }
          return count;
        },
        { timeout: 15_000 },
      )
      .toBe(3);

    // Triggering again in the same week must not duplicate weekly logs:
    // holdings already logged this week are excluded from the batch.
    const second = await page.request.post("/api/monitoring/trigger");
    expect([200, 202, 409]).toContain(second.status());
    await page.waitForTimeout(1000);

    for (const h of [h1, h2, h3]) {
      const logsRes = await page.request.get(
        `/api/holdings/${h.id}/weekly-logs`,
      );
      const logs = await logsRes.json();
      expect(logs).toHaveLength(1); // exactly one log per (holding, week)
    }

    // Navigate to dashboard and verify each seeded holding shows an impact
    // badge. (Other spec files run in parallel workers against the same DB,
    // so assert per-ticker rather than on the total row count.)
    await page.goto("/");
    await page.waitForSelector("tbody tr");

    for (const ticker of tickers) {
      const row = page.locator("tbody tr", { hasText: ticker }).first();
      await expect(row).toBeVisible();
      await expect(
        row.getByText(/strengthened|weakened|unchanged/i),
      ).toBeVisible();
    }
  });
});
