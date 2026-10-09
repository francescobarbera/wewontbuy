import { expect, test } from "@playwright/test";

const analyticsToken = "495b195421e4465784905fb1d9058da3";
const campaigns = [
  { path: "/go/receipt/", title: "A shopping spree where the real charge is zero" },
  { path: "/go/ritual/", title: "Finish the shopping urge without buying" },
  { path: "/go/privacy/", title: "A fake fashion shop that keeps your data local" },
];

for (const campaign of campaigns) {
  test(`${campaign.path} is a measurable campaign entry`, async ({ page }) => {
    const response = await page.goto(campaign.path);

    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(new RegExp(campaign.title));
    // Same body as the root page, so the root is the canonical URL; og:url keeps
    // the campaign path so shared links stay attributable.
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://wewontbuy.com/");
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
      "content",
      `https://wewontbuy.com${campaign.path}`,
    );
    await expect(page.locator('script[src*="cloudflareinsights.com/beacon.min.js"]')).toHaveAttribute(
      "data-cf-beacon",
      JSON.stringify({ token: analyticsToken }),
    );
    await expect(page.getByRole("heading", { name: "Browse the feeling. Keep the money." })).toBeVisible();
  });
}
