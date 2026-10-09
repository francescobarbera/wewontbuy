import { expect, test } from "@playwright/test";
import { addFirstProduct, coolFirstProduct, firstProduct, startImaginaryCheckout } from "./catalog-helpers.js";

const PRODUCT_CDN = "https://cdn.wewontbuy.com/products/generated/";
// A valid 1x1 WebP, so the tests also catch candidates the browser can't decode.
const TINY_WEBP = Buffer.from("UklGRiQAAABXRUJQVlA4IBgAAABQAQCdASoBAAEAAgA0JaQABHQAAP5oAAA=", "base64");
const firstProductBase = firstProduct.image.replace(/\.png$/, "");

// The renditions aren't on the CDN until they're uploaded, and the browser picks
// the candidate from srcset/sizes, which is what these tests check.
test.beforeEach(async ({ page }) => {
  await page.route(`${PRODUCT_CDN}**`, (route) => route.fulfill({ contentType: "image/webp", body: TINY_WEBP }));
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

// decode() rejects for an image the browser can't decode. naturalWidth can't
// tell: with w descriptors it is the 1 px stub divided by the chosen density.
async function expectLoadedRendition(image, width) {
  await image.scrollIntoViewIfNeeded();
  const chosen = await image.evaluate(async (img) => {
    await img.decode();
    return img.currentSrc;
  });
  expect(chosen).toBe(`${firstProductBase}-${width}.webp`);
}

async function checkoutToReceipt(page) {
  await addFirstProduct(page);
  await startImaginaryCheckout(page);
  await page.getByRole("button", { name: "Skip check-in" }).click();
  await page.getByRole("button", { name: "Finish tracker" }).click();
}

test.describe("on a desktop screen", () => {
  test.use({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });

  test("cards pick the 480 px rendition and keep the PNG as src", async ({ page }) => {
    const image = page.locator(".product-card img").first();

    await expectLoadedRendition(image, 480);
    await expect(image).toHaveAttribute("src", firstProduct.image);
  });

  test("rack and cart thumbnails pick the smallest rendition", async ({ page }) => {
    await coolFirstProduct(page);
    await expectLoadedRendition(page.locator(".rack-card img").first(), 480);

    await addFirstProduct(page);
    await expectLoadedRendition(page.locator(".cart-item img").first(), 480);
  });

  test("the four-column receipt haul strip picks the smallest rendition", async ({ page }) => {
    await checkoutToReceipt(page);

    await expectLoadedRendition(page.locator(".haul-strip img").first(), 480);
  });
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });

  test("single-column cards pick the 1024 px rendition", async ({ page }) => {
    await expectLoadedRendition(page.locator(".product-card img").first(), 1024);
  });
});

test.describe("on a small tablet", () => {
  // Wide enough for two product columns, but the receipt haul strip is already
  // a single full-width column.
  test.use({ viewport: { width: 600, height: 900 }, deviceScaleFactor: 2 });

  test("the single-column receipt haul strip picks the 1024 px rendition", async ({ page }) => {
    await checkoutToReceipt(page);

    await expectLoadedRendition(page.locator(".haul-strip img").first(), 1024);
  });
});
