// Build-only Vite plugin: fills #app in every HTML entry of the build
// (vite.config.js build.rollupOptions.input) with the default-state markup so
// crawlers and no-JS visitors get real content. Plain Node only, no headless
// browser.
import { createDefaultState, renderAppHtml } from "../src/view.js";

const placeholder = '<div id="app"></div>';

function defaultStateHtml() {
  const appHtml = renderAppHtml(createDefaultState());
  const headingCount = (appHtml.match(/<h1[\s>]/g) || []).length;
  if (headingCount !== 1) {
    throw new Error(`Prerendered markup must contain exactly one <h1>, found ${headingCount}.`);
  }
  return appHtml;
}

export function prerenderApp() {
  return {
    name: "prerender-app",
    apply: "build",
    transformIndexHtml(html, { filename }) {
      const occurrences = html.split(placeholder).length - 1;
      if (occurrences !== 1) {
        throw new Error(`${filename}: expected exactly one empty ${placeholder}, found ${occurrences}.`);
      }
      const appHtml = defaultStateHtml();
      return {
        html: html.replace(placeholder, () => `<div id="app" data-prerendered>${appHtml}</div>`),
        // Flags JavaScript visitors before the body is parsed, so styles.css can
        // hide the English default markup until the client renders their locale
        // and saved state (see render() in src/main.js).
        tags: [{ tag: "script", children: 'document.documentElement.classList.add("js");', injectTo: "head-prepend" }],
      };
    },
  };
}
