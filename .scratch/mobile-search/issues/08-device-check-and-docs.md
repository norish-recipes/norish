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

Part B, device (2026-11-20, Release build of e3e8e1b54, iPhone 18 Pro iOS 27.2):
- Maestro green, one run each: `search-results`, `search-narrow-ingredient`, `search-recent`, `calendar-plan-accessory`, `plan-from-today`, `plan-from-card`, `recipe-edit`, `add-to-groceries`, `import-from-link`, `recipes-realtime`, `timer-from-accessory`, `recipes-browse-filter`, `recipes-offline`, `recipe-controls`, `cook-mode`, `sign-out`, `session-expiry`, `offline-launch`. `delete-recipe` failed twice in a row (not a race): `tapOn: Delete` hit the swiped row's own Delete action behind the alert; the flow now taps the Delete below the alert's message, 5 runs in a row green (329a40ec3). App code unchanged; not compared against `b93eaf6e5`.
- Hand checks, all pass: an outside link (`norish://recipe/<id>`) opens the recipe in the Recipes tab from Search and from Recipes; a suggestion tapped in Search opens inside Search (Search tab stays selected); Quick filter and Tag chips are solid with no border, the Filters sheet chips keep theirs; an Ingredient chip keeps its name after backgrounding and reopening; "-" shows no suggestions, the search key confirms nothing, Recent stays empty.
- Found and fixed: Narrow to Ingredient rows never asked for their foods' icons, so they were blank until another screen had loaded them; `TypingSuggestions` now calls `useIngredientIcons` (test first, 0081a535a, 67e8ca79f). Seen on device after a rebuild; the Maestro runs above were on the build before it.
- Screenshots (light, 1206x2622, `apps/docs/static/img/screenshots/`, commit d5a393c2d): `mobile-search-page` (Recent, Categories, Quick filters, Tags), `mobile-search-typing` ("salad": two suggestions, Narrow to Ingredient with icon, Tag, Category, Scope chips; scrolled so none is clipped, so the "Search for" row is behind the header), `mobile-search-results` (Dinner chip, Best match, "In the title" and "Tag: Curry"), `mobile-search-ingredient` (chicken chip with icon, "Ingredient: ..." lines), `mobile-search-no-results` (Clear filters), `mobile-search-offline`.
- Not done: no "Ingredient: ..." line beside "In the title" in one shot (Tags scope was on for the Tag line); no thighs line (cards show breasts and stock). Android not run.
