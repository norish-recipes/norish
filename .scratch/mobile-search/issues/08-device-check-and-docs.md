# 08: Maestro, device check and docs

**What to build:** Close the set.

**Blocked by:** 07

**Status:** ready-for-agent

- [x] Maestro flows: confirm a search → results → open a recipe → back keeps the results; Narrow to an Ingredient; re-run a Recent Search. First-run green.
- [x] Device check, light and dark, every board on the Search page against the canvas.
- [ ] Docs page for mobile Search with screenshots and the release-notes lines for the Target Version (Terra).
- [ ] Gates green; `.scratch/mobile-search/spec.md` Status updated.

## Comments

Part A (2026-11-20):
- Flows (`apps/mobile/maestro/`, seed extended with a poultry > chicken > chicken thighs catalogue and `categories`): `search-results`, `search-narrow-ingredient`, `search-recent`. `search-results` passed first run; the other two failed at first write on selector mistakes (chip id is `search-chip-ingredient:<id>`; `testID` and text sit on different nodes), fixed in the flow, never retried; then each passed 3 runs in a row (`search-results` 1+3, `search-narrow-ingredient` 1+3, `search-recent` 1+3).
- Regression, one run each, all green: `recipes-browse-filter`, `recipes-offline`, `recipe-controls`, `cook-mode`, `sign-out`, `session-expiry`, `offline-launch`. The `b93eaf6e5` comparison was not needed.
- Device (iPhone 18 Pro, Release, light and dark, 130+ recipes with photos): fixed the Recent/suggestion cards (surface, not sand), Quick filter icons (muted, star orange), section heading height (`Section dense`: heading to content 16 pt, as the board), the no-results icon (warning ink). Scroll clears the field and Scope row (last Tags row, last Narrow-to row reachable).
- Found and fixed a bug: going Live after an Offline end-of-list did not load the next page (Recovery's refetch cancelled the one swallowed ask); `use-library-query` now asks again until a page lands (test written first, seen failing). Device: next page loads, position kept.
- Passed with no change: sign out/in wipes query, chips, scope, sort and Recent; a second account sees no Recent; Hidden Items (Favorites, "4 and up", Narrow-to and chip icons); fresh install Offline (no skeletons, Recent empty, typing shows only "Search for", confirm shows the connection card); Quick filter and Tag taps and ×; Filters sheet independent both ways; failed search while Live shows "Something went wrong." (a renamed table); paging 130 recipes and Offline end without a spinner.
- Left: headings and the no-results description read darker than the boards' muted in light mode (`text-muted` beside `text-[Npx]` resolves dark; `text-[length:..]` did not change it, not found); results card shows tags, not Category + servings (the shared card); uppercase headings, 2 suggestions, avatar, Filters icon, flat scrim, native × as accepted; keyboard search key is the system blue. Not run: Android; a SrNone chip "Under 15 min" (shot with Dinner chip).
