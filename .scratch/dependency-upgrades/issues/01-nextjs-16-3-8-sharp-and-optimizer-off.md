# 01 — Next.js 16.3.8, sharp 0.35.5, and the unused image optimizer switched off

Status: resolved
Blocked by: None — can start immediately
Target release: 0.25.0-beta (safe fixes only)

Spec: `.scratch/dependency-upgrades/spec.md`

## What to build

A patch-level security fix, with no visible change. Next.js 16.4, React 19.3 and the rest of the Next.js line move in 0.26 (ticket 26). Right-sized images come in 0.26 too (ticket 27).

- **`next` 16.3.2 → 16.3.8** in the catalog (`pnpm-workspace.yaml`).
  - It is the patch release that carries every fix from 16.3.3–16.3.8.
  - It changes no defaults, and keeps the same React peer range (`^18.2 || ^19`) and Node engine (`>=20.9`).
  - The npm bulk-advisory endpoint reports nothing against it.
  - It closes:
    - three critical RCEs (AVIF in the image optimizer, Windows path handling, `next/og`);
    - an SSRF in the image optimizer;
    - two SSG/ISR cache poisonings;
    - three information disclosures.
- **sharp `^0.35.5`** in `packages/shared-server/package.json` and `tooling/ingredient-icons/package.json`.
  - It fixes the libheif (GHSA-rgj7-g3m4-5g8c) and librsvg (GHSA-wq5f-xc86-pv6w) advisories.
  - **The sharp bump is part of the Next fix.** 16.3.3–16.3.7 passed AVIF through untouched, and 16.3.8 decodes it again, relying on sharp ≥ 0.35.4. Since 16.3.4, Next declares an optional `sharp ^0.35.4`.
  - Norish's own media pipeline (`packages/shared-server/src/media/storage.ts`) decodes every uploaded and imported AVIF and HEIC with sharp.
  - With the hoisted linker two sharp versions can end up installed; bump both places.
- **`images: { unoptimized: true }` in `apps/web/next.config.js`**, which has no `images` key today.
  - **No visible change.** Every `next/image` in the app already sets `unoptimized` or loads an SVG, which Next never optimizes. The rest of the app's photos are plain `<img>`.
  - **What it closes.** Next answers 404 on `/_next/image` whenever `images.unoptimized` is set (`next-server.js`). That endpoint is unauthenticated, because the auth proxy skips `_next`, so the switch removes the whole optimizer attack surface (AVIF RCE, SSRF, optimizer DoS) for this and every future Next version.
  - **The comment in `apps/web/app/sw.ts`** that says recipe photos arrive "via /_next/image" becomes wrong; update it.
  - **apps/landing** is a static export and cannot use the optimizer; confirm it and leave it alone.
- **Nothing else moves.** React, next-intl, `@next/eslint-plugin-next` and the splash route's runtime all belong to ticket 26.

## Notes

**Exposure in Norish.** Reachability comes from the patch diffs, the advisory titles and Norish's code, not from the GHSA texts, which were unreachable from the sandbox.

| Advisory                                                                          | Reachable?                      | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AVIF RCE (GHSA-2xp9-vwfh-vxw4)                                                    | **Yes**                         | `/_next/image` is served (no `images` key) and skips the auth proxy (`apps/web/proxy.ts` matcher excludes `_next`). Its internal fetch carries no headers, but share links serve stored `.avif` media without sign-in (`lib/recipe-share-access.ts`, `lib/recipe-media.ts`), so a signed-in user can plant a file and anyone with the link can trigger the decode. Inferred, not reproduced. Separately, Norish's media pipeline decodes every imported or uploaded AVIF with sharp 0.35.3. |
| Windows RCE (CVE-2026-75604)                                                      | Not on the Docker image (Linux) | Windows dev machines and bare-metal hosts are exposed.                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `next/og` RCE (GHSA-vcvr-r3jv-pc5j)                                               | No                              | Only clamped integers and two fixed palettes reach the splash image.                                                                                                                                                                                                                                                                                                                                                                                                                        |
| SSRF (CVE-2026-94483)                                                             | No                              | No `remotePatterns` or `domains`, so remote images are never fetched.                                                                                                                                                                                                                                                                                                                                                                                                                       |
| SSG/ISR poisoning (CVE-2026-94484, CVE-2026-94543)                                | Unlikely                        | No ISR. The root layout reads headers and cookies; only `/serwist/sw.js` and the manifest are prerendered. Cannot be fully ruled out.                                                                                                                                                                                                                                                                                                                                                       |
| Metadata image routes (CVE-2026-94485), `use cache` + Draft Mode (CVE-2026-94544) | No                              | Neither is used.                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Dev MCP endpoint (CVE-2026-94486)                                                 | Dev only                        | The dev server binds 0.0.0.0, so the endpoint is reachable from the LAN while developing.                                                                                                                                                                                                                                                                                                                                                                                                   |

**Also in 16.3.3–16.3.8, beyond the security fixes:**

- 0-byte image-cache entries no longer break the cache;
- aliased TypeScript packages are detected;
- the CSP nonce reaches component scripts;
- `/_next/data` matching is case-sensitive;
- Playwright test-mode fetch recursion is fixed.

None of these touches Norish's usage.

## Acceptance criteria

- [ ] **Versions.** The catalog has `next` 16.3.8, and sharp is `^0.35.5` everywhere. `pnpm why next sharp` shows one version of each.
- [ ] **Audit.** `pnpm audit --prod` reports nothing for `next` or `sharp`.
- [ ] **Optimizer off.** On a production build `/_next/image?url=/nora.jpg&w=640&q=75` returns 404.
- [ ] **Every image still renders:**
  - recipe cards and the recipe page gallery;
  - step images and cooking mode;
  - the lightbox;
  - planner thumbnails and cookbook covers;
  - avatars, the logo and the landing site.
- [ ] **Media pipeline.** An imported or uploaded AVIF and HEIC image is still stored as JPEG.
- [ ] **Service worker.** `/serwist/sw.js` still prerenders and returns 200 with its headers, and the offline E2E project passes.
- [ ] **Smoke.**
  - Signed out, `/` redirects to `/login`.
  - The `/trpc` WebSocket connects.
  - `pnpm dev` boots.
- [ ] **Gates.** `pnpm lint`, `pnpm test:run`, `pnpm i18n:check`, `pnpm build`, the full `pnpm test:e2e`, `pnpm docker:build` with the health check, and `pnpm --filter @norish/landing build` all pass.
- [ ] **Release notes.** Under `## Fixes and Improvements` in `apps/docs/docs/release-notes/0.25.0-beta.md` (add the heading if it's missing): the security update to Next.js 16.3.8 and the image library, and the unused image optimization endpoint no longer being served. No environment variables change.

## Comments

- Filed 2026-10-12 with the spec.
- 2026-10-12 — Narrowed to the patch release after the maintainer split the work: safe fixes in 0.25, the hard work in 0.26. The 16.4 move is now ticket 26.
- Sources:
  - the next 16.3.2, 16.3.3, 16.3.8 and 16.4.0 tarballs (`server/config-shared.js`, `image-optimizer.js`, `next-server.js`);
  - the npm bulk advisory endpoint.
- 2026-10-13 — Next.js 16.3.8 and sharp 0.35.5 shipped in 0.25.0 (c7627004, PR #617). The optimizer switch-off and the `sw.ts` comment did not; they moved to ticket 26.
