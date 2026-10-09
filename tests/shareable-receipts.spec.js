import { expect, test } from "@playwright/test";
import { addFirstProduct, startImaginaryCheckout } from "./catalog-helpers.js";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

async function checkoutToReceipt(page) {
  await addFirstProduct(page);
  await startImaginaryCheckout(page);
  await page.getByRole("button", { name: "Skip check-in" }).click();
  await page.getByRole("button", { name: "Finish tracker" }).click();
}

test("copies and downloads a shareable imaginary receipt", async ({ page }) => {
  await checkoutToReceipt(page);

  await expect(page.getByRole("button", { name: "Share receipt" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy receipt text" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Download receipt" })).toBeVisible();

  await page.getByRole("button", { name: "Share receipt" }).click();
  await expect(page.getByText("Anonymous share text copied locally.")).toBeVisible();

  await page.getByRole("button", { name: "Copy receipt text" }).click();
  await expect(page.getByText("Receipt text copied locally.")).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download receipt" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("we-wont-buy-receipt.txt");
});
