import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { validateCatalog, validationSummary } from "./validate-catalog.mjs";

const DEFAULT_OUT = "src/data/catalog.generated.js";
const DEFAULT_ASSET_BASE = "/assets/products/generated";
const DEFAULT_IMAGE_OUTPUT_DIR = "public/assets/products/generated";
const DEFAULT_PLACEHOLDER_IMAGE = "/assets/hero-editorial.png";
const DEFAULT_COLLECTIONS = [
  { id: "sunday-scroll", name: { en: "Sunday Scroll" } },
  { id: "office-reset", name: { en: "Office Reset" } },
  { id: "going-out", name: { en: "Going Out Without Checking Out" } },
  { id: "microtrend", name: { en: "Microtrend of the Week" } },
  { id: "travel-capsule", name: { en: "Travel Capsule That Stays Home" } },
];
const DEFAULT_CATEGORIES = ["outerwear", "bottoms", "dresses", "tops", "shoes", "accessories"];
const DROP_NOTE = "All garments and product images in this drop are fictional AI-generated assets.";

const categoryParts = {
  outerwear: {
    nouns: ["Shell", "Mac", "Wrap", "Parka", "Jacket", "Coat", "Layer", "Anorak"],
    price: [58, 118],
    impact: [5.4, 10.2],
    subject: "piece of outerwear",
  },
  bottoms: {
    nouns: ["Trouser", "Skirt", "Denim", "Culotte", "Cargo", "Pant", "Short", "Column"],
    price: [34, 82],
    impact: [3.8, 8.8],
    subject: "lower-body garment",
  },
  dresses: {
    nouns: ["Slip", "Column", "Shift", "Wrap", "Tunic", "Midi", "Smock", "Dress"],
    price: [42, 96],
    impact: [4.2, 8.4],
    subject: "dress",
  },
  tops: {
    nouns: ["Knit", "Shirt", "Tank", "Tunic", "Blouse", "Tee", "Pullover", "Henley"],
    price: [22, 62],
    impact: [2.2, 5.8],
    subject: "top",
  },
  shoes: {
    nouns: ["Mule", "Slingback", "Runner", "Loafer", "Sandal", "Clog", "Flat", "Boot"],
    price: [38, 94],
    impact: [2.8, 6.8],
    subject: "shoe",
  },
  accessories: {
    nouns: ["Tote", "Pouch", "Scarf", "Cap", "Belt", "Sling", "Sleeve", "Satchel"],
    price: [16, 54],
    impact: [1.2, 4.2],
    subject: "fashion accessory",
  },
};

// Nouns whose apparel sense is a fixed compound the generic "{noun}-style {subject}"
// construction breaks (e.g. "tank-style top" renders a military tank). Map them to
// the canonical garment phrase instead.
const NOUN_SUBJECT_OVERRIDES = {
  Tank: "tank top",
};

const leads = [
  "Mistline",
  "Soft Index",
  "Errand",
  "Half-Light",
  "Quiet Tab",
  "Raincheck",
  "Drift",
  "Low Signal",
  "Studio Pause",
  "Washed Hour",
  "Still Cart",
  "Cloud Ledger",
  "Sidewalk",
  "Window Seat",
  "No-Ship",
  "Pocket Mood",
  "Calm Loop",
  "Late Checkout",
  "Folded",
  "Muted Day",
  "After-Scroll",
  "Slow Receipt",
  "Almost Needed",
  "Soft Return",
  "Fresh Maybe",
  "Future Self",
  "Clearance-Free",
  "Unordered",
  "Parcel-Less",
  "Wishline",
  "Open Tab",
  "Hold Music",
  "Soft Exit",
  "Fitting Room",
  "No Doorbell",
  "Pause Point",
];

const details = [
  "offset storm flap",
  "crescent seam",
  "hidden drawcord",
  "split placket",
  "softly squared pocket",
  "folded tab closure",
  "quiet contrast binding",
  "asymmetric panel line",
  "low-profile utility loop",
  "floating hem guard",
  "tonal matte trim",
  "soft box pleat",
  "recessed snap detail",
  "paper-touch edge",
  "curved side opening",
  "flatlock channel",
];

const materials = [
  "paper-touch cotton",
  "matte recycled twill",
  "cloud nylon",
  "soft rib modal",
  "washed poplin",
  "brushed compact knit",
  "lightweight canvas",
  "peached technical weave",
  "dry-touch satin",
  "soft mesh-backed cloth",
  "matte crepe",
  "compact jersey",
];

const palettes = [
  "chalk, graphite, and moss",
  "ink, oat, and faded citron",
  "clay, smoke, and paper white",
  "lilac grey, black tea, and cream",
  "pine, fog, and mineral blue",
  "plum, ash, and warm silver",
  "olive, bone, and washed navy",
  "brick, mist, and carbon",
  "butter yellow, slate, and ecru",
  "sea glass, charcoal, and soft white",
];

const moods = [
  "a commute that never reaches checkout",
  "the outfit fantasy after the urge passes",
  "a quiet browse with no parcel behind it",
  "an errand mood that stays fictional",
  "the cart ritual without the closet consequence",
  "a saved-for-later feeling that can remain saved",
];

function isFewStepModel(model) {
  return /turbo|lightning|schnell|lcm|hyper/i.test(model);
}

function parseArgs(argv) {
  const options = {
    count: 50,
    out: DEFAULT_OUT,
    assetBase: DEFAULT_ASSET_BASE,
    placeholderImage: DEFAULT_PLACEHOLDER_IMAGE,
    imageMode: "placeholder",
    imageProvider: "placeholder",
    imageModel: "",
    imageHost: "http://localhost:11434",
    imageBaseUrl: "",
    imageSize: "1024x1024",
    imageQuality: "medium",
    imageFormat: "webp",
    imageOutputDir: DEFAULT_IMAGE_OUTPUT_DIR,
    imageConcurrency: 2,
    imageLimit: 0,
    imagePython: "python3",
    imageVariant: "",
    imageSteps: 4,
    imageGuidance: 0,
    imageNegativePrompt:
      "logo, text, watermark, brand mark, monogram, label, tag, printed label, famous brand, recognizable product, person, human, model, mannequin, dummy, torso, head, neck, face, hands, hanger, display stand, wooden knob, props, accessories, shoes, boxes, packaging, cosmetics, pencil, multiple items, colored background, pink background, purple background, textured background, dark background, smoky background, dramatic backdrop, distorted, deformed, cropped, duplicate item, extra limbs",
    skipExistingImages: false,
    validate: true,
    seed: new Date().toISOString().slice(0, 10).replaceAll("-", ""),
    drop: "",
    append: false,
    replace: false,
    dryRun: false,
  };
  const providedKeys = new Set();

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const [rawKey, inlineValue] = arg.slice(2).split("=");
    const key = rawKey.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const value = inlineValue ?? argv[index + 1];
    providedKeys.add(key);

    if (["append", "replace", "dryRun", "skipExistingImages", "validate"].includes(key)) {
      options[key] = true;
      continue;
    }
    if (key === "noValidate") {
      options.validate = false;
      continue;
    }

    if (inlineValue === undefined) index += 1;
    options[key] = value;
  }

  options.count = Number(options.count);
  if (!Number.isInteger(options.count) || options.count < 1) {
    throw new Error("--count must be a positive integer.");
  }
  if (options.append && options.replace) {
    throw new Error("Use either --append or --replace, not both.");
  }
  if (!["placeholder", "expected"].includes(options.imageMode)) {
    throw new Error("--image-mode must be placeholder or expected.");
  }
  if (options.imageProvider === "local") options.imageProvider = "ollama";
  if (!["placeholder", "openai", "together", "ollama", "diffusers"].includes(options.imageProvider)) {
    throw new Error("--image-provider must be placeholder, openai, together, ollama, or diffusers.");
  }
  options.imageConcurrency = Number(options.imageConcurrency);
  options.imageLimit = Number(options.imageLimit);
  options.imageSteps = Number(options.imageSteps);
  options.imageGuidance = Number(options.imageGuidance);
  if (!Number.isInteger(options.imageConcurrency) || options.imageConcurrency < 1) {
    throw new Error("--image-concurrency must be a positive integer.");
  }
  if (!Number.isInteger(options.imageLimit) || options.imageLimit < 0) {
    throw new Error("--image-limit must be zero or a positive integer.");
  }
  if (!Number.isFinite(options.imageSteps) || options.imageSteps < 1) {
    throw new Error("--image-steps must be a positive number.");
  }
  if (!Number.isFinite(options.imageGuidance) || options.imageGuidance < 0) {
    throw new Error("--image-guidance must be zero or a positive number.");
  }
  if (options.imageProvider === "openai") {
    options.imageMode = "expected";
    options.imageModel ||= "gpt-image-1";
  }
  if (options.imageProvider === "together") {
    options.imageMode = "expected";
    options.imageModel ||= "black-forest-labs/FLUX.1-schnell";
    options.imageBaseUrl ||= "https://api.together.xyz/v1/images/generations";
    if (!providedKeys.has("imageFormat")) options.imageFormat = "png";
  }
  if (options.imageProvider === "ollama") {
    options.imageMode = "expected";
    options.imageModel ||= "x/z-image-turbo";
    if (!providedKeys.has("imageFormat")) options.imageFormat = "png";
  }
  if (options.imageProvider === "placeholder") {
    options.imageMode = "expected";
    if (!providedKeys.has("imageFormat")) options.imageFormat = "svg";
  }
  if (options.imageProvider === "diffusers") {
    options.imageMode = "expected";
    options.imageModel ||= "stabilityai/sdxl-turbo";
    if (!providedKeys.has("imageFormat")) options.imageFormat = "png";
    if (!isFewStepModel(options.imageModel)) {
      if (!providedKeys.has("imageSteps")) options.imageSteps = 30;
      if (!providedKeys.has("imageGuidance")) options.imageGuidance = 6.5;
    }
  }
  options.drop ||= `quiet-cart-${String(new Date().getUTCFullYear()).slice(2)}${String(new Date().getUTCMonth() + 1).padStart(2, "0")}`;
  return options;
}

function hashSeed(input) {
  return [...String(input)].reduce((hash, char) => Math.imul(hash ^ char.charCodeAt(0), 16777619), 2166136261) >>> 0;
}

function randomFactory(seed) {
  let value = hashSeed(seed);
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(list, random) {
  return list[Math.floor(random() * list.length)];
}

function round(value, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function titleCase(value) {
  return String(value)
    .split("-")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function monthYear() {
  return new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date());
}

function parseList(value, fallback) {
  if (!value) return fallback;
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseCollections(value, existingCollections) {
  const existing = Object.fromEntries(existingCollections.map((collection) => [collection.id, collection]));
  const ids = parseList(value, existingCollections.map((collection) => collection.id));
  return ids.map((entry) => {
    const [idPart, labelPart] = entry.split(/[:=]/);
    const id = slugify(idPart);
    return {
      id,
      name: { en: labelPart?.trim() || existing[id]?.name?.en || titleCase(id) },
    };
  });
}

async function readExistingCatalog(outPath) {
  if (!fs.existsSync(outPath)) {
    return { categories: [], collections: [], drops: [], products: [] };
  }
  const module = await import(`${pathToFileURL(outPath).href}?t=${Date.now()}`);
  return module.catalog || {
    categories: module.categories || [],
    collections: module.collections || [],
    drops: module.drops || [],
    products: module.products || [],
  };
}

function buildProduct({ category, collections, existingIds, existingNames, random, sequence, options }) {
  const parts = categoryParts[category] || categoryParts.accessories;
  let name = "";
  let noun = "";

  for (let attempts = 0; attempts < 200; attempts += 1) {
    const lead = pick(leads, random);
    noun = pick(parts.nouns, random);
    name = `${lead} ${noun}`;
    if (!existingNames.has(name.toLowerCase())) break;
  }

  const idBase = slugify(name);
  let id = `${idBase}-${String(sequence).padStart(4, "0")}`;
  while (existingIds.has(id)) {
    id = `${idBase}-${String(sequence + Math.floor(random() * 9999)).padStart(4, "0")}`;
  }

  const productCollections = [...collections]
    .sort(() => random() - 0.5)
    .slice(0, Math.min(collections.length, 1 + Math.floor(random() * 3)))
    .map((collection) => collection.id);
  const material = pick(materials, random);
  const detail = pick(details, random);
  const palette = pick(palettes, random);
  const mood = pick(moods, random);
  const subjectPhrase = NOUN_SUBJECT_OVERRIDES[noun] || `${noun.toLowerCase()}-style ${parts.subject}`;
  const [priceMin, priceMax] = parts.price;
  const [impactMin, impactMax] = parts.impact;

  existingIds.add(id);
  existingNames.add(name.toLowerCase());

  return {
    id,
    category,
    image:
      options.imageMode === "expected"
        ? `${options.assetBase.replace(/\/$/, "")}/${id}.${options.imageFormat}`
        : options.placeholderImage,
    price: Math.round(priceMin + random() * (priceMax - priceMin)),
    impact: round(impactMin + random() * (impactMax - impactMin)),
    collections: productCollections,
    name: { en: name },
    note: {
      en: `A fictional ${category.replace("-", " ")} for ${mood}.`,
    },
    design: {
      material,
      detail,
      palette,
    },
    imagePrompt: `Single isolated fictional ${subjectPhrase}, e-commerce product cutout photo on a plain white background. Original design with ${material}, ${detail}, and a ${palette} palette. Exactly one product, centered, full item visible, front view, realistic fabric texture, soft studio lighting.`,
  };
}

const MAX_IMAGE_RETRIES = 6;
const IMAGE_REQUEST_TIMEOUT_MS = 120000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffMs(attempt) {
  return Math.min(30000, 1000 * 2 ** attempt) + Math.floor(Math.random() * 250);
}

function retryDelayMs(response, attempt) {
  const retryAfter = Number(response.headers.get("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter > 0) return retryAfter * 1000;
  const reset = Number(response.headers.get("x-ratelimit-reset"));
  // Treat small values as seconds-until-reset; ignore epoch-style timestamps.
  if (Number.isFinite(reset) && reset > 0 && reset < 120) return reset * 1000;
  return Math.min(30000, 1000 * 2 ** attempt);
}

async function requestImage({ product, url, headers, body }) {
  let response;
  for (let attempt = 0; attempt <= MAX_IMAGE_RETRIES; attempt += 1) {
    try {
      response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(IMAGE_REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      // fetch throws on network errors and request timeouts; retry rather than
      // letting a single stuck request abort the whole batch.
      if (attempt === MAX_IMAGE_RETRIES) {
        throw new Error(`Image generation failed for ${product.id}: ${error.code || error.message}`);
      }
      const delay = backoffMs(attempt);
      console.warn(`Network error on ${product.id} (${error.code || error.message}); retry ${attempt + 1}/${MAX_IMAGE_RETRIES} in ${delay}ms.`);
      await sleep(delay);
      continue;
    }
    if (response.ok) break;

    // 400s here are almost always sporadic content-moderation false positives;
    // each retry re-rolls a fresh image, which typically passes.
    const retryable = response.status === 429 || response.status === 400 || response.status >= 500;
    if (!retryable || attempt === MAX_IMAGE_RETRIES) {
      const errorText = await response.text();
      throw new Error(`Image generation failed for ${product.id}: ${response.status} ${errorText}`);
    }
    const delay = retryDelayMs(response, attempt) + Math.floor(Math.random() * 250);
    await response.text().catch(() => {});
    console.warn(`Rate limited on ${product.id} (${response.status}); retry ${attempt + 1}/${MAX_IMAGE_RETRIES} in ${delay}ms.`);
    await sleep(delay);
  }

  const result = await response.json();
  const image = result.data?.[0];
  if (image?.b64_json) return Buffer.from(image.b64_json.replace(/^data:image\/\w+;base64,/, ""), "base64");
  if (image?.url) {
    const imageResponse = await fetch(image.url);
    if (!imageResponse.ok) {
      throw new Error(`Image download failed for ${product.id}: ${imageResponse.status}`);
    }
    return Buffer.from(await imageResponse.arrayBuffer());
  }

  throw new Error(`Image generation returned no image data for ${product.id}.`);
}

async function generateOpenAiImage(product, options) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required when --image-provider openai is used.");
  }

  return requestImage({
    product,
    url: options.imageBaseUrl || "https://api.openai.com/v1/images/generations",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: {
      model: options.imageModel,
      prompt: product.imagePrompt,
      n: 1,
      size: options.imageSize,
      quality: options.imageQuality,
      output_format: options.imageFormat,
    },
  });
}

async function generateTogetherImage(product, options) {
  if (!process.env.TOGETHER_API_KEY) {
    throw new Error("TOGETHER_API_KEY is required when --image-provider together is used.");
  }

  const [width, height] = parseImageSize(options.imageSize);
  const body = {
    model: options.imageModel,
    prompt: product.imagePrompt,
    width,
    height,
    n: 1,
  };
  // Only distilled few-step models accept (and need) an explicit step count;
  // managed "pro" models reject the steps parameter.
  if (isFewStepModel(options.imageModel)) body.steps = options.imageSteps;

  return requestImage({
    product,
    url: options.imageBaseUrl || "https://api.together.xyz/v1/images/generations",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.TOGETHER_API_KEY}`,
    },
    body,
  });
}

async function generateOllamaImage(product, options) {
  return requestImage({
    product,
    url: `${options.imageHost.replace(/\/$/, "")}/v1/images/generations`,
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer ollama",
    },
    body: {
      model: options.imageModel,
      prompt: product.imagePrompt,
      n: 1,
      size: options.imageSize,
      response_format: "b64_json",
    },
  });
}

function parseImageSize(size) {
  const [width, height] = String(size)
    .split("x")
    .map((part) => Number(part));
  if (!Number.isFinite(width) || !Number.isFinite(height)) return [1024, 1024];
  return [width, height];
}

function colorFromSeed(seed, offset) {
  const hue = (hashSeed(`${seed}:${offset}`) % 360) || 1;
  return `hsl(${hue} 28% ${offset % 2 ? 42 : 68}%)`;
}

function generatePlaceholderImage(product, options) {
  const [width, height] = parseImageSize(options.imageSize);
  const accent = colorFromSeed(product.id, 1);
  const shadow = colorFromSeed(product.id, 2);
  const highlight = colorFromSeed(product.id, 3);
  const detail = colorFromSeed(product.id, 4);
  const itemTop = Math.round(height * 0.18);
  const itemLeft = Math.round(width * 0.28);
  const itemWidth = Math.round(width * 0.44);
  const itemHeight = Math.round(height * 0.62);

  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Fictional generated product image">
  <rect width="${width}" height="${height}" fill="#f5f2ec"/>
  <ellipse cx="${width / 2}" cy="${height * 0.82}" rx="${width * 0.24}" ry="${height * 0.045}" fill="#d8d0c2"/>
  <path d="M ${itemLeft} ${itemTop + itemHeight * 0.12} C ${itemLeft + itemWidth * 0.08} ${itemTop + itemHeight * 0.02}, ${itemLeft + itemWidth * 0.27} ${itemTop}, ${itemLeft + itemWidth * 0.5} ${itemTop} C ${itemLeft + itemWidth * 0.73} ${itemTop}, ${itemLeft + itemWidth * 0.92} ${itemTop + itemHeight * 0.02}, ${itemLeft + itemWidth} ${itemTop + itemHeight * 0.12} L ${itemLeft + itemWidth * 0.87} ${itemTop + itemHeight} L ${itemLeft + itemWidth * 0.13} ${itemTop + itemHeight} Z" fill="${accent}"/>
  <path d="M ${itemLeft + itemWidth * 0.18} ${itemTop + itemHeight * 0.2} L ${itemLeft + itemWidth * 0.03} ${itemTop + itemHeight * 0.54} L ${itemLeft + itemWidth * 0.18} ${itemTop + itemHeight * 0.62} L ${itemLeft + itemWidth * 0.32} ${itemTop + itemHeight * 0.24} Z" fill="${shadow}"/>
  <path d="M ${itemLeft + itemWidth * 0.82} ${itemTop + itemHeight * 0.2} L ${itemLeft + itemWidth * 0.97} ${itemTop + itemHeight * 0.54} L ${itemLeft + itemWidth * 0.82} ${itemTop + itemHeight * 0.62} L ${itemLeft + itemWidth * 0.68} ${itemTop + itemHeight * 0.24} Z" fill="${shadow}"/>
  <path d="M ${itemLeft + itemWidth * 0.42} ${itemTop + itemHeight * 0.02} C ${itemLeft + itemWidth * 0.45} ${itemTop + itemHeight * 0.14}, ${itemLeft + itemWidth * 0.55} ${itemTop + itemHeight * 0.14}, ${itemLeft + itemWidth * 0.58} ${itemTop + itemHeight * 0.02}" fill="none" stroke="#f5f2ec" stroke-width="${Math.max(8, width * 0.014)}" stroke-linecap="round"/>
  <path d="M ${itemLeft + itemWidth * 0.5} ${itemTop + itemHeight * 0.18} L ${itemLeft + itemWidth * 0.5} ${itemTop + itemHeight * 0.92}" stroke="${highlight}" stroke-width="${Math.max(6, width * 0.01)}" stroke-linecap="round"/>
  <path d="M ${itemLeft + itemWidth * 0.24} ${itemTop + itemHeight * 0.55} C ${itemLeft + itemWidth * 0.38} ${itemTop + itemHeight * 0.61}, ${itemLeft + itemWidth * 0.62} ${itemTop + itemHeight * 0.61}, ${itemLeft + itemWidth * 0.76} ${itemTop + itemHeight * 0.55}" fill="none" stroke="${detail}" stroke-width="${Math.max(5, width * 0.008)}" stroke-linecap="round"/>
</svg>
`,
    "utf8",
  );
}

const CATEGORY_NEGATIVE_CONFLICTS = {
  shoes: ["shoes"],
  accessories: ["accessories"],
};

function categoryNegativePrompt(base, category) {
  const conflicts = CATEGORY_NEGATIVE_CONFLICTS[category] || [];
  if (!conflicts.length) return base;
  return base
    .split(",")
    .map((term) => term.trim())
    .filter((term) => !conflicts.includes(term.toLowerCase()))
    .join(", ");
}

function generateDiffusersImage(product, options, imagePath) {
  const helperPath = path.resolve("scripts/generate-product-image-diffusers.py");
  const seed = hashSeed(`${options.seed}:${product.id}`);
  const result = spawnSync(
    options.imagePython,
    [
      helperPath,
      "--prompt",
      product.imagePrompt,
      "--negative-prompt",
      categoryNegativePrompt(options.imageNegativePrompt, product.category),
      "--output",
      imagePath,
      "--model",
      options.imageModel,
      "--size",
      options.imageSize,
      "--variant",
      options.imageVariant,
      "--steps",
      String(options.imageSteps),
      "--guidance",
      String(options.imageGuidance),
      "--seed",
      String(seed),
    ],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  if (result.error) {
    throw new Error(`Diffusers image generation failed for ${product.id}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`Diffusers image generation failed for ${product.id}: ${output}`);
  }
  if (!fs.existsSync(imagePath)) {
    throw new Error(`Diffusers image generation did not write ${imagePath}`);
  }
  return null;
}

async function generateProductImage(product, options, imagePath) {
  if (options.imageProvider === "placeholder") return generatePlaceholderImage(product, options);
  if (options.imageProvider === "diffusers") return generateDiffusersImage(product, options, imagePath);
  if (options.imageProvider === "openai") return generateOpenAiImage(product, options);
  if (options.imageProvider === "together") return generateTogetherImage(product, options);
  if (options.imageProvider === "ollama") return generateOllamaImage(product, options);
  throw new Error(`Unsupported image provider: ${options.imageProvider}`);
}

async function runLimited(items, limit, worker) {
  let index = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const item = items[index];
      index += 1;
      await worker(item);
    }
  });
  await Promise.all(workers);
}

async function generateImages(products, options) {
  const outputDir = path.resolve(options.imageOutputDir);
  fs.mkdirSync(outputDir, { recursive: true });

  const candidates = products.filter((product) => {
    const imagePath = path.resolve(outputDir, `${product.id}.${options.imageFormat}`);
    return !(options.skipExistingImages && fs.existsSync(imagePath));
  });
  const selected = options.imageLimit ? candidates.slice(0, options.imageLimit) : candidates;

  const failed = [];
  await runLimited(selected, options.imageConcurrency, async (product) => {
    const imagePath = path.resolve(outputDir, `${product.id}.${options.imageFormat}`);
    try {
      const buffer = await generateProductImage(product, options, imagePath);
      if (buffer) fs.writeFileSync(imagePath, buffer);
    } catch (error) {
      // One image failing (e.g. persistent content-moderation) must not abort a
      // large batch; skip it and exclude the product from the catalog.
      console.warn(`Skipping ${product.id} after repeated failures: ${error.message}`);
      failed.push(product.id);
    }
  });

  return { generated: selected.length - failed.length, skipped: products.length - selected.length, failed };
}

function writeCatalog(outPath, catalog) {
  // imagePrompt is only consumed by this generator (to call the image API); it is
  // dead weight at runtime, so strip it from the shipped catalog. At 1k+ products
  // it is ~40% of the payload.
  const runtimeProducts = catalog.products.map(({ imagePrompt, ...product }) => product);
  const runtimeCatalog = { ...catalog, products: runtimeProducts };
  const source = `export const catalog = ${JSON.stringify(runtimeCatalog, null, 2)};\n\nexport const products = catalog.products;\nexport const categories = catalog.categories;\nexport const collections = catalog.collections;\nexport const drops = catalog.drops;\n`;
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, source);
}

const options = parseArgs(process.argv.slice(2));
const outPath = path.resolve(options.out);

if (fs.existsSync(outPath) && !options.append && !options.replace && !options.dryRun) {
  throw new Error(`${options.out} already exists. Use --append to add products or --replace to overwrite it.`);
}

const existingCatalog = options.replace
  ? { categories: [], collections: [], drops: [], products: [] }
  : await readExistingCatalog(outPath);
const baseCollections = existingCatalog.collections.length ? existingCatalog.collections : DEFAULT_COLLECTIONS;
const collections = parseCollections(options.collections, baseCollections);
const categories = parseList(options.categories, existingCatalog.categories.length ? existingCatalog.categories : DEFAULT_CATEGORIES);
const invalidCategories = categories.filter((category) => !categoryParts[category]);

if (invalidCategories.length) {
  throw new Error(`Unsupported categories: ${invalidCategories.join(", ")}`);
}
if (!collections.length) {
  throw new Error("At least one collection is required.");
}

const random = randomFactory(options.seed);
const existingIds = new Set(existingCatalog.products.map((product) => product.id));
const existingNames = new Set(existingCatalog.products.map((product) => product.name?.en?.toLowerCase()).filter(Boolean));
const startSequence = existingCatalog.products.length + 1;
const newProducts = Array.from({ length: options.count }, (_, index) =>
  buildProduct({
    category: categories[index % categories.length],
    collections,
    existingIds,
    existingNames,
    random,
    sequence: startSequence + index,
    options,
  }),
);

const products = options.append ? [...existingCatalog.products, ...newProducts] : newProducts;
const collectionById = new Map(
  [...(options.append ? existingCatalog.collections : []), ...collections].map((collection) => [collection.id, collection]),
);
const categoryIds = [...new Set([...(options.append ? existingCatalog.categories : []), ...categories])];
const drop = {
  id: slugify(options.drop),
  name: { en: options.dropName || titleCase(options.drop) },
  date: { en: options.dropDate || monthYear() },
  note: { en: options.dropNote || DROP_NOTE },
  productIds: newProducts.map((product) => product.id),
};
const previousDrops = options.append
  ? existingCatalog.drops.filter((existingDrop) => existingDrop.id !== drop.id)
  : [];
const existingDrop = options.append ? existingCatalog.drops.find((existing) => existing.id === drop.id) : null;

if (existingDrop) {
  drop.productIds = [...existingDrop.productIds, ...drop.productIds];
}

const catalog = {
  categories: categoryIds,
  collections: [...collectionById.values()],
  drops: [drop, ...previousDrops],
  products,
};

const summary = {
  out: options.out,
  mode: options.append ? "append" : options.replace ? "replace" : "create",
  generated: newProducts.length,
  totalProducts: products.length,
  imageProvider: options.imageProvider,
  imageModel: options.imageProvider === "placeholder" ? null : options.imageModel,
  imageFormat: options.imageFormat,
  imageHost: options.imageProvider === "ollama" ? options.imageHost : null,
  imageBaseUrl: options.imageBaseUrl || null,
  imagePython: options.imageProvider === "diffusers" ? options.imagePython : null,
  imageVariant: options.imageProvider === "diffusers" ? options.imageVariant || null : null,
  imageSteps:
    options.imageProvider === "diffusers" || (options.imageProvider === "together" && isFewStepModel(options.imageModel))
      ? options.imageSteps
      : null,
  imageGuidance: options.imageProvider === "diffusers" ? options.imageGuidance : null,
  drop: drop.id,
  collections: collections.map((collection) => collection.id),
  categories,
  seed: String(options.seed),
};

if (options.dryRun) {
  if (options.validate) {
    const errors = validateCatalog(catalog, {
      requireImages: false,
      root: process.cwd(),
    });
    if (errors.length) {
      console.error(errors.map((error) => `- ${error}`).join("\n"));
      process.exit(1);
    }
    summary.validation = validationSummary(catalog);
  }
  console.log(JSON.stringify(summary, null, 2));
} else {
  const imageSummary = await generateImages(newProducts, options);
  summary.images = imageSummary;
  if (imageSummary.failed.length) {
    const failedIds = new Set(imageSummary.failed);
    catalog.products = catalog.products.filter((product) => !failedIds.has(product.id));
    for (const dropRecord of catalog.drops) {
      dropRecord.productIds = dropRecord.productIds.filter((id) => !failedIds.has(id));
    }
    console.warn(`Excluded ${imageSummary.failed.length} product(s) without an image from the catalog.`);
  }
  writeCatalog(outPath, catalog);
  if (options.validate) {
    const errors = validateCatalog(catalog, {
      requireImages: !options.imageLimit,
      root: process.cwd(),
    });
    if (errors.length) {
      console.error(errors.map((error) => `- ${error}`).join("\n"));
      process.exit(1);
    }
    summary.validation = validationSummary(catalog);
  }
  console.log(JSON.stringify(summary, null, 2));
}
