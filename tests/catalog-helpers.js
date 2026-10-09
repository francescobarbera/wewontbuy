import { collections, drops, products } from "../src/data/catalog.generated.js";

export const firstProduct = products[0];
export const firstProductName = localizedName(firstProduct);
export const firstProductPrice = String(Math.round(firstProduct.price));
export const firstCollection = collections[0];
export const firstCollectionName = localizedName(firstCollection);
export const currentDrop = drops[0];
export const currentDropName = localizedName(currentDrop);
export const currentDropNote = localizedValue(currentDrop.note);
export const currentDropProductCount = currentDrop.productIds.length;

export function addFirstProduct(page) {
  return page.getByRole("button", { name: /^Add to no-buy cart: / }).first().click();
}

export function coolFirstProduct(page) {
  return page.getByRole("button", { name: /Cool off .+/ }).first().click();
}

export async function startImaginaryCheckout(page) {
  await page.getByRole("button", { name: "Complete imaginary checkout" }).click();
  const profilePrompt = page.getByRole("dialog", { name: "Make the receipt yours." });
  if (await profilePrompt.isVisible()) {
    await profilePrompt.getByRole("button", { name: "Continue without a name" }).click();
  }
}

export function localizedName(entry) {
  return localizedValue(entry.name);
}

function localizedValue(value) {
  return typeof value === "string" ? value : value.en;
}
