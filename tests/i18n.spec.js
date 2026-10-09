import { expect, test } from "@playwright/test";
import { DEFAULT_LOCALE, LOCALE_KEY, SUPPORTED_LOCALES, translations } from "../src/i18n.js";

function flattenKeys(value, prefix = "") {
  if (Array.isArray(value)) return [prefix];
  if (!value || typeof value !== "object") return [prefix];

  return Object.entries(value).flatMap(([key, nestedValue]) =>
    flattenKeys(nestedValue, prefix ? `${prefix}.${key}` : key),
  );
}

function getValue(value, path) {
  return path.split(".").reduce((current, segment) => current?.[segment], value);
}

test("detects a supported browser language on first visit", async ({ browser }) => {
  const context = await browser.newContext({ locale: "it-IT" });
  const page = await context.newPage();

  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await expect(page.locator(".language-control")).toHaveAttribute("data-current-locale", "it");
  await expect(page.getByRole("heading", { name: "Sfoglia il desiderio. Tieni i soldi." })).toBeVisible();

  await context.close();
});

test("manual language choice persists and overrides browser detection", async ({ browser }) => {
  const context = await browser.newContext({ locale: "de-DE" });
  const page = await context.newPage();

  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await expect(page.locator(".language-control")).toHaveAttribute("data-current-locale", "de");
  await page.locator(".language-toggle").click();
  await page.getByRole("menuitemradio", { name: "Français" }).click();

  await expect(page.getByRole("heading", { name: "Parcourez l'envie. Gardez l'argent." })).toBeVisible();
  await expect(page.evaluate((key) => localStorage.getItem(key), LOCALE_KEY)).resolves.toBe("fr");

  await page.reload();
  await expect(page.locator(".language-control")).toHaveAttribute("data-current-locale", "fr");
  await expect(page.getByRole("heading", { name: "Parcourez l'envie. Gardez l'argent." })).toBeVisible();

  await context.close();
});

test("falls back to English for unsupported browser languages", async ({ browser }) => {
  const context = await browser.newContext({ locale: "pl-PL" });
  const page = await context.newPage();

  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await expect(page.locator(".language-control")).toHaveAttribute("data-current-locale", DEFAULT_LOCALE);
  await expect(page.getByRole("heading", { name: "Browse the feeling. Keep the money." })).toBeVisible();

  await context.close();
});

test("all supported locales include the English translation keys", () => {
  const englishKeys = flattenKeys(translations.en);

  for (const locale of SUPPORTED_LOCALES) {
    for (const key of englishKeys) {
      const englishValue = getValue(translations.en, key);
      const localizedValue = getValue(translations[locale], key);

      expect(localizedValue, `${locale}.${key}`).toBeDefined();
      expect(Array.isArray(localizedValue), `${locale}.${key} array shape`).toBe(Array.isArray(englishValue));

      if (Array.isArray(englishValue)) {
        expect(localizedValue, `${locale}.${key} array length`).toHaveLength(englishValue.length);
      } else {
        expect(typeof localizedValue, `${locale}.${key} value type`).toBe(typeof englishValue);
      }
    }
  }
});
