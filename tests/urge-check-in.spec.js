import { expect, test } from "@playwright/test";
import { addFirstProduct, startImaginaryCheckout } from "./catalog-helpers.js";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("records an optional urge trigger during checkout", async ({ page }) => {
  await addFirstProduct(page);
  await startImaginaryCheckout(page);

  const dialog = page.getByRole("dialog", { name: "What started this cart?" });
  await expect(dialog.getByText("This is optional and stored only in this browser.")).toBeVisible();
  await dialog.getByRole("button", { name: "Stress" }).click();
  await dialog.getByRole("button", { name: "Complete checkout with check-in" }).click();
  await page.getByRole("button", { name: "Finish tracker" }).click();

  await expect(page.getByRole("heading", { name: "Nothing is on the way." })).toBeVisible();
  await page.getByRole("button", { name: "Close receipt" }).click();
  await expect(page.getByRole("region", { name: "Local order history" }).getByText("Trigger: Stress")).toBeVisible();
});

test("can skip the urge check-in", async ({ page }) => {
  await addFirstProduct(page);
  await startImaginaryCheckout(page);

  await page.getByRole("button", { name: "Skip check-in" }).click();
  await page.getByRole("button", { name: "Finish tracker" }).click();

  await expect(page.getByRole("heading", { name: "Nothing is on the way." })).toBeVisible();
});
