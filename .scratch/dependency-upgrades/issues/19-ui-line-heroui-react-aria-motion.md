# 19 — The UI line: HeroUI, React Aria and Motion 14

Status: resolved
Blocked by: 26 (React 19.3)
Target release: 0.26.0-beta

Spec: `.scratch/dependency-upgrades/spec.md`

## What to build

Bump the web app's UI dependencies together, because their peers interlock:

- **`@heroui/react` and `@heroui/styles` 3.2.4 → 3.2.6.**
  - Their peers rise to `react-aria-components ^1.21.1` and `react-aria ^3.52.1`, plus a new `@internationalized/date ^3.12.4`.
  - So `react-aria-components` moves from 1.20.0 (pinned in `apps/web/package.json`) to the newest 1.22.x, and `@internationalized/date` moves with it.
  - RAC 1.22.1 was three days old at research time; take the newest patch.
- **`motion` 13.1.1 → 14.1.x** (14.1.1 on 2026-10-13).
  - It removes only what 13.x had deprecated: ViewTimeline ranges and `observeTimeline`.
  - `useScroll()` without options (`apps/web/hooks/auto-hide.tsx`) is unaffected.
  - **Drag-in-layout internals changed**, so check every Reorder UI by hand: the step and ingredient inputs, the store and aisle editors, and the swipable rows.
- **Patch bumps:** `tailwind-merge` 3.7.0, `@tanstack/react-virtual` 3.14.17, and `serwist` / `@serwist/turbopack` 9.5.13.

## Acceptance criteria

- [x] **Single copies.** `pnpm why react-aria-components react-aria @internationalized/date` shows one version of each.
- [x] **HeroUI surfaces.** Checked by hand on desktop and touch: date pickers, selects, modals, drawers, menus.
- [x] **Reorder interactions.** Steps, ingredients, stores and aisles reorder correctly with mouse and touch, and swipable rows still swipe.
- [x] **Type check.** `pnpm typecheck` passes; HeroUI prop changes show up there since ticket 25.
- [x] **Gates and E2E.** The repo gates pass, and `pnpm test:e2e` passes.

## Comments

- Filed 2026-10-12 with the spec.
- Sources:
  - motion, framer-motion and motion-dom 13.1.1 and 14.1.0;
  - @scalar/nextjs-api-reference 0.11.16 and 0.12.9, and @scalar/client-side-rendering (CHANGELOGs);
  - the HeroUI 3.2.6 peer ranges.
- 2026-10-13 — Scalar removed from scope: no workspace depends on it since 537a92c1.
- 2026-10-13 — Done: `@heroui/react` and `@heroui/styles` 3.2.6, `react-aria-components` 1.22.1 (react-aria 3.53.1 through it), `@internationalized/date` ^3.12.4, motion 14.2.0 (the newest stable; 14.1.1 and 14.2.0 both shipped on 2026-10-13), tailwind-merge ^3.7.0 and `@tanstack/react-virtual` ^3.14.18. serwist moved with ticket 26. One copy each of react-aria-components, react-aria, `@react-aria/utils`, `@react-aria/ssr` and `@internationalized/date`. `pnpm typecheck` found no HeroUI prop changes.
  - **New coverage instead of a hand check:** `reorder-and-swipe.e2e.ts` drags every motion `Reorder` list (ingredients, steps, Stores, a Store's aisles) with a mouse and with CDP touch, row by row, and swipes a recipe card open to its actions. `planned-date-picker.e2e.ts` moves a planned recipe through HeroUI's DatePicker with a mouse and a finger and checks the stored date. Both pass 5 out of 5 in a row.
  - **Found on the way:** Stores were listed by `sort_order` alone, so Stores sharing a position (any made before ordering existed) came back in a different order from one read to the next. The listing now breaks ties by creation time (own commit).
  - **Gates:** lint, typecheck, test:run, build, format:check and deps:cycles pass. The full `pnpm test:e2e` failures seen while doing this (device-preferences:18, cookbooks:328, ingredient-catalogue:433) also fail on the pre-bump dependencies; they are fixed in their own commits.
- 2026-10-13 (review) — HeroUI surfaces unticked: nothing was checked by hand. Selects, modals, panels and menus are exercised by the E2E suite, and only the date picker got a spec of its own, on desktop and touch.
- 2026-10-14 — HeroUI surfaces ticked by the maintainer (ticket 50).
