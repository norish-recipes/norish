# Skeletons and page loads

Status: done (08's calendar and today's meals followed on 2026-10-16, see its ticket)

Settled in a `/grill-with-docs` session on 2026-10-15. It builds on the facts in `.scratch/architecture-after-upgrades/`, especially its ticket 08, the Cache Components spike, whose measurements this spec reuses. The vocabulary is CONTEXT.md's **Skeleton** (added that day), **Device Preference**, **Device Kind**, **Offline Cache**, **Warm Set** and **Recovery**. Target Version: 0.26.0-beta. Nothing here is expensive to reverse, so it adds no ADR.

## Problem Statement

**The skeletons no longer look like their pages.**

- **Recipe, phone.** The skeleton draws ingredients, steps, nutrition and rating. The page also has notes, cooking time, provenance, source and cookbooks, in a different order, and a floating cooking-mode pill.
- **Recipe, desktop.** The skeleton has no cooking-mode button, provenance, notes or cookbooks cards. Its Steps header has a button the real one doesn't.
- **Groceries.** The skeleton adds a `p-6` wrapper, so every card shifts 24px when data lands. It has no aisle headings, icons or prices.
- **Calendar, phone.** The skeleton draws flat rows with two items per day. The page draws cards, and an empty day is a header only.
- **Recipe editor.** The skeleton has 7 sections where the form has 9, in a different order.
- **Login.** The skeleton has none of the auth frame: no wordmark, no language selector, no real fields.
- **Settings.** The skeleton draws generic cards without the real card headers.
- `groceries-skeleton.tsx` is dead code.

**Some pages show several loading states, or none.**

- Settings can show four in a row: `loading.tsx`, a Suspense fallback, the `dynamic()` fallback, then the tab's own `isLoading`.
- Groceries renders `loading.tsx` above its header while the screen below draws its own skeleton.
- Pantry inherits the grocery list's skeleton.
- The cookbook page shows a full-page spinner, and so do auth-error and the prompts form.
- Signup and the cookbook page have no `loading.tsx`.

**The server guesses the phone layout wrong.** Several components pick their layout from the window width in JS, and the server, which has no window, guesses a desktop:

- The calendar (`width = 768`), so a phone receives the desktop calendar and swaps to the phone one after hydration.
- The library grid and `useContainerColumns` (`width = 1024`), `useIsMobile` and `useMediaQuery` (no match).

**Cached data arrives late.** The Offline Cache is read back only after hydration *and* the browser's own session request, because `sessionUserId` comes from `useSession()`. A returning reader whose data is already in IndexedDB still sees a skeleton for a network round trip.

**The first paint waits on the stylesheet.** The Cache Components spike measured this on a Pixel 7 profile. The HTML arrives at 363 ms, but nothing paints until about 1.5 s, because the 55 KB stylesheet shares the link with about 1 MB of JS requested at the same moment.

**The server sends no page data.** Every page except the recipe editor fetches in the browser. On a cold load the recipe page waits for JS, the session request, then the recipe request.

## Solution

- **Every page has exactly one Skeleton in its own shape**, from the first frame until content arrives:
  - It draws only what every instance of the page has, as the reader's Device Preferences shape it.
  - Fixed words and icons render for real; only data is grey.
  - There are no full-page spinners and no stacked or borrowed fallbacks.
- **Phones get the phone layout on the first frame.** Wherever a layout is chosen in JS, the server's guess comes from Device Kind, and the browser corrects it to the window width after hydration.
- **The Offline Cache is read at hydration.** The signed-in app's layout passes the verified reader's id to the shell, so a returning reader sees their cached data without waiting for the session request.
- **Less competes with the first stylesheet.** What JS loads before first paint is measured and cut, with numbers before and after.
- **A measured pilot: the server sends the recipe page's data.** On a full load the first paint is the recipe itself. It is adopted only on a measured win, and then rolled out to the other pages whose data the URL alone names.

## User Stories

1. As a reader on a phone, I want a page's placeholder to look like the page, so that nothing jumps when the content arrives.
2. As a reader who hid nutrition or ratings, I want the placeholder to leave them out too, so that nothing appears only to vanish.
3. As a reader, I want one placeholder per page, not a spinner and then a placeholder and then another, so that loading looks like one calm step.
4. As a reader opening the calendar on a phone, I want the phone calendar from the first frame, so that it doesn't swap layouts in front of me.
5. As a reader returning to Norish, I want my cached recipes, groceries and calendar to show as soon as the app starts, so that I don't wait on the network for data I already have.
6. As a reader on a slow phone connection, I want the first frame to paint sooner, so that the app feels quick.
7. As a reader opening a recipe from a link or a reload, I want the recipe itself in the first frame, so that I'm not looking at a placeholder for data the server already had.
8. As a reader tapping a recipe card in the app, I want it to open no slower than today, so that the server sending data never costs me a tap.
9. As the maintainer, I want the server-data pilot adopted only on a measured win, so that the extra wiring earns its place.
10. As a household member sharing a device, I want the next person who signs in never to see my recipes offline, so that cached pages stay private.

## Implementation Decisions

### Skeletons

- **The Skeleton rule** (CONTEXT.md): only what every instance of the page has, shaped by Device Preferences. Optional sections (notes, provenance, cookbooks, cooking time, source, a day's meals) are left out, and repeated rows use a small fixed count. Content may push the page down; nothing drawn in the skeleton disappears.
- **Separate skeleton files stay**, refreshed against today's pages. No shared-frame refactor and no layout-comparison test (the maintainer, 2026-10-15).
- **Real words.** Headings ("Ingredients", "Steps"), card titles and icons, the settings tab bar (the server knows whether the reader gets the admin tab) and the auth frame's wordmark render for real.
- **One loading state per page.**
  - A route's `loading.tsx` and its page's own loading branch draw the same skeleton, so a hard load and a client navigation look the same.
  - Settings keeps one skeleton from `loading.tsx` through the tab's data: the Suspense, `dynamic()` and `isLoading` fallbacks draw that same skeleton, or go.
  - Groceries draws its skeleton once, below the header, and pantry gets its own.
  - The cookbook page, auth-error and the prompts form lose their spinners; cookbook and signup get a `loading.tsx`.
  - `groceries-skeleton.tsx` is deleted.
- **Kept as they are:** the library grid and recipe card skeletons (they match), and the offline shell's pulsing-logo splash. That splash shows only during an Offline launch of an uncached page, while the Offline Cache is read, and its static prerender must stay free of user data (ADR-0005).

### Device Kind on the first frame

- Every hook that guesses a width on the server takes its server and hydration value from the reader's Device Kind (`useDevicePreferences().kind` already carries it): `useIsMobile`, `useMediaQuery`, and the `useWindowSize` defaults in the calendar page, the timelines, the library grid and `useContainerColumns`. After hydration they follow the window as today, so a narrow desktop window still gets the phone layout once it has mounted.
- A layout CSS already switches (the recipe page) is left alone.

### The Offline Cache read at hydration

- The `(app)` layout already verifies the session in `readRequestProfile`. It passes the reader's id to `AppShell` beside the Device Preferences seed, and `OfflineCacheController` reconciles with it on first render instead of waiting for `useSession()`.
- An account switch takes the existing path: the seeded id differs from the cache's owner, so the departed owner's reads are purged first.
- The offline bootstrap mounts the shell unseeded and keeps its own path.

### First paint

- Measured with the Cache Components spike's method: the production build served as the architecture spec's ticket 12 runs it, Playwright as a Pixel 7 with CPU ×4, 1.6 Mbps down and 750 kbps up, service worker blocked, one warm-up load and then the median of 15 cold loads of `/`, a recipe page and `/groceries`.
- Find what JS and CSS load before first paint, defer what the first frame doesn't need, and let the stylesheet go first. What gets cut follows from the measurement; this spec doesn't pick it in advance.

### The server-data pilot

- **The recipe page only.** The server reads the recipe through the tRPC caller, as the editor page does, and hands it to the browser's query cache with `HydrationBoundary`. The page still reads only from the query cache (ADR-0001), so the server's copy is one more fill, never a second source.
- **Cache first in the app.** An in-app navigation renders from the browser cache when it has the recipe (the Warm Set holds the 50 most recent), and the skeleton otherwise. The server's data must never hold a navigation up, so it streams instead of blocking the page segment.
- **No extra fetch.** The server's copy counts as fresh, so it isn't fetched again on mount. Recovery's startup refetch still reconciles it with the server.
- **Cached pages are cleared on account switch.** Once documents carry recipe data, an account switch clears the service worker's page and RSC caches as well, under the same rule as the image cache (ADR-0005).
- **Adoption.** Using the First paint method, measure the median time until the recipe's title and ingredients are on screen (not the hero image, which loads on its own). The baseline is taken after the cache read at hydration and the first-paint work have landed, so their wins aren't counted twice. Adopt only if:
  - the median improves by more than the baseline's run-to-run spread, **and**
  - an in-app tap on an uncached recipe is no slower.
  - Otherwise revert and record the numbers, as the Cache Components spike did.
- **Rollout if adopted:** share, cookbook, groceries, pantry, today's meals and the calendar (its range from Device Kind). The library grid stays in the browser, because its filters live only there.
- The 0.26 architecture spec put "server-side prefetching with hydration boundaries" out of its scope, pointing at ADR-0001. That ADR rejects a second store beside the query cache; filling the same query cache from the server keeps it intact, which is why this pilot can go ahead.

## Testing Decisions

- **The first-paint E2E** (`apps/web/__tests__/e2e/ai/first-paint.e2e.ts`) grows:
  - Opened as an iPhone, the calendar's server markup is the phone calendar, and the library grid draws phone columns.
  - The pilot, if adopted: a recipe page's server markup (JavaScript disabled) carries the recipe's title. Its header comment, which says a recipe page draws only its skeleton on the server, is updated.
- **Unit tests:**
  - the width hooks return the Device Kind's answer on the server and during hydration
  - the cache controller restores from the seeded id without a session, and purges on a seeded id that differs from the owner
- **A new E2E in the offline project**, if the pilot is adopted: a cached recipe page is gone after another account signs in on the same browser.
- **Skeletons** have no new tests, by the maintainer's choice (no layout-comparison test). Existing tests that assert a skeleton's markup are updated with it.
- **Measurements are recorded in their tickets, not as tests:** first paint before and after, and the pilot's baseline and variant.
- Every commit passes the `CONTRIBUTING.md` gates plus `pnpm deps:cycles` and `pnpm format:check`. E2E runs against a fresh `pnpm build`.

## Out of Scope

- A shared frame between a page and its skeleton, and a test that compares their layouts.
- Server data for the library grid, whose filters live only in the browser.
- Cache Components (the architecture spec's spike measured and declined them).
- The offline shell's splash.
- The mobile app, which is parked.

## Further Notes

- **Order.**
  - The view-transitions work in the checkout (uncommitted on 2026-10-15) touches the recipe skeletons, the groceries layout and the cookbook page. It is committed before any ticket here starts.
  - Tickets 01 to 06 are independent of each other.
  - 07 waits for 01 and 06 (its baseline) and 03 (the recipe skeleton it falls back to).
  - 08 waits for 07 and runs only if the pilot is adopted.
- **Release notes**, Fixes and Improvements:
  - "Pages show a placeholder in their real shape while loading, and phones get the phone calendar from the start."
  - "Norish shows your saved data sooner when you open it."
  - If 06 or 07 move the numbers, they write the line with the measured gain. The maintainer will rewrite them.
- **Docs.** None: nothing here is configured or newly visible as a feature.
