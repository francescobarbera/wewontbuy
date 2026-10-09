import { expect, test } from "@playwright/test";
import { addFirstProduct, firstProductName, firstProductPrice, startImaginaryCheckout } from "./catalog-helpers.js";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("stores imaginary checkouts in local order history", async ({ page }) => {
  await addFirstProduct(page);
  await startImaginaryCheckout(page);
  await page.getByRole("button", { name: "Skip check-in" }).click();
  await page.getByRole("button", { name: "Finish tracker" }).click();
  await page.getByRole("button", { name: "Close receipt" }).click();

  const history = page.getByRole("region", { name: "Local order history" });
  await expect(history.getByRole("heading", { name: "Order history" })).toBeVisible();
  await expect(history.getByText(firstProductName)).toBeVisible();
  await expect(history.getByText(firstProductPrice, { exact: true })).toBeVisible();
  await expect(history.getByText("No real order was placed.")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("region", { name: "Local order history" }).getByText(firstProductName)).toBeVisible();
});

test("clears local order history without changing saved totals", async ({ page }) => {
  await addFirstProduct(page);
  await startImaginaryCheckout(page);
  await page.getByRole("button", { name: "Skip check-in" }).click();
  await page.getByRole("button", { name: "Finish tracker" }).click();
  await page.getByRole("button", { name: "Close receipt" }).click();

  await page.getByRole("button", { name: "Clear local order history" }).click();

  const history = page.getByRole("region", { name: "Local order history" });
  await expect(history.getByText("No imaginary orders yet.")).toBeVisible();
  await expect(page.getByText(firstProductPrice, { exact: true }).first()).toBeVisible();
});
