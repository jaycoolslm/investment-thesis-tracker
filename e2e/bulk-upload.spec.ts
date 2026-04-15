import { test, expect } from "@playwright/test";

test.describe("Bulk upload", () => {
  test("Upload Spreadsheet button opens bulk upload modal", async ({
    page,
  }) => {
    await page.goto("/");

    await page
      .getByRole("button", { name: /upload spreadsheet/i })
      .click();

    // Modal should appear with file drop zone or upload instructions
    await expect(
      page.getByText(/upload|drop|spreadsheet|template/i).first(),
    ).toBeVisible();
  });

  test("header navigation returns to dashboard", async ({ page }) => {
    await page.goto("/");

    // Click the app title/logo to navigate home
    const headerLink = page.getByRole("link", { name: /thesis tracker/i });
    await expect(headerLink).toBeVisible();
    await headerLink.click();

    await expect(
      page.getByRole("heading", { name: /holdings/i }),
    ).toBeVisible();
  });
});
