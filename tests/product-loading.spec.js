import { expect, test } from "@playwright/test";
import { products } from "../src/data/catalog.generated.js";

const outerwearCount = products.filter((product) => product.category === "outerwear").length;

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("progressively loads catalog products", async ({ page }) => {
  await expect(page.locator(".product-card")).toHaveCount(24);
  await expect(page.getByText("Showing 24 of 1000")).toBeVisible();

  await page.getByRole("button", { name: "Load more quiet choices" }).click();

  await expect(page.locator(".product-card")).toHaveCount(48);
  await expect(page.getByText("Showing 48 of 1000")).toBeVisible();
});

test("keeps existing product cards in the DOM when loading more", async ({ page }) => {
  // A full re-render would replace this node and drop the marker — and with it,
  // Safari would lose the scroll position.
  await page.locator(".product-card").first().evaluate((card) => card.setAttribute("data-scroll-anchor", "true"));

  await page.getByRole("button", { name: "Load more quiet choices" }).click();

  await expect(page.locator(".product-card")).toHaveCount(48);
  await expect(page.locator("[data-scroll-anchor]")).toHaveCount(1);
});

test("adds an appended product to the cart", async ({ page }) => {
  await page.getByRole("button", { name: "Load more quiet choices" }).click();
  await expect(page.locator(".product-card")).toHaveCount(48);

  await page.locator(".product-card").nth(40).getByRole("button", { name: /^Add to no-buy cart: / }).click();

  await expect(page.locator(".cart-drawer")).toHaveClass(/is-open/);
  await expect(page.locator(".cart-drawer .cart-item")).toHaveCount(1);
});

test("removes the load controls once every product is shown", async ({ page }) => {
  await page.getByRole("tab", { name: "Outerwear" }).click();

  // Scrolling the loader into view pulls the sentinel inside the observer's
  // rootMargin, so batches keep auto-loading until the category is exhausted.
  await expect
    .poll(async () => {
      await page.locator(".product-loader").scrollIntoViewIfNeeded();
      return page.locator(".product-card").count();
    }, { timeout: 15_000 })
    .toBe(outerwearCount);

  await expect(page.locator(".product-loader")).toContainText(`Showing ${outerwearCount} of ${outerwearCount}`);
  await expect(page.getByRole("button", { name: "Load more quiet choices" })).toHaveCount(0);
  await expect(page.locator("[data-product-sentinel]")).toHaveCount(0);
});

test("resets product loading when filters change", async ({ page }) => {
  await page.getByRole("button", { name: "Load more quiet choices" }).click();
  await expect(page.locator(".product-card")).toHaveCount(48);

  await page.getByRole("tab", { name: "Outerwear" }).click();

  await expect(page.locator(".product-card")).toHaveCount(24);
  await expect(page.locator(".product-loader")).toContainText(/Showing 24 of \d+/);
});

test("keeps the contact link in the header", async ({ page }) => {
  await expect(page.locator(".site-header").getByRole("link", { name: "Contact" })).toHaveAttribute(
    "href",
    "mailto:info@wewontbuy.com",
  );
  await expect(page.locator(".contact-panel")).toHaveCount(0);
});
