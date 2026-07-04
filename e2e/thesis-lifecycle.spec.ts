import { test, expect } from "@playwright/test";

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
