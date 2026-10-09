import { defineConfig } from "vite";
import { resolve } from "node:path";
import { prerenderApp } from "./scripts/prerender-plugin.mjs";

export default defineConfig({
  // Served at the apex custom domain, so the base is always root.
  base: "/",
  plugins: [prerenderApp()],
  build: {
    rollupOptions: {
      // Real campaign paths let Cloudflare Web Analytics attribute visits by
      // message. Query strings are intentionally not the attribution key.
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        receipt: resolve(import.meta.dirname, "go/receipt/index.html"),
        ritual: resolve(import.meta.dirname, "go/ritual/index.html"),
        privacy: resolve(import.meta.dirname, "go/privacy/index.html"),
      },
    },
  },
});
