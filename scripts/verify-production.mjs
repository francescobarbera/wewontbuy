#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

import { products } from "../src/data/catalog.generated.js";
import { PRODUCT_IMAGE_WIDTHS, productImageRendition } from "../src/product-images.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const args = new Set(process.argv.slice(2));
const skipDeployCheck = args.has("--skip-deploy-check");
const skipScreenshot = args.has("--skip-screenshot");

const productionUrl = normalizeUrl(process.env.PRODUCTION_URL || "https://wewontbuy.com/");
const origin = new URL(productionUrl).origin;
const expectedCommit = process.env.EXPECTED_COMMIT || git(["rev-parse", "HEAD"]);
const amplifyAppId = process.env.AMPLIFY_APP_ID;
const amplifyBranch = process.env.AMPLIFY_BRANCH || "main";
const cloudflareAnalyticsToken = "495b195421e4465784905fb1d9058da3";
const screenshotPath =
  process.env.PRODUCTION_SCREENSHOT ||
  path.join(rootDir, "tmp", "production-verification", "wewontbuy-production.png");

const requiredHeroText = [
  "Browse the feeling. Keep the money.",
  "No account",
  "No cookies",
  "Real charge: 0",
  "Shop without buying",
];

const checks = [];

try {
  if (skipDeployCheck) {
    pass("Deploy checks skipped by --skip-deploy-check");
  } else {
    verifyMainRef();
    if (amplifyAppId) {
      verifyAmplifyBuild();
    } else {
      pass("Amplify build check skipped: AMPLIFY_APP_ID is not set");
    }
  }

  const expectedMetadata = await readExpectedMetadata();
  const liveHtml = await fetchText(productionUrl);
  verifyMetadata(liveHtml, expectedMetadata);
  verifyCloudflareAnalytics(liveHtml);

  await verifyPng(`${origin}/assets/social-preview.png`, { width: 1200, height: 630 });
  await verifyImage(`${origin}/assets/hero-editorial.png`, "hero image");
  await verifyImage(products[0].image, "sample CDN product image");
  for (const width of PRODUCT_IMAGE_WIDTHS) {
    await verifyImage(productImageRendition(products[0].image, width), `sample ${width} px WebP rendition`, "image/webp");
  }

  if (skipScreenshot) {
    pass("Production screenshot skipped by --skip-screenshot");
  } else {
    await verifyScreenshot();
  }

  console.log(`\nProduction verification passed for ${productionUrl}`);
  for (const check of checks) console.log(`✓ ${check}`);
} catch (error) {
  console.error(`\nProduction verification failed for ${productionUrl}`);
  for (const check of checks) console.error(`✓ ${check}`);
  console.error(`✗ ${error.message}`);
  process.exitCode = 1;
}

function pass(message) {
  checks.push(message);
}

function git(args) {
  return execFileSync("git", args, { cwd: rootDir, encoding: "utf8" }).trim();
}

function commandExists(command) {
  try {
    execFileSync("which", [command], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function verifyMainRef() {
  const mainCommit = git(["ls-remote", "origin", "refs/heads/main"]).split(/\s+/)[0];

  if (!mainCommit) throw new Error("Could not read origin/main.");
  if (mainCommit !== expectedCommit) {
    throw new Error(`origin/main (${mainCommit}) does not match expected commit ${expectedCommit}.`);
  }

  pass(`origin/main points to ${expectedCommit}`);
}

function verifyAmplifyBuild() {
  if (!commandExists("aws")) {
    throw new Error("AWS CLI is required for Amplify build verification. Install/authenticate aws, then rerun.");
  }

  const rawJobs = execFileSync(
    "aws",
    [
      "amplify",
      "list-jobs",
      "--app-id",
      amplifyAppId,
      "--branch-name",
      amplifyBranch,
      "--max-items",
      "10",
      "--output",
      "json",
    ],
    { cwd: rootDir, encoding: "utf8" },
  );
  const { jobSummaries = [] } = JSON.parse(rawJobs);
  const successfulJob = jobSummaries.find((job) => job.commitId === expectedCommit && job.status === "SUCCEED");

  if (!successfulJob) {
    throw new Error(`No successful Amplify ${amplifyBranch} build found for ${expectedCommit}.`);
  }

  pass(`Amplify ${amplifyBranch} build ${successfulJob.jobId} succeeded for ${expectedCommit}`);
}

async function readExpectedMetadata() {
  const localHtml = await readFile(path.join(rootDir, "index.html"), "utf8");
  return parseMetadata(localHtml);
}

function verifyMetadata(html, expected) {
  const live = parseMetadata(html);
  const keys = [
    "title",
    "description",
    "canonical",
    "og:type",
    "og:site_name",
    "og:url",
    "og:title",
    "og:description",
    "og:image",
    "og:image:alt",
    "og:image:width",
    "og:image:height",
    "twitter:card",
    "twitter:title",
    "twitter:description",
    "twitter:image",
  ];

  for (const key of keys) {
    if (!live[key]) throw new Error(`Live HTML is missing ${key}.`);
    if (live[key] !== expected[key]) {
      throw new Error(`Live ${key} is "${live[key]}", expected "${expected[key]}".`);
    }
  }

  pass("Live HTML metadata matches index.html");
}

function verifyCloudflareAnalytics(html) {
  if (!html.includes("https://static.cloudflareinsights.com/beacon.min.js")) {
    throw new Error("Live HTML is missing the Cloudflare Web Analytics beacon script.");
  }
  if (!html.includes(cloudflareAnalyticsToken)) {
    throw new Error("Live HTML is missing the expected Cloudflare Web Analytics token.");
  }

  pass("Live HTML includes the Cloudflare Web Analytics beacon");
}

function parseMetadata(html) {
  const metadata = {
    title: decodeHtml(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim() || ""),
    canonical: "",
  };

  for (const linkTag of html.matchAll(/<link\b[^>]*>/gi)) {
    const attrs = parseAttributes(linkTag[0]);
    if (attrs.rel === "canonical") metadata.canonical = normalizeUrl(attrs.href || "");
  }

  for (const metaTag of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = parseAttributes(metaTag[0]);
    const key = attrs.property || attrs.name;
    if (!key || attrs.content === undefined) continue;
    metadata[key] = normalizeMetadataValue(key, attrs.content);
  }

  return metadata;
}

function parseAttributes(tag) {
  const attrs = {};
  for (const attr of tag.matchAll(/([:\w-]+)\s*=\s*(['"])(.*?)\2/g)) {
    attrs[attr[1].toLowerCase()] = decodeHtml(attr[3]);
  }
  return attrs;
}

function normalizeMetadataValue(key, value) {
  if (["canonical", "og:url", "og:image", "twitter:image"].includes(key)) return normalizeUrl(value);
  return value.trim();
}

function normalizeUrl(value) {
  if (!value) return "";
  const url = new URL(value);
  if (url.pathname === "") url.pathname = "/";
  return url.toString();
}

function decodeHtml(value) {
  return String(value)
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "cache-control": "no-cache",
      pragma: "no-cache",
      "user-agent": "wewontbuy-production-verifier",
    },
  });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}.`);
  pass(`${url} returned HTTP ${response.status}`);
  return response.text();
}

async function verifyImage(url, label, expectedType = "image/") {
  const response = await fetch(url, {
    headers: {
      "cache-control": "no-cache",
      pragma: "no-cache",
      "user-agent": "wewontbuy-production-verifier",
    },
  });
  if (!response.ok) throw new Error(`${label} ${url} returned HTTP ${response.status}.`);
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.startsWith(expectedType)) {
    throw new Error(`${label} ${url} returned content-type "${contentType}", expected one starting with "${expectedType}".`);
  }
  await response.arrayBuffer();
  pass(`${label} resolves: ${url}`);
}

async function verifyPng(url, expectedSize) {
  const response = await fetch(url, {
    headers: {
      "cache-control": "no-cache",
      pragma: "no-cache",
      "user-agent": "wewontbuy-production-verifier",
    },
  });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}.`);
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("png")) {
    throw new Error(`${url} returned content-type "${contentType}", expected PNG.`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const signature = buffer.subarray(0, 8).toString("hex");
  if (signature !== "89504e470d0a1a0a") throw new Error(`${url} is not a valid PNG.`);

  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  if (width !== expectedSize.width || height !== expectedSize.height) {
    throw new Error(`${url} is ${width}x${height}, expected ${expectedSize.width}x${expectedSize.height}.`);
  }

  pass(`${url} resolves as ${width}x${height} PNG`);
}

async function verifyScreenshot() {
  await mkdir(path.dirname(screenshotPath), { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  try {
    await page.goto(productionUrl, { waitUntil: "networkidle", timeout: 60_000 });

    for (const text of requiredHeroText) {
      const count = await page.getByText(text, { exact: true }).count();
      if (!count) throw new Error(`Production page is missing first-viewport text: "${text}".`);
    }

    const brokenImages = await page.locator("img").evaluateAll((images) =>
      images
        .filter((image) => {
          const rect = image.getBoundingClientRect();
          const inFirstViewport = rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth;
          return inFirstViewport && (!image.complete || image.naturalWidth === 0 || image.naturalHeight === 0);
        })
        .map((image) => image.getAttribute("src") || image.currentSrc || "[missing src]"),
    );
    if (brokenImages.length) throw new Error(`Broken production images: ${brokenImages.join(", ")}`);

    await page.screenshot({ path: screenshotPath, fullPage: false });
  } finally {
    await browser.close();
  }

  pass(`Production screenshot captured: ${path.relative(rootDir, screenshotPath)}`);
}
