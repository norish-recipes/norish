# 26 — Next.js 16.4 and React 19.3

Status: resolved
Blocked by: 16 (pnpm 12)
Target release: 0.26.0-beta

Spec: `.scratch/dependency-upgrades/spec.md`

## What to build

Move Next.js to the latest minor — no 17.x exists on npm, not even as a canary — and React with it.

- **`next` 16.3.8 → 16.4.x.** 16.4.0 was released on 2026-10-06; take the newest 16.4 patch. The React peer range (`^18.2 || ^19`) and the Node engine (`>=20.9`) are unchanged.
- **`react`, `react-dom`, `@types/react` and `@types/react-dom` → 19.3.0**, together: react-dom 19.3 requires `react ^19.3.0`.
  - The App Router always renders with the React that Next bundles: `19.3.0-canary-278794d7-20261002` in 16.4.0. So the installed React matters to Vitest and Testing Library, and bumping it makes the tests run the same React as production.
  - There are no advisories against 19.2.3. The React Server Components advisories apply to `react-server-dom-*`, which Norish doesn't install.
  - The lockfile also carries react 19.2.8, which pnpm auto-installs as `next`'s peer for packages/api and packages/auth, which declare no react. Let it dedupe to 19.3.0, or declare it.
- **`next-intl` `^4.14.9`**, **`@next/eslint-plugin-next` `^16.4.x`** and **`@serwist/turbopack` 9.5.13**:
  - next-intl: use-intl's runtime is identical to 4.13.7. 4.14 adds an optional `@types/react` peer and fixes the plugin's Turbopack loader options.
  - The eslint plugin is identical apart from its version.
  - Serwist's change is dependency-only.
- **`apps/web/app/images/splash/route.tsx`: drop `export const runtime = "edge"`.** The edge runtime is deprecated and already warns, and the Node runtime is safe from 16.3.6. Re-check the splash PNG: `next/og` now bundles @vercel/og 1.0.1 and satori 0.29 (was 0.11.1 / 0.25).
- **The coding-agent upgrade nudge** (`experimental.agentUpgrade`, default `'security'` since 16.4). **Decision (2026-10-13): off.**
  - When a coding-agent environment variable is set (`CLAUDECODE`, `CODEX_*`, `CURSOR_AGENT`, `GEMINI_CLI`, …) and the installed Next has a published advisory, `next build` exits 1 at the end. The dev server — including Norish's custom one, which runs Next's router server — exits once; a retry within five minutes continues.
  - Dev mode queries registry.npmjs.org on every start (skipped in CI).
  - Production and CI are unaffected.
  - Set `experimental: { agentUpgrade: false }` in both Next configs. Otherwise a new advisory fails every agent's `pnpm build`, the repo's definition-of-done gate. Renovate (ticket 07) is where new advisories surface.
- **Switch the unused image optimizer off** (moved here from ticket 01, which shipped only its version bumps in 0.25): `images: { unoptimized: true }` in `apps/web/next.config.js`.
  - No visible change: every `next/image` already sets `unoptimized` or loads an SVG, and the other photos are plain `<img>`.
  - Next answers 404 on `/_next/image` whenever `images.unoptimized` is set. That endpoint is unauthenticated, because the auth proxy skips `_next`, so this removes the optimizer's attack surface for every future Next version.
  - Update the comment in `apps/web/app/sw.ts` that says recipe photos arrive "via /_next/image".
  - It stays off: ticket 27 (Norish's own right-sized images) was dropped.

## Notes

**What 16.4 changes that touches Norish:**

- **Internal routing was rewritten:** the route-matcher managers are gone and the client navigator is new. The custom server (`packages/api/src/startup/http-server.ts`) uses only `next()`, `prepare()` and `getRequestHandler()`. Their signatures are unchanged; only the internal `compileMode` option was dropped. This is the biggest behavioural risk, and only the E2E suite catches it.
- **Production Turbopack output** now uses one shared runtime plus a bootstrap inlined into the HTML, and mangles export names.
  - Serwist builds its precache list from `.next/static` when it prerenders `/serwist/[path]`; the offline E2E project covers that.
  - Inline scripts would clash with a page CSP, but Norish sets a CSP only on `/serwist/:path*`.
- **`reactBrowserBailout`** is on by default. No effect is expected: no `next/dynamic` call uses `ssr: false`.

**Doesn't touch Norish:**

- the parallel-routes slot changes and strict route matching (there are no `@slot` directories);
- the removed `appNewScrollHandler` and `partialPrefetching: 'unstable_eager'`;
- the Cache Components–only APIs (typed `cacheLife()`, `navigation()` / `prefetch()`, `ensureStatic`);
- FID attribution and the narrowed `experimental.ppr`;
- the React 18 deprecation warning;
- the `distDir` location check;
- the Turbopack worker-thread fallback on Node ≥ 24.13.1;
- `agentRules`, which only runs under `next dev` (apps/landing).

16.4 ships no codemods.

**Before Next 17.** 16.4 warns that Cache Components and Partial Prefetching become the default in the next major. Norish's root layout resolves the locale from the database, headers and cookies outside Suspense, so plan a spike before 17 (see the spec's held lines).

## Acceptance criteria

- [x] **Versions.** `next` is 16.4.x and React plus its types are 19.3.0. `pnpm why next react react-dom` shows one version of each.
- [x] **Upgrade nudge.** `agentUpgrade: false` is set in both Next configs.
- [x] **Optimizer off.** On a production build `/_next/image?url=/nora.jpg&w=640&q=75` returns 404, and every image surface still renders: recipe cards, the gallery, step images, cooking mode, the lightbox, planner thumbnails, cookbook covers, avatars and the logo.
- [x] **Splash.** `/images/splash?width=1170&height=2532&scheme=dark` renders correctly on the Node runtime.
- [x] **Service worker.** `/serwist/sw.js` still prerenders and returns 200 with its headers, and the offline E2E project passes.
- [x] **Smoke.**
  - Signed out, `/` redirects to `/login`.
  - The `/trpc` WebSocket connects.
  - `pnpm dev` boots.
- [x] **Gates.** `pnpm lint`, `pnpm typecheck`, `pnpm test:run`, `pnpm i18n:check`, `pnpm build`, the full `pnpm test:e2e`, `pnpm docker:build` with the health check, and `pnpm --filter @norish/landing build` all pass. Check the build log for new warnings.
- [x] **Release notes.** Under `## Fixes and Improvements`: the unused image optimization endpoint is no longer served. Next.js 16.4 itself is covered by the one dependency-updates line.

## Comments

- Filed 2026-10-12, split out of ticket 01 when the maintainer moved the minor upgrade to 0.26.
- Sources:
  - the next 16.3.8 and 16.4.0 tarballs (`dist/docs`, `server/config-shared.js`, `config-schema.js`, `lib/upgrade/nudge.js`, `server/lib/router-server.js`, `compiled/@vercel/og`);
  - react and react-dom 19.2.3 and 19.3.0;
  - next-intl 4.13.7 and 4.14.9.
- 2026-10-13 — Agent nudge off (maintainer). The optimizer switch-off moved here from ticket 01; ticket 27 was dropped, so it stays off.
- 2026-10-13 — Done: next 16.4.0 (the only 16.4 release), react, react-dom and their types 19.3.0, `@next/eslint-plugin-next` ^16.4.0, next-intl ^4.14.9, and `serwist` with `@serwist/turbopack` ^9.5.13 together (ticket 19 listed serwist; the two move as a pair). The lockfile holds one next, react and react-dom; react 19.2.8 had already gone with ticket 28. `agentUpgrade: false` in both configs, `images.unoptimized` on apps/web, the splash route on the Node runtime, the sw.ts comment fixed.
  - **Production image:** `/_next/image?url=/nora.jpg&w=640&q=75` → 404; `/` signed out → 307 to `/login`; `/serwist/sw.js` → 200 with `service-worker-allowed: /` and the policy headers; the splash renders 1170×2532 in both schemes (checked by eye); a signed-in `/trpc` WebSocket connects and stays open; health 200.
  - **Gates:** lint, typecheck, test:run, i18n:check, build (landing included), format:check and deps:cycles pass, and `pnpm dev` boots. `pnpm test:e2e`: 160 passed, 2 load-only failures (`offline.e2e.ts:475`, `ingredient-catalogue.e2e.ts:433`) whose files pass alone (29 tests).
  - **New build warnings:** Turbopack 16.4 also flags `packages/shared-server/src/lib/workspace-paths.ts:13,15` as dynamic filesystem access that traces the whole project, next to the existing `env-config-server.ts:35`. The image copies only `.next/standalone/apps/web/.next`, so nothing extra ships; left as is.
  - **Image surfaces** were not walked by hand. Every `next/image` already set `unoptimized` or loads an SVG, and the E2E projects render recipe cards, the gallery, steps and cooking mode.
- 2026-10-13 (review) — Optimizer off unticked: the 404 on a production build is verified; the image surfaces were not walked by hand, only exercised by the E2E suite.
- 2026-10-14 — Optimizer off ticked by the maintainer (ticket 50): the image surfaces are signed off.
