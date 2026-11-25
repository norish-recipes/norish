# 06: Recipe pickers create explicitly

**What to build:** The Tag, Cuisine and Category pickers in the recipe editor, on web and mobile, show the household's existing entries first as you type. A new entry is only created through an explicit "Create 'x'" row. Editing another household's recipe offers that household's list. See the spec, "Tags, Cuisines and Categories".

**Blocked by:** 05

**Status:** ready-for-agent

- [x] **Web** pickers: `apps/web/components/shared/tag-input.tsx`, the category chips, and the cuisine picker in `apps/web/features/recipes/components/editor/provenance-fields.tsx`.
  - Existing entries match on the folded name.
  - "Create 'x'" appears only when no entry folds alike.
  - Typing and saving never creates an entry on its own.
- [x] **Mobile:** the same behaviour in the editor's tag, category and cuisine cards (`apps/mobile/src/features/recipe/components/editor/`).
- [x] **Another household's recipe:** the pickers read the recipe's household list, not the editor's.
- [x] **Copy** in all locales (`pnpm i18n:check`).
- [x] **Tests:** E2E on web for creating a Tag and a Cuisine from the picker and picking an existing one by a different case.
- [ ] A mobile device check of the same: runs with ticket 12's device check.

## Comments

- Save: the editors' `recipes.create` (sends `createEntries: false`) and `recipes.update` attach only entries the household's list has; a name it no longer has is dropped silently (as a deleted Tag already is on a stale list), not re-created, and not answered `stale`. REST create keeps `createEntries` true by default (published spec refreshed), REST edit, imports and AI still create. No SQL added: `replaceRecipeEntriesByNameTx` and `attachCategoriesToRecipeByInputTx` take an `EntryWriteOptions`.
- Offline: the Create row is offered but disabled with its own copy ("You can create ... when you are online."); `lists.add` is not Outbox-eligible. Picking existing entries works from the persisted `lists.list` read, empty if that list was never read online.
- Shared logic: `packages/shared-react/src/lists` (`matchEntries`, `createOffer`, `chosenEntries`, `useListEntries`, `useEntryPicker`); `lists` is now a cross-cutting folder in its eslint config. Another household's recipe: pickers pass `recipeId` (edit mode only), and a carried Cuisine is named from the recipe, never by id. Over-long names show `recipes.picker.tooLong`.
- `tag-input.tsx` is now only used by the allergies card and keeps its free-typing behaviour; the editor uses new `tag-picker.tsx` (chips extracted to `sortable-tag-chips.tsx`), so a chip click removes it and the in-form rename panel is gone from the editor.
- Deviations: web Cuisine Select became chips plus a combo box; mobile Category "Add" uses an inline field, not `Alert.prompt`; Tags are no longer split on spaces. Not run: the E2E (typechecks and lints), the device check.
