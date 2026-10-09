// Writes the WebP renditions of every generated product PNG next to it.
// Renditions newer than their PNG are skipped, so re-runs after a catalog
// regeneration only touch changed images. Requires ImageMagick 7 (`magick`) on
// PATH.
import { execFile } from "node:child_process";
import { readdir, rename, rm, stat } from "node:fs/promises";
import { availableParallelism } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { PRODUCT_IMAGE_WIDTHS, productImageRendition } from "../src/product-images.js";

const DEFAULT_DIR = "cdn-assets/products/generated";
const WEBP_QUALITY = 78;
// 0-6, slower and smaller as it rises; a one-off offline cost.
const WEBP_METHOD = 6;

const runMagick = promisify(execFile).bind(null, "magick");

export function parseArgs(argv) {
  const dirIndex = argv.indexOf("--dir");
  return { dir: dirIndex === -1 ? DEFAULT_DIR : argv[dirIndex + 1] };
}

async function modifiedAt(file) {
  try {
    return (await stat(file)).mtimeMs;
  } catch (error) {
    if (error.code === "ENOENT") return -Infinity;
    throw error;
  }
}

// Encodes to a temporary file and renames it into place: an interrupted run
// must not leave a truncated rendition that looks newer than its PNG and
// would be skipped by every later run.
async function writeRendition(pngPath, width, rendition) {
  const partial = `${rendition}.partial`;
  try {
    await runMagick([
      pngPath,
      "-resize",
      `${width}x${width}`,
      "-strip",
      "-quality",
      String(WEBP_QUALITY),
      "-define",
      `webp:method=${WEBP_METHOD}`,
      `webp:${partial}`,
    ]);
    await rename(partial, rendition);
  } finally {
    await rm(partial, { force: true });
  }
}

async function writeStaleRenditions(pngPath) {
  const sourceModifiedAt = await modifiedAt(pngPath);
  let written = 0;
  for (const width of PRODUCT_IMAGE_WIDTHS) {
    const rendition = productImageRendition(pngPath, width);
    if ((await modifiedAt(rendition)) >= sourceModifiedAt) continue;
    await writeRendition(pngPath, width, rendition);
    written += 1;
  }
  return written;
}

export async function optimizeProductImages(dir) {
  const pngPaths = (await readdir(dir)).filter((name) => name.endsWith(".png")).map((name) => path.join(dir, name));
  const queue = [...pngPaths];
  let written = 0;
  const worker = async () => {
    while (queue.length) {
      // Await first: `written += await ...` reads `written` before the await
      // and drops counts added by the other workers meanwhile.
      const count = await writeStaleRenditions(queue.pop());
      written += count;
    }
  };
  await Promise.all(Array.from({ length: availableParallelism() }, worker));
  return { images: pngPaths.length, written };
}

async function main() {
  const { dir } = parseArgs(process.argv.slice(2));
  try {
    const { images, written } = await optimizeProductImages(dir);
    console.log(`${written} renditions written for ${images} images in ${dir}.`);
  } catch (error) {
    const hint = error.code === "ENOENT" && error.path === "magick" ? " Install ImageMagick 7." : "";
    console.error(`Could not optimize product images in ${dir}: ${error.message}.${hint}`);
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
