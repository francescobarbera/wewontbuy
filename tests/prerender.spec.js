import { expect, test } from "@playwright/test";
import { t } from "../src/i18n.js";
import { products } from "../src/data/catalog.generated.js";
import { PRODUCT_BATCH_SIZE } from "../src/view.js";
import { firstProductName, localizedName } from "./catalog-helpers.js";

const heroTitle = t("en", "hero.title");
const heroBody = t("en", "hero.body");
const lastBatchProductName = localizedName(products[PRODUCT_BATCH_SIZE - 1]);
const entryPaths = ["/", "/go/receipt/", "/go/ritual/", "/go/privacy/"];

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  for (const path of entryPaths) {
    test(`${path} serves prerendered hero copy and catalog`, async ({ page }) => {
      await page.goto(path);

      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.getByRole("heading", { level: 1, name: heroTitle })).toBeVisible();
      await expect(page.locator(".hero-copy")).toContainText(heroBody);
      await expect(page.locator(".product-card")).toHaveCount(PRODUCT_BATCH_SIZE);
      await expect(page.getByRole("heading", { name: firstProductName, exact: true })).toBeVisible();
      await expect(page.getByRole("heading", { name: lastBatchProductName, exact: true })).toBeAttached();
    });
  }

  test("exposes crawl metadata", async ({ page, request }) => {
    await page.goto("/");

    const jsonLd = JSON.parse(await page.locator('script[type="application/ld+json"]').first().textContent());
    expect(jsonLd["@type"]).toBe("WebApplication");
    expect(jsonLd.url).toBe("https://wewontbuy.com/");
    expect(jsonLd.offers).toEqual({ "@type": "Offer", price: "0", priceCurrency: "EUR" });

    const robots = await request.get("/robots.txt");
    expect(robots.ok()).toBe(true);
    expect(await robots.text()).toContain("Sitemap: https://wewontbuy.com/sitemap.xml");

    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.ok()).toBe(true);
    expect(await sitemap.text()).toContain("<loc>https://wewontbuy.com/</loc>");
  });
});

test("hides prerendered markup from JavaScript visitors until the client renders", async ({ page }) => {
  // With JavaScript on but the app bundle not loaded yet, the English default
  // markup must not show: the client may render another locale or saved state.
  await page.route("**/assets/*.js", (route) => route.abort());
  await page.goto("/");

  await expect(page.locator("#app")).toHaveAttribute("data-prerendered");
  await expect(page.locator("#app")).toBeHidden();
});

// The prerendered markup alone satisfies most content assertions, so each
// entry needs its own proof that the client booted and bound its events.
for (const path of entryPaths) {
  test(`${path} replaces prerendered markup with the client render`, async ({ page }) => {
    await page.goto(path);

    await expect(page.locator("#app")).not.toHaveAttribute("data-prerendered");
    await expect(page.getByRole("heading", { level: 1, name: heroTitle })).toBeVisible();

    await page.locator(".cart-toggle").click();
    await expect(page.locator(".cart-drawer")).toHaveClass(/is-open/);
  });
}
