import { expect, test } from "@playwright/test";

const path = "/how-to-stop-impulse-shopping/";
const canonical = "https://wewontbuy.com/how-to-stop-impulse-shopping/";
const title = "How to Stop Impulse Shopping Online | We Won't Buy";
const heading = "How to stop impulse shopping online";
const analyticsToken = "495b195421e4465784905fb1d9058da3";
const description =
  "Practical ways to pause an online shopping urge, plus a €0 fake cart so you can browse and check out without spending. No account, no cookies.";

test("the article page is a standalone document with one H1", async ({ page }) => {
  const response = await page.goto(path);

  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle(title);
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", canonical);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", description);
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", canonical);
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute("content", "article");
  await expect(page.locator('script[src*="cloudflareinsights.com/beacon.min.js"]')).toHaveAttribute(
    "data-cf-beacon",
    JSON.stringify({ token: analyticsToken }),
  );

  const jsonLdNodes = page.locator('script[type="application/ld+json"]');
  await expect(jsonLdNodes).toHaveCount(1);
  const jsonLd = JSON.parse(await jsonLdNodes.textContent());
  expect(jsonLd["@context"]).toBe("https://schema.org");
  expect(jsonLd["@type"]).toBe("FAQPage");
  expect(jsonLd.mainEntity).toHaveLength(3);
  expect(jsonLd.mainEntity[0].name).toBe("Will a fake shopping cart stop impulse buying?");

  await expect(page.locator("#app")).toHaveCount(0);
  await expect(page.locator(".product-card, .cart-toggle, .hero-copy, .hero")).toHaveCount(0);
  await expect(page.locator('script[src*="main"]')).toHaveCount(0);
  await expect(page.locator('link[rel="stylesheet"]')).toHaveCount(1);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("still serves the article, not the shop", async ({ page, request }) => {
    const response = await page.goto(path);

    expect(response?.status()).toBe(200);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(page.locator("#app, .product-card, .cart-toggle")).toHaveCount(0);

    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.ok()).toBe(true);
    expect(await sitemap.text()).toContain(`<loc>${canonical}</loc>`);
  });
});
