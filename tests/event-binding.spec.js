import { expect, test } from "@playwright/test";

test("re-rendering adds no listeners to elements that outlive a render", async ({ page }) => {
  // The analytics beacon registers its own window listeners over time.
  await page.route("https://static.cloudflareinsights.com/**", (route) => route.abort());
  await page.addInitScript(() => {
    window.__persistentListenerCount = 0;
    const addEventListener = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (...args) {
      const persistent = this === window || this === document || this?.id === "app";
      if (persistent) window.__persistentListenerCount += 1;
      return addEventListener.apply(this, args);
    };
  });
  await page.goto("/");
  await expect(page.locator("#app")).not.toHaveAttribute("data-prerendered");
  const countAfterBoot = await page.evaluate(() => window.__persistentListenerCount);

  for (const filter of await page.locator("[data-filter]").all()) {
    await filter.click();
  }

  expect(await page.evaluate(() => window.__persistentListenerCount)).toBe(countAfterBoot);
});
