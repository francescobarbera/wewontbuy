import { expect, test } from "@playwright/test";

// The hero is the Largest Contentful Paint element, so it must be fetched early
// and no larger than the viewport needs.
test("loads a high-priority WebP hero sized for a desktop viewport", async ({ page, request }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");
  const hero = page.locator(".hero img");

  await expect(hero).toHaveAttribute("fetchpriority", "high");
  await expect.poll(() => hero.evaluate((img) => img.complete && img.currentSrc)).toMatch(/hero-editorial-1440\.webp$/);

  const candidates = (await hero.getAttribute("srcset")).split(",").map((entry) => entry.trim().split(" ")[0]);
  for (const url of candidates) {
    const response = await request.get(url);
    expect(response.status(), url).toBe(200);
    expect(response.headers()["content-type"], url).toBe("image/webp");
  }
});

test("prerendered hero keeps the image in the initial HTML for early discovery", async ({ request }) => {
  const html = await (await request.get("/")).text();

  expect(html).toMatch(/<img[^>]+srcset="[^"]*hero-editorial-960\.webp 960w/);
});

test.describe("on a short phone screen", () => {
  test.use({ viewport: { width: 390, height: 720 }, deviceScaleFactor: 1 });

  test("picks the smallest hero, since the narrow layout is only 86svh tall", async ({ page }) => {
    await page.goto("/");
    const hero = page.locator(".hero img");

    await expect.poll(() => hero.evaluate((img) => img.complete && img.currentSrc)).toMatch(/hero-editorial-960\.webp$/);
  });
});
