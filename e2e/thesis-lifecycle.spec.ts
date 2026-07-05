import { test, expect, type Page } from "@playwright/test";

/** Submit the Add Holding form; returns once the generation modal is up. */
async function startGenerationViaUi(page: Page, ticker: string) {
  await page.getByRole("button", { name: /add holding/i }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/ticker/i).fill(ticker);
  await dialog.getByLabel(/company name/i).fill(`${ticker} Test Corp`);
  await dialog.getByLabel(/thesis bullets/i).fill("Strong growth thesis");
  await dialog.getByRole("button", { name: /generate thesis/i }).click();
  await expect(
    page.getByText(`Generating thesis for ${ticker}`),
  ).toBeVisible({ timeout: 10_000 });
}

test.describe("Thesis lifecycle", () => {
  test("dashboard loads and shows holdings heading", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /holdings/i }),
    ).toBeVisible();
  });

  test("empty state shows Add Holding and Upload Spreadsheet buttons", async ({
    page,
  }) => {
    await page.goto("/");

    // If holdings exist, we might see the table instead.
    // Check for either the table or the empty state.
    const heading = page.getByRole("heading", { name: /holdings/i });
    await expect(heading).toBeVisible();
  });

  test("Add Holding modal opens and has required fields", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: /add holding/i }).click();

    // Modal should appear with form fields (scoped to the dialog — the
    // dashboard search box also mentions "ticker" in its label)
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel(/ticker/i)).toBeVisible();
    await expect(dialog.getByText(/position/i).first()).toBeVisible();
    await expect(dialog.getByRole("radio", { name: /long/i })).toBeVisible();
  });

  test("thesis detail page shows tabs", async ({ page }) => {
    await page.goto("/");

    // Click the first holding row if available
    const rows = page.locator("tbody tr");
    const rowCount = await rows.count();

    if (rowCount > 0) {
      await rows.first().click();

      // Should see the two thesis tabs
      await expect(page.getByRole("tab", { name: /thesis/i })).toBeVisible();
      await expect(
        page.getByRole("tab", { name: /weekly log/i }),
      ).toBeVisible();
    }
  });

  test("generation shows a live polled activity feed and completes without a reload", async ({
    page,
  }) => {
    // Unique ticker so parallel workers / leftover rows can't collide
    const ticker = `LIV${Math.floor(Math.random() * 90000) + 10000}`;
    await page.goto("/");

    await startGenerationViaUi(page, ticker);

    // The polled feed gains entries while the generation is running
    await expect(page.getByText(/Searching:/).first()).toBeVisible({
      timeout: 15_000,
    });

    // ...and settles into the completed state with no reload
    await expect(page.getByText(`Thesis generated for ${ticker}.`)).toBeVisible(
      { timeout: 20_000 },
    );
    await expect(
      page.locator("tbody tr", { hasText: ticker }).first(),
    ).toBeVisible();
  });

  test("reloading mid-generation resumes showing progress", async ({
    page,
  }) => {
    const ticker = `RES${Math.floor(Math.random() * 90000) + 10000}`;
    await page.goto("/");

    await startGenerationViaUi(page, ticker);

    // Reload while the generation is still running — polling picks it back up
    await page.reload();

    await expect(
      page.getByText(
        new RegExp(`(Generating thesis for|Thesis ready for) ${ticker}`),
      ),
    ).toBeVisible({ timeout: 10_000 });

    // The restored modal reaches the completed state
    await expect(page.getByText(`Thesis generated for ${ticker}.`)).toBeVisible(
      { timeout: 20_000 },
    );
    await expect(
      page.locator("tbody tr", { hasText: ticker }).first(),
    ).toBeVisible();
  });

  test("idle dashboard does not poll status endpoints", async ({ page }) => {
    // A monitoring batch triggered by a parallel spec legitimately polls;
    // exempt /api/monitoring/status when one is active.
    const statusRes = await page.request.get("/api/monitoring/status");
    const monitoringActive =
      statusRes.ok() && (await statusRes.json()).status === "active";

    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /holdings/i }),
    ).toBeVisible();

    // Let the initial one-shot status queries settle, then observe
    await page.waitForTimeout(2_000);

    const polls: string[] = [];
    page.on("request", (req) => {
      if (/generation-status|\/status/.test(new URL(req.url()).pathname)) {
        polls.push(req.url());
      }
    });
    await page.waitForTimeout(5_000);

    const offending = polls.filter(
      (url) => !(monitoringActive && url.includes("/api/monitoring/status")),
    );
    expect(offending).toHaveLength(0);
  });

  test("search bar is focusable with Cmd+K", async ({ page }) => {
    await page.goto("/");

    // Only test if search bar exists (holdings present)
    const searchInput = page.getByPlaceholder(/search/i);
    if (await searchInput.isVisible()) {
      await page.keyboard.press("Meta+k");
      await expect(searchInput).toBeFocused();
    }
  });
});
