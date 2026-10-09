import { expect, test } from "@playwright/test";
import { addFirstProduct, startImaginaryCheckout } from "./catalog-helpers.js";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("creates a local fake profile and personalizes checkout", async ({ page }) => {
  await page.getByRole("button", { name: "Open local profile" }).click();

  const profileDialog = page.getByRole("dialog", { name: "Make the receipt yours." });
  await expect(profileDialog.getByText("This is a local-only fake account.")).toBeVisible();
  await expect(profileDialog.getByText("switching browsers will remove everything")).toBeVisible();

  await page.getByLabel("Display name").fill("Mia");
  await profileDialog.getByRole("button", { name: /Style intention/ }).click();
  await profileDialog.getByRole("menuitemradio", { name: "Slow down" }).click();
  await page.getByRole("button", { name: "Save local profile" }).click();

  await expect(page.getByRole("button", { name: "Open local profile" })).toContainText("Mia");
  await expect(page.getByText("Saved locally for Mia")).toBeVisible();

  await addFirstProduct(page);
  await expect(page.getByText("Cart for Mia")).toBeVisible();
  await startImaginaryCheckout(page);
  await page.getByRole("button", { name: "Skip check-in" }).click();
  await page.getByRole("button", { name: "Finish tracker" }).click();

  await expect(page.getByRole("heading", { name: "Nothing is on the way, Mia." })).toBeVisible();
  await expect(page.getByText("Your local fake profile stays only in this browser.")).toBeVisible();
});

test("shows a markup-like display name as plain text", async ({ page }) => {
  const name = "<i>Mia</i>";
  await page.getByRole("button", { name: "Open local profile" }).click();
  await page.getByLabel("Display name").fill(name);
  await page.getByRole("button", { name: "Save local profile" }).click();

  await expect(page.getByRole("button", { name: "Open local profile" })).toContainText(name);
  await expect(page.getByText(`Saved locally for ${name}`)).toBeVisible();

  await addFirstProduct(page);
  await expect(page.getByText(`Cart for ${name}`)).toBeVisible();
  await startImaginaryCheckout(page);
  await page.getByRole("button", { name: "Skip check-in" }).click();
  await page.getByRole("button", { name: "Finish tracker" }).click();

  await expect(page.getByRole("heading", { name: `Nothing is on the way, ${name}.` })).toBeVisible();
  await expect(page.locator("#app i")).toHaveCount(0);
});

test("can skip and reset the local fake profile", async ({ page }) => {
  await page.getByRole("button", { name: "Open local profile" }).click();
  await page.getByRole("button", { name: "Continue without a name" }).click();
  await expect(page.getByText("Browsing anonymously")).toBeVisible();

  await page.getByRole("button", { name: "Open local profile" }).click();
  await page.getByLabel("Display name").fill("Noor");
  await page.getByRole("button", { name: "Save local profile" }).click();
  await expect(page.getByRole("button", { name: "Open local profile" })).toContainText("Noor");

  await page.getByRole("button", { name: "Open local profile" }).click();
  await page.getByRole("button", { name: "Clear local profile" }).click();
  await expect(page.getByText("Browsing anonymously")).toBeVisible();
});

test("prompts for a local fake profile before the first checkout", async ({ page }) => {
  await addFirstProduct(page);
  await page.getByRole("button", { name: "Complete imaginary checkout" }).click();

  const profileDialog = page.getByRole("dialog", { name: "Make the receipt yours." });
  await expect(profileDialog).toBeVisible();
  await profileDialog.getByRole("button", { name: "Continue without a name" }).click();

  await expect(page.getByRole("dialog", { name: "What started this cart?" })).toBeVisible();
});

test("keeps profile state in memory and warns when local storage is unavailable", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Storage.prototype, "setItem", {
      configurable: true,
      value() {
        throw new DOMException("Storage is blocked", "QuotaExceededError");
      },
    });
  });
  await page.reload();

  await page.getByRole("button", { name: "Open local profile" }).click();
  await page.getByLabel("Display name").fill("Mia");
  await page.getByRole("button", { name: "Save local profile" }).click();

  await expect(page.getByRole("button", { name: "Open local profile" })).toContainText("Mia");
  await expect(
    page.getByText("Local storage is unavailable, so this profile can only stay in memory until this tab closes."),
  ).toBeVisible();
});
