# 06: Less competes with the first stylesheet

**What to build:** The first frame paints sooner on a phone, because less loads alongside the stylesheet it waits for.

- Measure first, with the Cache Components spike's method (`.scratch/architecture-after-upgrades/issues/08-cache-components-spike.md`): the production build, Playwright as a Pixel 7 with CPU ×4, 1.6 Mbps down / 750 kbps up, service worker blocked, one warm-up load and the median of 15 cold loads of `/`, a recipe page and `/groceries`.
- Find what JS and CSS load before first paint. Defer what the first frame doesn't need and let the stylesheet go first. What gets cut follows from the measurement.

See `.scratch/skeletons-and-page-loads/spec.md`, First paint.

**Blocked by:** None.

**Status:** done

- [x] Before: first paint per page, and what loads before it, recorded here.
- [x] The cuts, one commit each.
- [x] After: the same numbers, recorded here. If a cut doesn't move first paint, it is reverted.
- [ ] The whole E2E suite passes against a fresh `pnpm build`. Run on 2026-10-15 against a fresh build of the checkout: everything passes except `calendar-planning.e2e.ts:73`, whose navbar Calendar link sits outside the viewport (auto-hidden). The checkout's uncommitted view-transition work changes the navbar's auto-hide; nothing here touches the dashboard, calendar or navbar, and it fails the same way with only 06 and 07 built.
- [x] If first paint moves, a release-notes line under Fixes and Improvements with the measured gain.

## Comments

- 2026-10-15, **two cuts, both kept.**
  - **Method.** The production build served on :3400 (`node --import tsx server/index.ts`) against the local stack, signed in as the dev owner. Playwright's Chromium as a Pixel 7, CPU ×4, 1.6 Mbps down / 750 kbps up (no added latency), service worker blocked; one warm-up and then the median of 15 cold loads, first paint from the Paint Timing entry. This harness paints sooner than the Cache Components spike's (about 0.95 s against its 1.5 s), so only its own before and after compare.
  - **What loads before first paint.** The document (43 KB gzip) and the one stylesheet (57 KB gzip, 532 KB raw) share the link. Chrome holds the 40 async script chunks (about 1 MB gzip) back until the stylesheet lands, so the JS does not compete; the HTML does. Two thirds of the HTML's RSC payload was the client messages, a third of them the settings tabs'. The stylesheet was 73% HeroUI component CSS, a fifth of it for components the app never draws. After the stylesheet lands, style, layout and paint take about 145 ms.

    | First paint (median, ms) | Before | Messages cut | Then the CSS cut | Spread after |
    | ------------------------ | -----: | -----------: | ---------------: | -----------: |
    | `/`                      |    952 |          900 |              800 |       784–828 |
    | a recipe page            |    896 |          840 |              732 |       724–736 |
    | `/groceries`             |    872 |          824 |              720 |       708–732 |

  - **Cut 1** (`b25f9faf0`): the settings tabs' messages ship with the settings route's own `NextIntlClientProvider`; the root keeps `settings.ingredients` and `settings.admin.aiProcessing`, the only settings reads outside it (a unit test guards that list). The document drops from 43 to 33 KB gzip.
  - **Cut 2** (`73fc74190`): `styles/heroui.css` imports HeroUI's entry piece by piece with only the components the app draws (traced through `@heroui/react`'s own imports), so the stylesheet drops from 57 to 48 KB gzip and 117 KB less CSS is parsed. Every kept rule compiles identically. `tw-animate-css` became a direct dependency, since HeroUI's entry imported it. The code review's guard test (`__tests__/heroui-styles.test.ts`, which traces every HeroUI component the app imports through `@heroui/react`'s own imports to the stylesheets they need) found one the hand trace had missed: the admin AI form's `Slider`, now imported again (`9a1aeebad`, about 0.5 KB gzip).
  - **Looked at and left:** the `@source` scan of HeroUI's dist adds 0.5 KB; the logo preload could shrink about 2 KB; the theme layer's bulk is Tailwind's `color-mix` fallbacks. None would clear the run-to-run spread.
