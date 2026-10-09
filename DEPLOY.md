# Deploying We Won't Buy

- **App** (static Vite build) → AWS Amplify, served at `wewontbuy.com`.
- **Product images** → an S3 bucket behind CloudFront, served at `cdn.wewontbuy.com`.

The catalog (`src/data/catalog.generated.js`) stores absolute image URLs
(`https://cdn.wewontbuy.com/products/generated/<id>.png`), so images load from the
CDN and the app build stays code-only.

## Ship the app

Merge to `main`. Amplify builds it with `amplify.yml` (`npm ci && npm run build`)
and deploys `dist/` to `wewontbuy.com`.

## Publish the images

Images are generated locally into `cdn-assets/products/generated/` (git-ignored,
never built into the app). Write the WebP renditions the cards use (needs
ImageMagick 7), then sync everything to the CDN bucket:

```bash
npm run optimize:images
npm run deploy:assets
```

This needs AWS credentials allowed to write to the bucket. Re-run after any
regeneration.

## Verify

```bash
npm run verify:production
```

The command checks that:

- `origin/main` points to the expected commit;
- the Amplify `main` build succeeded for that commit (only when `AMPLIFY_APP_ID`
  is set; needs the AWS CLI);
- `https://wewontbuy.com/` serves the expected title, description, canonical URL,
  Open Graph tags, and Twitter card tags;
- the social preview, hero, and a sample CDN product image (and its WebP
  renditions) resolve;
- the live hero view contains the hook, trust cues, CTA, and no broken images.

It also writes a first-viewport screenshot to
`tmp/production-verification/wewontbuy-production.png` for manual visual review.

For local metadata/image debugging only, skip the deploy checks:

```bash
node scripts/verify-production.mjs --skip-deploy-check
```
