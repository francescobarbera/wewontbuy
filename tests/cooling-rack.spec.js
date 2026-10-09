import { expect, test } from "@playwright/test";
import { coolFirstProduct, firstProduct, firstProductName } from "./catalog-helpers.js";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("parks a product in the local cooling-off rack", async ({ page }) => {
  await coolFirstProduct(page);

  const rack = page.getByRole("region", { name: "Cooling-Off Rack" });
  await expect(rack.getByRole("heading", { name: "Cooling-Off Rack" })).toBeVisible();
  await expect(rack.getByText(firstProductName)).toBeVisible();
  await expect(rack.getByText("Ready in about 24 hours")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("region", { name: "Cooling-Off Rack" }).getByText(firstProductName)).toBeVisible();
});

test("reviews a ready cooling-off item", async ({ page }) => {
  await page.evaluate((productId) => {
    localStorage.setItem(
      "weDontBuyCoolingRack:v1",
      JSON.stringify([
        {
          productId,
          addedAt: "2026-06-23T10:00:00.000Z",
          unlockAt: "2026-06-23T10:00:00.000Z",
        },
      ]),
    );
  }, firstProduct.id);
  await page.reload();

  const rack = page.getByRole("region", { name: "Cooling-Off Rack" });
  await expect(rack.getByText("Do you still want the feeling?")).toBeVisible();
  await rack.getByRole("button", { name: `Move ${firstProductName} to no-buy cart` }).click();

  await expect(page.getByRole("button", { name: /^Cart/ })).toContainText("1");
});
