import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { optimizeProductImages } from "../scripts/optimize-product-images.mjs";
import { PRODUCT_IMAGE_WIDTHS, productImageRendition } from "../src/product-images.js";

const SOURCE_SIZE = 1024;
let dir;

function writePng(name) {
  const file = path.join(dir, name);
  execFileSync("magick", ["-size", `${SOURCE_SIZE}x${SOURCE_SIZE}`, "xc:gray", file]);
  return file;
}

function identify(file) {
  return execFileSync("magick", ["identify", "-format", "%m %w %h", file]).toString();
}

test.beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "product-images-"));
});

test.afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

test("writes a WebP rendition per width next to each product PNG", async () => {
  const pngs = [writePng("coat-0001.png"), writePng("bag-0002.png")];

  const result = await optimizeProductImages(dir);

  expect(result).toEqual({ images: 2, written: pngs.length * PRODUCT_IMAGE_WIDTHS.length });
  for (const png of pngs) {
    for (const width of PRODUCT_IMAGE_WIDTHS) {
      expect(identify(productImageRendition(png, width))).toBe(`WEBP ${width} ${width}`);
    }
  }
});

test("only rewrites renditions older than their PNG", async () => {
  writePng("coat-0001.png");
  const changed = writePng("bag-0002.png");
  await optimizeProductImages(dir);

  expect(await optimizeProductImages(dir)).toEqual({ images: 2, written: 0 });

  const later = new Date(Date.now() + 60_000);
  utimesSync(changed, later, later);
  expect(await optimizeProductImages(dir)).toEqual({ images: 2, written: PRODUCT_IMAGE_WIDTHS.length });
});

test("rejects and writes no rendition for an unreadable PNG", async () => {
  writeFileSync(path.join(dir, "broken-0003.png"), "not an image");

  await expect(optimizeProductImages(dir)).rejects.toThrow();

  expect(readdirSync(dir)).toEqual(["broken-0003.png"]);
});
