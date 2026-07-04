import { test, expect, type Page } from "@playwright/test";

/**
 * E2E tests for CSV bulk upload:
 * open modal → drop CSV → read-only validation preview → generate → dashboard.
 *
 * Requires MOCK_AGENT=true on the backend (set in playwright.config.ts).
 * Uses its own tickers and deletes only those, so parallel workers never
 * fight over rows.
 */

// Relative to the repo root, where Playwright runs
const CSV_FIXTURE = "e2e/fixtures/holdings.csv";
const EXCEL_FIXTURE = "e2e/fixtures/holdings.xls";

async function cleanupTickers(page: Page, tickers: string[]) {
  const res = await page.request.get("/api/holdings");
  const existingHoldings = await res.json();
  for (const h of existingHoldings) {
    if (tickers.includes(h.ticker)) {
      await page.request.delete(`/api/holdings/${h.id}`);
    }
  }
}

async function openBulkModal(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /upload csv/i }).click();
  await expect(page.getByText(/import holdings from csv/i)).toBeVisible();
}

test.describe("Bulk upload", () => {
  test("CSV with valid + invalid rows: read-only preview, generates only the valid ones", async ({
    page,
  }) => {
    await cleanupTickers(page, ["BLKSJC", "BLKTSL"]);
    await openBulkModal(page);
    await page
      .locator('input[type="file"][accept=".csv"]')
      .setInputFiles(CSV_FIXTURE);

    // Preview: quoted comma survives, invalid row is flagged with its error
    await expect(page.getByText("BLKSJC")).toBeVisible();
    await expect(page.getByText("BLKTSL")).toBeVisible();
    await expect(
      page.getByText(/1 with errors will be skipped/i),
    ).toBeVisible();
    await expect(page.getByText(/missing ticker/i)).toBeVisible();

    // No cell in the preview is editable
    const dialog = page.getByRole("dialog");
    await expect(dialog.locator("table input, table select")).toHaveCount(0);

    await page
      .getByRole("button", { name: /generate 2 valid holdings/i })
      .click();

    // Both holdings appear on the dashboard, the invalid row is not created
    await expect(page.locator("tbody tr", { hasText: "BLKSJC" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.locator("tbody tr", { hasText: "Smith, Jones & Co" }),
    ).toBeVisible();
    await expect(page.locator("tbody tr", { hasText: "BLKTSL" })).toBeVisible();
    await expect(
      page.locator("tbody tr", { hasText: "Missing Ticker Co" }),
    ).toHaveCount(0);

    await cleanupTickers(page, ["BLKSJC", "BLKTSL"]);
  });

  test("Excel file is rejected with a save-as-CSV message", async ({
    page,
  }) => {
    await openBulkModal(page);
    await page
      .locator('input[type="file"][accept=".csv"]')
      .setInputFiles(EXCEL_FIXTURE);

    await expect(
      page.getByText(/only csv files are supported.*save as/i),
    ).toBeVisible();
  });

  test("template download link is present and endpoint serves CSV", async ({
    page,
  }) => {
    await openBulkModal(page);
    await expect(
      page.getByRole("button", { name: /download csv template/i }),
    ).toBeVisible();

    const res = await page.request.get("/api/bulk-generate/template");
    expect(res.headers()["content-type"]).toContain("text/csv");
    expect(await res.text()).toContain(
      "Ticker,Company Name,Direction,Thesis Bullets",
    );
  });

  test("header navigation returns to dashboard", async ({ page }) => {
    await page.goto("/");

    const headerLink = page.getByRole("link", { name: /thesis tracker/i });
    await expect(headerLink).toBeVisible();
    await headerLink.click();

    await expect(
      page.getByRole("heading", { name: /holdings/i }),
    ).toBeVisible();
  });
});
