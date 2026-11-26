# 12: Content page on mobile

**What to build:** A Content row in mobile Settings opening a screen with tabs for Tags, Cuisines, Categories and Ingredients, built from the canvas (ticket 10). It has the same actions and rights as web, including the full Ingredients management that mobile lacks today. Admin settings stay web-only. See the spec, "The Content page".

**Blocked by:** 05, 07, 10, 14

**Status:** ready-for-agent

**Canvas:** https://claude.ai/artifact/PXzHGxBxCU4MmwF8scvixz#page-816ab097d43b, the iPhone boards: `project/CtPage.dc.html` (base) with the `Ct*` frames.

- [x] **The Settings row:** a Content row in `apps/mobile/src/features/settings/screens/settings-screen.tsx`, with routes under `apps/mobile/src/app/settings/`.
- [x] **Tags, Cuisines and Categories tabs:** list, search, counts, "unused" filter, Add, rename or merge, and delete with a count confirmation. Instance entries are read-only for members and editable by admins, with built-ins fixed. Shared logic lives in `packages/shared-react`, not copied per app.
- [x] **Ingredients tab:**
  - search and filters;
  - the food panel: name, spellings, parent, icon upload or generate, keep distinct, merge, delete and nutrition correction;
  - flags and Changed by AI;
  - Add.
- [x] **Copy** in all locales.
- [ ] **Device check** on the iOS simulator through the device tools: add, merge and delete a Tag; edit a food's parent and icon. (Runs in the device session.)

## Comments

- Routes under `settings/`: `content` (tabs; `?list=` opens one), sheets `content-add`, `content-entry`, `content-uses` (`kind`, `id`), `ingredient` (`id`), `ingredient-add`, `ingredient-filters`, `ingredient-changes`; the Content row sits under Household. Spellings, Parent and Merge pickers, Nutrition and its correction are pages inside the food sheet (Back, title, plus), so one draft holds them.
- Shared mobile components: `CountRow` (a name with count, tag, lock mark; card slices), `ListHeading` (section title with its (i) help), `SheetNote` (plain note text, lock or tone), `SearchFilterRow` (search with the filter menu or button); `PillButton` gained `centred` for "Merge into…". Existing `Segmented`, `Card`, `EmptyCard` and the `Sheet` kit are reused. All of it lives in `features/settings` (features never import each other).
- Moved to `packages/shared-react/src/ingredients`: `useIngredientDraft` (the food panel's draft, relocation and save, which now resolves whether it went through), `useIngredientPicker`, `useNutritionDraft`, `useDatasetFoodSearch`, `useIngredientTree`, the filters model plus `useIngredientFiltersStore` (zustand, new), `changeCopy`, `aiChangesView`, nutrition source copy. Web uses all of it (its panel keeps only the Pantry switch, which needs `groceries`); `IngredientIconField` takes the icon view from the draft; `upload` takes a Blob.
- Differs from the boards: no count beside tabs or foods (the catalogue has none, as on web); the food sheet has no Pantry row; Keep distinct shows only on a flagged food (there is no stored "distinct" state to show as off) and its switch fires `markDistinct`; Spellings are worded "translations" as on web; "Used by" is the row label, not "Recipes"; the filters are a sheet, not a menu, on Ingredients; a tapped recipe in Used by dismisses Settings and opens it in the tabs; credits and catalogue export are not on mobile.
- Device check walk: Settings > Content; add a Tag, rename it onto another (Merge), delete it (alert count); a server cuisine as member (lock, read-only sheet) and as admin (edit, delete count of every household); Ingredients: search, filters sheet, tree fold, a flagged food, Changed by AI; a food: icon upload and generate, parent, spellings (move, remove, junk alert), nutrition correction, merge, delete; empty, unused, nothing-matches and offline states; dark mode; Dynamic Type on the tabs (four labels in one row).
- Not done: no simulator run (Tags long-press menu of the board, `CtTagsMenu`, is not built: rows open the sheet on a tap, whose trash deletes); the typed-routes file `.expo/types/router.d.ts` (gitignored) was extended by hand for the new routes so `tsc` passes locally, and regenerates on `expo start`.
- Sheet bodies: `SheetBody` now gaps its blocks 16 pt by default (`gap-4` dropped from every caller that passed it); the sheet kit on the canvas draws 12 pt where the app uses 16 pt.
- Structure round: the Content files moved to `features/content` (Settings keeps its row; `OfflineCapsule` is shared in `components/`). One `PageControls` rhythm and one `ListFrame` for both lists, `sectionRows`/`HeadingRow` for headed lists, `CountRow` owns depth, fold, trailing and its skeleton, one `AiChange` row, `FitSheet`, `EntrySheet`, `ChoiceCard`, one field skeleton, one descriptor per list, one shared test setup (`content-setup`).
- Shared in `shared-react`: `useIngredientList` (tree mode), `useAIChangeCounts`, `DELETE_TOUCHES`, `CONTENT_LISTS`/`ENTRY_KINDS`/`isContentList`; web and mobile both use them.
- Left on purpose: web keeps its own Ingredients filters (`useState` in the screen, panel a child, applied in a transition, which a zustand store would make synchronous). `SheetNote`'s `px-2` already matches the sheet's `FieldError`, `SectionLabel` and password row, so it is unchanged.
