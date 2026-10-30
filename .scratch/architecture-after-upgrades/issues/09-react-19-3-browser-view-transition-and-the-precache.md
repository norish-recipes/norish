# 09: React 19.3 `browser()`, a recipe ViewTransition, and the precache measured

**What to build:**

- The theme and language switches render without a flicker, on React 19.3's `browser()` instead of a hand-rolled mounted flag.
- Moving between pages slides the page by direction, and readers who prefer reduced motion get no transition.
- The maintainer learns what the service worker precache, downloaded again by every installed app each release, is made of.

See `.scratch/architecture-after-upgrades/spec.md`, React 19.3.

**Blocked by:** None within this spec. The branch starts from the rc once `chore/dependency-upgrades` has merged.

**Status:** ready-for-agent

- [x] Every mounted-flag pattern (found by search, including the theme switch and the language switch) uses `use(browser())` instead.
- [x] Every page slides in on navigation, and the navbar's tabs slide in their bar order (this replaced the card-to-hero shared element on 2026-10-15):
  - [x] It is skipped under reduced motion.
  - [x] There are no route cross-fades, and Motion keeps every in-page animation.
- [x] A browser E2E (`ai/page-transitions.e2e.ts`) opens a recipe from its card with reduced motion on and off, and the recipe page arrives intact both ways.
- [x] `next analyze` runs once against the precache. Record here the largest contributors and anything that looks avoidable. Acting on it is a separate decision.

## Comments

- 2026-10-16, second review: the mid-slide tap replay is gone. Next's guide accepts that named layers ignore hits during a transition ("keep transitions short"), and the replay swallowed a keyboard click after a cancelled tap. Back links land via `lib/scroll-memory.ts` (retrying while a loading.tsx skeleton grows), and navbar tabs always open at the top. Slide direction comes from the link's record in `lib/scroll-memory.ts`, not `transitionTypes`: React 19.3 queues types on the root (`queueTransitionTypes`) and the next transition or Suspense-retry commit claims them (`claimQueuedTransitionTypes`), so a retry on the page just left took `nav-back` from a quick tab tap (the tab-order E2E failed 2 of 9).
- 2026-10-15, review fixes: moves between recipe pages slide too (`app/(app)/recipes/template.tsx`), a back link returns the page to its scroll position, a tap made mid-slide is replayed once the slide ends (named layers ignore hits while they animate), the root no longer cross-fades, and the recipe tint fades once.
- 2026-10-15: the shared element is gone. Mike rejected the card-to-hero morph after trying it, so pages slide instead (`components/page-transition.tsx`, Next's `<Link transitionTypes>`) and `recipe-image-transition.tsx` was deleted. The 2026-10-14 notes on the shared element below describe removed code.
- 2026-10-14, implemented:
  - **`browser()` comes from `react-dom`, not `react`,** in 19.3.0 (`browser(reason?)`, a Usable). The theme and language switches now render their label inside `<Suspense>`, with the old "Loading…" row as the fallback and `use(browser(reason))` in the label. The `mounted` state, its effect and the `mounted` prop are gone.
  - **The search found three more flags, left as they are:**
    - `useMountedOnceOpened` keeps a panel mounted once it has been opened; that is not a mount flag.
    - The recipe filters' `isHydrated` waits for storage.
    - `useDockedTimers` keeps the first browser render equal to the server's markup, so the floating buttons beside it still render on the server. With `browser()` those buttons would drop out of the first paint.
  - **The shared element.** `RecipeImageTransition` (`components/recipes/recipe-image-transition.tsx`) is `<ViewTransition name="recipe-image-<id>" share="morph" default="none">`.
    - It wraps the card's `<img>`, and on the recipe pages the hero's media, not the chrome floating on it (`ReadonlyRecipeMedia`'s new `transitionId`; share pages pass none).
    - `globals.css` turns off the root cross-fade (`::view-transition-old/new(root)`), gives the morph 300 ms, and drops every view-transition animation under `prefers-reduced-motion: reduce`.
    - A one-off probe on the production build counted one `document.startViewTransition` call on a card click, with `recipe-image-<id>` the only named element.
  - **A bug the reduced-motion E2E turned up, fixed in its own commit (`ebd34176`).** Motion's `useReducedMotion` answers during the browser's first render. With reduced motion on, the dashboard heading therefore drew different markup than the server sent, and React threw error 418 on every load (3 of 3 runs). `hooks/use-prefers-reduced-motion.ts` reads the query through `useSyncExternalStore` with a server snapshot of `false`, and now serves all five users (library heading, rolling text, animated number, groceries slide, cooking steps).
  - **E2E.** `ai/recipe-view-transition.e2e.ts` opens a seeded recipe from its card with reduced motion on and off, and checks the title, the hero image loaded, and no page error. It passed 6 of 6 with `--repeat-each 3`.
  - **Precache.** The production build of 2026-10-14 was measured in two ways: the manifest in the prerendered `/serwist/sw.js`, and one run of `next analyze --output` with its `export` as JSON Lines.
    - **129 entries: 6.52 MB uncompressed, 2.09 MB gzipped.**
      - 116 JS chunks: 5.47 MB
      - one CSS file: 516 KB, 54 KB gzipped
      - `public/404.jpg` and `public/nora.jpg`: 301 KB together
      - the timer sound and a few small files
    - Largest chunks: 543 KB, 458 KB, 224 KB, 157 KB, 155 KB, 143 KB.
    - By package, client chunks only, raw / compressed:

      | Package                   | Raw      | Compressed |
      | ------------------------- | -------- | ---------- |
      | apps/web                  | 1,226 KB | 517 KB     |
      | next                      | 689 KB   | 271 KB     |
      | react-aria                | 602 KB   | 270 KB     |
      | zod                       | 383 KB   | 131 KB     |
      | @heroui/react             | 284 KB   | 129 KB     |
      | react-aria-components     | 252 KB   | 112 KB     |
      | @heroicons/react          | 237 KB   | 137 KB     |
      | packages/config           | 138 KB   | 28 KB      |
      | motion-dom                | 126 KB   | 61 KB      |
      | packages/shared-react     | 124 KB   | 55 KB      |

    - **Looks avoidable:**
      - `packages/config/src/units.default.json` (98 KB) and `ingredient-words.default.json` (31 KB) ship to the browser, through `packages/shared/src/lib/units.ts` and `spelling-keys.ts`, although the client asks tRPC for the units.
      - `drizzle-orm` (35 KB) and `packages/db-schema` (30 KB) are in client chunks.
      - The two `public/*.jpg` pictures, 301 KB, are downloaded by every installed app although only the 404 page and the empty states use them.
      - Each `@heroicons` icon is its own 3 to 8 KB module.
    - Acting on any of these is a separate decision.
