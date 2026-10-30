# 27 — Images are served at the size they're shown

Status: wontfix
Blocked by: 01 (the optimizer is off)
Target release: none

Spec: `.scratch/dependency-upgrades/spec.md`

## What to build

**What happens today.**

- Every recipe, step and cookbook photo is decoded by sharp on the way in and stored as one JPEG of at most 1280×720 (`packages/shared-server/src/media/storage.ts`, `MAX_WIDTH` / `MAX_HEIGHT`).
- That one file is served everywhere: on the recipe page, on a recipe card a few hundred pixels wide, and in the planner's thumbnail.
- The maintainer wants optimized images in 0.26. This ticket serves right-sized images, without Next's built-in optimizer.

**Why not `/_next/image`:**

- **It can't read Norish's photos.** The optimizer fetches a local image through an internal request with no headers, and so no session cookie: `fetchInternalImage` in `next/dist/server/image-optimizer.js` builds it with `headers: {}`. Norish's photos come from routes behind the auth proxy:
  - `/recipes/[id]/[filename]`;
  - `/recipes/[id]/steps/[filename]`;
  - `/cookbooks/[id]/[filename]`;
  - `/avatars/[id]`.

  The optimizer would get the sign-in redirect instead of the photo.

- **Letting it read them would leak them.** `/_next/image` is skipped by the proxy, so anyone could fetch private photos through it.
- **It covers little of what users see.** It could only serve the public paths: share links, static files and ingredient icons.
- **It is the endpoint behind this cycle's critical advisories**, and ticket 01 closes it. It stays closed: Next answers 404 on `/_next/image` whenever `images.loader` is not `'default'` (`next-server.js`).

**Default decision: right-sized variants from Norish's own pipeline.**

1. **Variants at write time.**
   - Where `storage.ts` writes a photo — it already decodes and resizes with sharp — also write **WebP** variants at a small fixed set of widths next to the original, for example `<name>.w320.webp` and `<name>.w640.webp`.
   - Pick the widths by measuring the rendered sizes at device pixel ratios 2–3: the recipe-card grid on phone and desktop, the planner thumbnail, the cookbook cover, the gallery and the lightbox. The original stays the largest size.
   - Why WebP: every browser Norish targets supports it, and it encodes much faster than AVIF on the import path.
2. **The media routes pick a variant.**
   - `serveRecipeMedia`, `serveRecipeStepMedia` and `serveCookbookMedia` in `apps/web/lib/recipe-media.ts`, and the share routes `share/[token]/media|steps/[filename]`, accept a `w` query parameter limited to the fixed set.
   - They serve the variant when it exists, and fall back to the original when it doesn't (photos the backfill hasn't reached yet).
   - Same auth as today, same `Cache-Control: public, max-age=31536000, immutable`.
   - An unknown `w` is a 400, so the routes can't be used to request arbitrary sizes.
3. **The UI asks for them.**
   - One helper builds `src`, `srcSet` and `sizes` for a media URL. The plain `<img>` call sites use it:
     - `components/dashboard/recipe-card.tsx`;
     - `components/calendar/planned-item-thumbnail.tsx`;
     - `components/cookbooks/cookbook-cover.tsx` and the cookbook panels;
     - `components/Panel/consumers/mini-recipes.tsx`;
     - `components/ui/carousel.tsx`;
     - `components/shared/fallback-image.tsx`.
   - The `next/image` call sites get the same through a custom loader. Set `images: { loader: "custom", loaderFile: "./lib/image-loader.ts" }` in `apps/web/next.config.js`, replacing ticket 01's `unoptimized: true`, and drop the per-component `unoptimized` props, so `srcset` is emitted. The loader leaves SVGs, `blob:` and `data:` URLs (upload previews) and external URLs untouched.
4. **Offline.**
   - The Warm Set (`apps/web/lib/query-cache/warm-set.ts`) writes primary images into the `norish-images` cache by exact URL, and the service worker serves same-origin images cache-first (`apps/web/app/sw.ts`, ADR-0009).
   - With `srcset` the browser chooses the URL, so the warmer warms **every variant** of each warmed primary image. They are small, so this costs little.
   - Re-check the 64-entry image budget the comment in `sw.ts` reasons about; variants multiply the entry count.
5. **Existing libraries.**
   - A one-off backfill job generates variants for existing photos. Run it on the existing queue infrastructure, at low priority and throttled, and make it resumable.
   - Until the backfill reaches a photo, the routes fall back to the original, so nothing breaks midway.
   - Deleting a photo deletes its variants.
6. **Archives.** Variants are derived data. The Norish archive (`packages/shared-server/src/archive/norish-writer.ts`) excludes them, and an import regenerates them, or leaves them to the backfill.

**Alternative**, if the maintainer prefers no extra storage and no backfill: resize on demand in the same routes — fixed widths only, with the result cached on disk next to the original. The UI and offline work stay the same; the first request for each size pays the CPU.

**Scope.** Avatars (`/avatars/[id]`) and ingredient icons are small already. Include them only if the measurement says so.

This can ship as two PRs: (a) variants on write, the routes and the UI; (b) the backfill job.

## Acceptance criteria

- [ ] **Measured win.** Bytes transferred for the dashboard's first 24 recipe cards are measured before and after, on a phone-sized viewport (DPR 3) and on desktop, and recorded in the comments, together with the storage added per photo.
- [ ] **Every photo surface renders the right image** on desktop and touch:
  - recipe cards and the recipe page gallery;
  - the lightbox, step images and cooking mode;
  - planner thumbnails and cookbook covers;
  - share links.
- [ ] **Endpoint still closed.** `/_next/image` still returns 404.
- [ ] **Route behaviour.** An unknown `w` returns 400, a missing variant falls back to the original, and a share link serves variants without sign-in, exactly as it serves originals today.
- [ ] **Offline.** A warmed recipe's images show offline; the offline E2E project is extended to cover a variant URL.
- [ ] **Backfill.** It covers an existing library, can be stopped and resumed, and doesn't starve imports.
- [ ] **Clean-up and archives.** Deleting a photo removes its variants, and a Norish archive round trip is unaffected.
- [ ] **Gates and E2E.** The repo gates pass, and `pnpm test:e2e` passes.
- [ ] **Release notes.**
  - A bullet under `## Fixes and Improvements`: "Recipe photos load faster: Norish now serves smaller versions sized for where they're shown."
  - An `## Upgrade notes` entry on the extra disk space and on the one-off background job that prepares existing photos.

## Comments

- Filed 2026-10-12 at the maintainer's request ("run optimized images in 0.26 if possible").
- Checked:
  - `fetchInternalImage`'s empty headers and the `loader !== 'default'` 404 in the next 16.4.0 tarball;
  - Norish's media routes, `storage.ts` sizes and the Warm Set in this repo.
- 2026-10-13 — Dropped by the maintainer. `/_next/image` stays switched off (ticket 26); Norish keeps serving one stored size.
