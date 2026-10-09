import { expect, test } from "@playwright/test";
import { addFirstProduct, startImaginaryCheckout } from "./catalog-helpers.js";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("shows a clearly fake delivery tracker before the receipt", async ({ page }) => {
  await addFirstProduct(page);
  await startImaginaryCheckout(page);
  await page.getByRole("button", { name: "Skip check-in" }).click();

  const tracker = page.getByRole("dialog", { name: "Fake delivery tracker" });
  await expect(tracker.getByText("No real carrier, tracking number, address, or parcel exists.")).toBeVisible();
  await expect(tracker.getByText("Parcel converted into savings.")).toBeVisible();
  await expect(tracker.getByText("Delivery cancelled by your future self.")).toBeVisible();

  await tracker.getByRole("button", { name: "Finish tracker" }).click();

  await expect(page.getByRole("heading", { name: "Nothing is on the way." })).toBeVisible();
});
