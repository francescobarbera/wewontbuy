import { expect, test } from "@playwright/test";
import { SUPPORTED_LOCALES, t } from "../src/i18n.js";

const rootTitle = "We Won't Buy: A No-Buy Shopping Simulator for Impulse Urges";
const rootDescription =
  "Feel the urge to shop? Browse a fake fashion shop, fill your cart and check out for free. A private tool for no-buy challenges and impulse shopping.";
const englishFaq = t("en", "faq.items");

async function expectFaq(page, locale) {
  const section = page.locator(".faq-section");
  const items = t(locale, "faq.items");

  await expect(section.getByRole("heading", { level: 2, name: t(locale, "faq.title") })).toBeVisible();
  await expect(section.getByRole("heading", { level: 3 })).toHaveCount(items.length);
  for (const item of items) {
    await expect(section.getByRole("heading", { level: 3, name: item.question, exact: true })).toBeVisible();
    await expect(section.getByText(item.answer, { exact: true })).toBeVisible();
  }
}

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("serves the prerendered FAQ with one <h1>", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("h1")).toHaveCount(1);
    expect(englishFaq).toHaveLength(8);
    await expectFaq(page, "en");
  });

  test("ships root title, descriptions and FAQPage JSON-LD", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(rootTitle);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", rootTitle);
    await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute("content", rootTitle);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", rootDescription);
    await expect(page.locator('meta[property="og:description"]')).toHaveAttribute("content", rootDescription);
    await expect(page.locator('meta[name="twitter:description"]')).toHaveAttribute("content", rootDescription);

    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    const faqPage = blocks.map((block) => JSON.parse(block)).find((data) => data["@type"] === "FAQPage");
    expect(faqPage).toEqual({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: englishFaq.map(({ question, answer }) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: { "@type": "Answer", text: answer },
      })),
    });
    expect(JSON.stringify(faqPage)).not.toMatch(/[<>]/);
  });
});

for (const locale of SUPPORTED_LOCALES) {
  test(`renders the FAQ in ${locale}`, async ({ browser }) => {
    const context = await browser.newContext({ locale });
    const page = await context.newPage();

    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await expect(page.locator(".language-control")).toHaveAttribute("data-current-locale", locale);
    await expect(page.locator("h1")).toHaveCount(1);
    await expectFaq(page, locale);

    await context.close();
  });
}
