import { expect, test } from "@playwright/test";
import { firstCollectionName, firstProductName } from "./catalog-helpers.js";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("filters the catalog by curated collection", async ({ page }) => {
  const collections = page.getByRole("region", { name: "Curated collections" });
  await expect(collections.getByRole("heading", { name: "Curated collections" })).toBeVisible();

  await collections.getByRole("button", { name: firstCollectionName }).click();

  await expect(page.getByText(`Showing ${firstCollectionName}`)).toBeVisible();
  await expect(page.getByRole("heading", { name: firstProductName })).toBeVisible();
});
