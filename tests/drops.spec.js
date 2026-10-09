import { expect, test } from "@playwright/test";
import { currentDropName, currentDropNote, currentDropProductCount } from "./catalog-helpers.js";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("presents the current AI-generated drop and archive", async ({ page }) => {
  const drop = page.getByRole("region", { name: "Current AI-generated drop" });

  await expect(drop.getByRole("heading", { name: currentDropName })).toBeVisible();
  await expect(drop.getByText(currentDropNote)).toBeVisible();
  await expect(drop.getByText(`${currentDropProductCount} fictional products`)).toBeVisible();
  await expect(drop.getByRole("button", { name: `Browse ${currentDropName}` })).toBeVisible();

  await expect(
    page.getByRole("region", { name: "Drop archive" }).getByRole("heading", { name: currentDropName }),
  ).toBeVisible();
});
