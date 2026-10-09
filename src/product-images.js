// Naming convention for the WebP renditions written next to each generated
// product PNG. Shared by
// scripts/optimize-product-images.mjs and the view, so it must stay importable
// from plain Node.
export const PRODUCT_IMAGE_WIDTHS = [480, 800, 1024];

const PNG_EXTENSION = /\.png$/;

export function productImageRendition(pngPath, width) {
  return pngPath.replace(PNG_EXTENSION, `-${width}.webp`);
}

export function productImageSrcset(pngUrl) {
  if (!PNG_EXTENSION.test(pngUrl)) return "";
  return PRODUCT_IMAGE_WIDTHS.map((width) => `${productImageRendition(pngUrl, width)} ${width}w`).join(", ");
}
