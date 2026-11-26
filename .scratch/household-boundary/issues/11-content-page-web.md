# 11: Content page on web

**What to build:** The Content tab in web Settings, replacing the Ingredients tab, built from the canvas (ticket 10). It has tabs for Tags, Cuisines, Categories and Ingredients, each with search, usage counts, an "unused" filter, Add, rename or merge, and delete. Instance Cuisines move here from Admin › AI. See the spec, "The Content page".

**Blocked by:** 05, 07, 10, 14

**Status:** ready-for-agent

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
