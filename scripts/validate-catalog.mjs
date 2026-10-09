import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_IN = "src/data/catalog.generated.js";
const bannedTerms = [
  "adidas",
  "balenciaga",
  "bottega",
  "burberry",
  "cartier",
  "chanel",
  "dior",
  "gucci",
  "h&m",
  "hermes",
  "louis vuitton",
  "lululemon",
  "nike",
  "patagonia",
  "prada",
  "supreme",
  "uniqlo",
  "vans",
  "versace",
  "zara",
];

export function parseArgs(argv) {
  const options = { in: DEFAULT_IN, requireImages: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const [rawKey, inlineValue] = arg.slice(2).split("=");
    const key = rawKey.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    if (key === "requireImages") {
      options.requireImages = true;
      continue;
    }
    options[key] = inlineValue ?? argv[index + 1];
    if (inlineValue === undefined) index += 1;
  }
  return options;
}

function fail(errors) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exitCode = 1;
}

function localizedText(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value.en || Object.values(value)[0] || "";
}

function hasBannedTerm(value) {
  const normalized = String(value).toLowerCase();
  return bannedTerms.find((term) => normalized.includes(term));
}

export function validateCatalog(catalog, options = {}) {
  const errors = [];
  const root = options.root || process.cwd();
  const productIds = new Set();
  const productNames = new Set();
  const categoryIds = new Set(catalog.categories || []);
  const collectionIds = new Set((catalog.collections || []).map((collection) => collection.id || collection));

  if (!Array.isArray(catalog.products) || !catalog.products.length) errors.push("Catalog has no products.");
  if (!Array.isArray(catalog.drops) || !catalog.drops.length) errors.push("Catalog has no drops.");
  if (!categoryIds.size) errors.push("Catalog has no categories.");
  if (!collectionIds.size) errors.push("Catalog has no collections.");

  for (const product of catalog.products || []) {
    if (!product.id) errors.push("Product is missing id.");
    if (productIds.has(product.id)) errors.push(`Duplicate product id: ${product.id}`);
    productIds.add(product.id);

    const name = localizedText(product.name);
    if (!name) errors.push(`${product.id} is missing an English name.`);
    if (productNames.has(name.toLowerCase())) errors.push(`Duplicate product name: ${name}`);
    productNames.add(name.toLowerCase());

    for (const field of [product.id, name, localizedText(product.note), product.imagePrompt]) {
      const term = hasBannedTerm(field);
      if (term) errors.push(`${product.id} contains banned real-world term "${term}".`);
    }

    if (!categoryIds.has(product.category)) errors.push(`${product.id} uses unknown category: ${product.category}`);
    if (!Array.isArray(product.collections) || !product.collections.length) {
      errors.push(`${product.id} has no collections.`);
    }
    for (const collection of product.collections || []) {
      if (!collectionIds.has(collection)) errors.push(`${product.id} uses unknown collection: ${collection}`);
    }
    if (typeof product.price !== "number" || product.price <= 0) errors.push(`${product.id} has invalid price.`);
    if (typeof product.impact !== "number" || product.impact <= 0) errors.push(`${product.id} has invalid impact.`);
    if (!product.image) errors.push(`${product.id} is missing image path.`);

    if (options.requireImages && product.image?.startsWith("/assets/")) {
      const imagePath = path.resolve(root, "public", product.image.slice(1));
      if (!fs.existsSync(imagePath)) errors.push(`${product.id} image does not exist: ${product.image}`);
    }
  }

  for (const drop of catalog.drops || []) {
    if (!drop.id) errors.push("Drop is missing id.");
    if (!localizedText(drop.name)) errors.push(`${drop.id} is missing an English name.`);
    if (!Array.isArray(drop.productIds) || !drop.productIds.length) errors.push(`${drop.id} has no products.`);
    for (const productId of drop.productIds || []) {
      if (!productIds.has(productId)) errors.push(`${drop.id} references unknown product: ${productId}`);
    }
  }

  return errors;
}

export function validationSummary(catalog) {
  return `Catalog valid: ${catalog.products.length} products, ${catalog.drops.length} drops.`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const inputPath = path.resolve(options.in);
  const module = await import(`${pathToFileURL(inputPath).href}?t=${Date.now()}`);
  const catalog = module.catalog || module;
  const errors = validateCatalog(catalog, options);

  if (errors.length) {
    fail(errors);
  } else {
    console.log(validationSummary(catalog));
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
