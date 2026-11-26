# 11: Content page on web

**What to build:** The Content tab in web Settings, replacing the Ingredients tab, built from the canvas (ticket 10). It has tabs for Tags, Cuisines, Categories and Ingredients, each with search, usage counts, an "unused" filter, Add, rename or merge, and delete. Instance Cuisines move here from Admin › AI. See the spec, "The Content page".

**Blocked by:** 05, 07, 10, 14

**Status:** done

**Canvas:** https://claude.ai/artifact/PXzHGxBxCU4MmwF8scvixz#page-816ab097d43b, the web boards: `project/WcPage.dc.html` (base) with the `Wb*` and `Wc*` frames.

- [x] **The tab:** `SETTINGS_TABS` (`apps/web/components/settings/settings-tab.ts`) gets `content` in place of `ingredients`, and the old route redirects.
- [x] **Tags, Cuisines and Categories tabs** run on ticket 05's procedures:
  - the household's entries plus the instance's;
  - search on the folded name;
  - the count of the household's recipes carrying each, and an "unused" filter;
  - Add, rename (onto an existing name merges, after a confirmation), and delete with a count confirmation;
  - instance entries read-only for members and editable by admins, with built-ins fixed.
- [x] **Ingredients tab:** today's `apps/web/features/ingredients/ingredients-screen.tsx` and its panel, plus Add (ticket 07).
- [x] **Admin › AI** loses `cuisine-vocabulary-form.tsx`. Cuisine strategy selects stay.
- [x] **Copy** in all locales.
- [x] **E2E:**
  - a member adds, renames onto another (merge) and deletes a Tag;
  - a member sees an instance Cuisine read-only, and an admin edits it;
  - household B never sees household A's entries.
- [x] **Docs screenshots** this outdates are listed for Mike.

## Comments

- Shared hooks (`packages/shared-react/src/lists`, ticket 12 builds on them untouched): `useContentList(kind)` (entries, search, unused filter, `view.sections`/`state`, offline), `useContentCounts()`, `useContentAdd(kind)` (matches, create offer, admin `canAddForServer`/`forServer`, `add()` answers entry and `created`), `useContentEntry(kind, id)` (draft name, `renameView` save-or-merge, `deleteImpact`, `problem` stale/failed, `gone`, `access` edit/readOnly/fixed), `useContentWrites(kind)` (stale rereads, offline sends nothing); pure `contentListView`, `renameView`, `entryAccess`. Ingredients: `useIngredientAdd(locale)` in `ingredients`. Removed `useCuisineMutations` and `useCuisinesQuery` (only the admin form used them).
- Route: `/settings/content/[list]` with `tags|cuisines|categories|ingredients`, so reload and shared links land on the list; `/settings/content` redirects to tags; `/settings/ingredients` redirects (query kept, so `?ingredient=` still opens the panel). `SETTINGS_TABS` has `content`.
- Server change: admin-only `lists.usage({ kind, id })` (instance Cuisines) over `countEntryRecipes` (query builder, count across households) for the admin delete confirm; `ListEntry` exported so `lists.list` keeps `recipeCount` in its type.
- Templates: no new variant. Added `PanelSection` (`components/Panel/panel-section.tsx`), shared with the ingredient panel.
- Differs from canvas: "Used by" is plain text, no chevron (the library filter has no address); no count beside Ingredients (the catalogue is paged); an admin picks "Add to" (household or server) in the Cuisine Add panel, which the canvas does not draw; the Ingredients card lost its description line (no subtitles); Add panel has no autofocus (lint rule); ingredient matches show no recipe counts; icons are Heroicons (no utensils or leaf).
- Docs screenshots outdated (apps/docs/static/img/screenshots): admin-cuisines.png; Ingredients tab: ingredients-list.png, ingredients-page.png, ingredients-changed-by-ai.png, ingredients-clean-names.png, ingredients-delete.png, ingredients-nutrition-correction.png, ingredients-panel-nutrition.png; full-page Settings captures with the tab bar: settings-after-planning.png, settings-change-password.png, hidden-items-settings.png, admin-prompts.png, admin-decision-model.png, admin-image-generation.png, admin-clean-up-catalogue.png, admin-fill-gaps.png, admin-job-details.png, admin-page-renderers.png, recipe-archive-admin-export.png (judged by size; a few may be crops).
- Left: E2E not run (typechecks). `config.cuisines` procedure is unused by the apps now but kept. A stray `eslint --fix` on `components/Panel` touched three consumer files; restored from HEAD.


### Review round 1

- 1 fixed: `ListRow` for the list card and both Add panels; none existed (the Ingredients row is two lines, indented and virtualised, so it keeps its own).
- 2 fixed: `ListFrame`.
- 3 fixed: `Section` with `placement` `card` or `panel`; `PanelSection` is gone.
- 4 fixed: `Panel.Body sections` carries the gap; the ingredient panels, calendar edit and recurrence panels use it. Still set their own gap: the two filters panels (`gap-6`) and `servings-control` (`gap-3`).
- 5 fixed: the card owns the gap; the skeleton rows are its direct children.
- 6 fixed: `EmptyState` in the `row` variant.
- 7 fixed: `SearchField`, logical padding, used by the Ingredients search too.
- 8 fixed: one `AddPanel` and `NameField`, used by the entry and ingredient Add panels and the entry panel.
- 9 fixed: the card nav slot owns the width; no read-only mark existed, the lock is the icon with a label.
- 10 fixed: info button whose label is the help (`Section`).
- 11 fixed: `lists.uses` over `listRecipesCarryingEntry`; "Used by" opens `EntryUsesPanel` with `RecipeLinks` (shared with the Ingredients uses panel); hook `useEntryRecipes`.
- 12 not changed: list items carry no household recipe count and a query per row is not wanted. Differs from the canvas ("18 recipes" on the Ingredient Add matches); for the maintainer.
- 13 fixed: built-in Categories show no Server chip.
- 14 fixed: lock in the note, counts formatted for the locale, `usedByOwn` plurals in every locale, mirrored Merge arrow and chevron.
- 15 fixed: per-list skeletons (Ingredients draws its card and Data sources); "Changed by AI" is `size="sm"` again.
- 16 fixed: writes read the lists again before they resolve; the name comes from the entry when not edited; tested in shared-react.
- 17 fixed: the confirmation shows stale (Done), failed (Delete again) and count failed (Retry).
- 18 fixed: `lists.usage` on `adminProcedure`.
- 19 fixed: moved to `packages/shared-react/src/lists`: admin and section titles/help (`contentListView`), `entryDetail` (note, badge, used key), `problemCopy`, `MATCH_LIMIT`, `useContentTarget`; `all` and `shown` removed.
- 20 fixed: `config.cuisines` removed with its invalidation and E2E reference.
- 21 fixed: `Inhoud`, straight apostrophe, doc comments trimmed.

Shared components: `components/shared/list-row.tsx` (`ListFrame`, `ListRow`), `section.tsx`, `search-field.tsx`, `recipe-links.tsx`; `components/Panel/Panel.tsx` (`sections`), `add-panel.tsx`, `name-field.tsx`.

For the maintainer: an admin's "Add to" choice in the Cuisine Add panel is not on the canvas.

Not run: the tests that need Postgres or Valkey (Docker was down), among them the new `list-entries` repository test and the `lists.uses` router test.

### Review round 2

- A1 fixed: onto `Panel.Body sections` and `Section`: the library filters, the Ingredients filters, recurrence, cookbook create and edit, share, nutrition and its correction, the offline status, add and edit grocery, product details, edit tag; servings has no headings, so it takes only `sections`. `Panel.Body` and `Note` take no `className`; a list that scrolls itself uses `Panel.Body fills`; the confirm modal's body owns the gap under a note. Left: the store editor and ingredient relocation (their wrapper is conditional).
- A2 fixed: the help button is 22 px and a heading is at least 22 px, with or without help.
- A3 fixed: one skeleton per list, the toolbar (`ContentToolbar`, off), section headings and rows from `ListRowSkeleton` and `IngredientRowSkeleton` in the list's frame; the Ingredients screen draws the same rows while it loads.
- A4 fixed: Changed by AI is the size of Add; a phone reads "1 to check" (`changedByAI.openCompact`).
- A5 fixed: `FieldLink`, the field's own look with the count and a chevron.
- A6 fixed: the body owns `pb-4`; the nutrition panels lost their inner `pb-2`.
- B7 (superseded below): the Ingredients panel's uses are neither paged nor capped (`listIngredientUses` has no limit and the panel has no "show more"), so there is nothing to copy. Proposal: a page of 50 by offset, `useInfiniteQuery` in `useEntryRecipes`, and a Show more button in the uses panel with copy in every locale; say if you want it.
- B8 fixed: "Ann's soup" sorts before "Apple pie"; the other new tests read again, no further slip.
- B9 fixed: closing the confirmation clears the outcome; a failed delete says `delete.failed`, in every locale.
- B10 fixed: a failed reread after Add says the list could not be loaded, with Retry in the Add panel.
- B11 fixed: `useContentAdd` lists no matches for an empty name.
- B12 fixed: the Add regression test runs on one shared client with the list cached and stale.
- B7 fixed after the answer: `lists.uses` pages by 50 (offset cursor, id breaks name ties), `useEntryRecipes` is an infinite query, the uses panel has Show more. The Ingredients panel's own uses read is still unbounded; the maintainer may want it paged the same way.

Kept as built: the stores and pantry lists' own look, `ActionButtonGroup`'s className.

Not run: the tests that need Postgres or Valkey, Docker was down (the `list-entries` and `lists.uses` tests among them), and the browser E2E.


### Browser check round

- Fixed from the first browser render: the card's actions sit at the right edge on a phone (`SettingsCard`); the picker rows span the picker; Ingredients rows are the shared two-line `ListRow` (60 px, 8/16 padding, icon at the edge, expander gutter only where a food has kinds, outline filter icon); the toolbar controls are one height (36 desktop, 40 phone); the loading list draws the header, toolbar and one frame (heading as a bar, none for Tags); the Merge note shows the merge arrow through a new `Note` `icon` prop.
- Name field, "Used by" and footer buttons are HeroUI's own 36/40 (the Account page's fields and Save measure the same), so left as they are.
- The Household B E2E failed because the empty list draws no search (as `WbTagsEmpty`); `openList` now waits for the search or the empty state. New E2E boxes: Add at the right edge on a phone, picker rows, and the first heading and frame not moving when the list arrives.
- Differs from the ask: the skeleton has no second section, so the check is on the first heading and frame, not the second heading.
- Playwright runs from two checkouts share `norish-e2e-results` and ports 20000-22000; run with `RUNNER_TEMP` set and not at the same time.

### Last fix round
- Fixed: Ingredients rows are `li` of the frame's own `ul` (`ListFrame virtual`, `ListRow offset`; test on roles), the name line wraps, one two-line rule (`detail`) for row and skeleton, a given `Note` icon replaces the lock (e231dd863, 6d1a59aa9).
- E2E: `openList` waits for loaded content and the isolation test shows B's own Tag first; the skeleton test releases in `finally` and holds only `lists.list`; picker count within 2 px of the right padding; search and toggle same height; Ingredients row 60 px (d191f06df, 5bccea9c1).
- The picker counts Ingredients as the boards do (`ingredients.count`, 3735bc643, 97eab36c8). All gates and the spec (x2) pass.

Gatekeeper, 2026-11-26: closed at b3f58639a after the browser render, two fix rounds and an independent gate run (seven gates and the Content E2E spec, all exit 0). Kept on purpose: the shared templates' values (48 px rows, 12 px frame radius, 448 px modal) where the canvas draws 50, 16 and 400. Open for Mike: "Used by" opens as a stacked panel over the entry panel.
