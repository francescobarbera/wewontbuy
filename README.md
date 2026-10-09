# We Won't Buy

**Live at [wewontbuy.com](https://wewontbuy.com/)**

A playful fast-fashion shopping simulator: browse, fill a cart and check out
without spending real money. Every product is fictional and AI-generated,
the cart total is imaginary, and the real charge is always 0.

It is a static Vite single-page app written in plain JavaScript, with no
framework and no backend. There are no cookies or accounts. Cart, profile and
money-not-spent totals live in `localStorage`, so clearing site data, using
private browsing or switching browsers resets them.

## Run locally

Requires Node.js and npm.

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

The production output goes to `dist/`.

### Build-time prerendering

The app renders in the browser, but `vite build` also runs a build-only plugin
(`scripts/prerender-plugin.mjs`). It imports the pure view module
(`src/view.js`) in Node, renders the default first-visit state, and writes that
markup into `#app` of every HTML entry (`index.html` and the `go/*` campaign
pages). Crawlers, link unfurlers and no-JS visitors get real content. JavaScript
visitors get a fresh client render with their own locale and saved state. No
headless browser is involved.

## Test

```bash
npx playwright install chromium   # first time only
npm test
```

Playwright builds and previews the app, then runs `tests/`. The product image
rendition spec also needs ImageMagick 7 (`magick`) on PATH.

## Project layout

- `src/`: app code (`main.js` client, `view.js` markup, `i18n.js` copy) and the
  generated catalog in `src/data/`.
- `scripts/`: catalog/image generation, image optimisation, prerendering and
  production verification.
- `DEPLOY.md`: how the site and product images are deployed.

## License

The code is released under the [MIT License](LICENSE).

Product images, the hero and social images, and the marketing copy (product
names and descriptions, site copy, and translations) are © Francesco Barbera,
all rights reserved, unless stated otherwise.

Product images were generated with
[SDXL-Turbo](https://huggingface.co/stabilityai/sdxl-turbo), licensed under the
Stability AI Community License. Powered by Stability AI.
