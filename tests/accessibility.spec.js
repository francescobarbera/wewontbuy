import { expect, test } from "@playwright/test";
import { SUPPORTED_LOCALES } from "../src/i18n.js";
import { addFirstProduct } from "./catalog-helpers.js";

// WCAG 2.5.3 Label in Name: speech-input users say what they see, so an
// aria-label must contain the control's visible text.
async function labelsMissingVisibleText(page) {
  return page.evaluate(() => {
    const normalize = (text) => text.replace(/\s+/g, " ").trim().toLowerCase();
    return [...document.querySelectorAll("button[aria-label], a[aria-label]")]
      .filter((element) => element.checkVisibility())
      .map((element) => ({ label: element.getAttribute("aria-label"), text: normalize(element.textContent) }))
      .filter(({ label, text }) => text && !normalize(label).includes(text));
  });
}

for (const locale of SUPPORTED_LOCALES) {
  test(`aria-labels contain the visible text in ${locale}`, async ({ browser }) => {
    const context = await browser.newContext({ locale });
    const page = await context.newPage();

    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await expect(page.locator(".language-control")).toHaveAttribute("data-current-locale", locale);
    expect(await labelsMissingVisibleText(page)).toEqual([]);

    await context.close();
  });
}

test("the closed cart drawer is inert so its controls are not focusable", async ({ page }) => {
  await page.goto("/");
  const drawer = page.locator(".cart-drawer");

  await expect(drawer).toHaveAttribute("inert", "");
  await expect(drawer).not.toHaveAttribute("aria-hidden");

  await addFirstProduct(page);
  await expect(drawer).toHaveClass(/is-open/);
  await expect(drawer).not.toHaveAttribute("inert");
  await drawer.locator(".cart-close").focus();
  await expect(drawer.locator(".cart-close")).toBeFocused();

  await drawer.locator(".cart-close").click();
  await expect(drawer).toHaveAttribute("inert", "");
});
