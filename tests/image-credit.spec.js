import { expect, test } from "@playwright/test";
import { SUPPORTED_LOCALES, translations } from "../src/i18n.js";

const STABILITY_ATTRIBUTION = "Powered by Stability AI";

test("credits the product image model in the page footer", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("contentinfo")).toHaveText(
    `Product images generated with SDXL-Turbo. ${STABILITY_ATTRIBUTION}.`,
  );
});

test("keeps the Stability AI attribution verbatim in every locale", () => {
  for (const locale of SUPPORTED_LOCALES) {
    expect(translations[locale].footer.credits, locale).toContain(STABILITY_ATTRIBUTION);
  }
});
