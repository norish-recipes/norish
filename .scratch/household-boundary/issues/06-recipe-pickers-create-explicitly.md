# 06: Recipe pickers create explicitly

**What to build:** The Tag, Cuisine and Category pickers in the recipe editor, on web and mobile, show the household's existing entries first as you type. A new entry is only created through an explicit "Create 'x'" row. Editing another household's recipe offers that household's list. See the spec, "Tags, Cuisines and Categories".

**Blocked by:** 05

**Status:** done

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

Review round 1:

1. Fixed: a create selects through the picker's latest `onSelect`, so edits made while it waits stay.
2. Fixed: Save is disabled and `submit()` returns nothing while any `lists.add` is pending, on both apps.
3. Fixed: no Create row until the list has loaded; a failed read shows the error with retry; `recipeId` only for another household's recipe.
4. Fixed: an editor save attaches the household's exact Category before the alias mapping.
5. Fixed: one `hasName` fold rule for Tags, Categories and the Category add.
6. Fixed (verified: the error was tied to the typed name): it stays until the reader picks or tries again.
7. Fixed: chip cross and Backspace in the empty field remove a Tag; a plain click keeps it.
8. Fixed: the editors' `create` is its own procedure; REST create and the published spec lose `createEntries`.
9. Fixed: `entryPickerView` gives the problem, label key, "has" and exact match; the apps render.
10. Fixed: `builtInsFirst` sits with `matchEntries`; `carriedCuisines` is `PickerEntry[]`.
11. Fixed: unread returns removed; `AddChip` moved to `provenance-cards.tsx`.
12. Fixed: the choice screen's `ChoiceRow` serves entries and Create; `disabled` class moved last.
13. Fixed: the hand-written `useMemo` is gone.
14. Fixed: `settle`, `pickWhatIsTyped`, one-line comment on why.
15. Fixed: new E2E case saves with typed-only Tag and Category names and reads the lists through tRPC.
16. Fixed: the db test is named for what it checks; the REST create is covered through its router.

Rejected: Cuisine chips with a combo box, the mobile inline Category field, no space splitting, the silent drop of a name the list lost, lists as a cross-cutting folder, the allergies input.

Review round 2:

1. Fixed: pending creates are held by the picker that started them and end on settle, unmount or the send timeout (create-failed message); `lists.add` is uncaptured, never queued in the Outbox.
2. Fixed: a create answering after its picker has gone drops the answer (entry stays in the list); the web Cuisine picker adds an id only when it is not there.
3. Fixed: Category chips and `toggleCategory` use the shared `hasName` fold.
4. Fixed: an editor save attaches only the exact entries it names; the alias mapping is for imports and AI.
5. Fixed (verified: `lists.list` was not warmed): the warm set reads the Tag, Cuisine and Category lists.
6. Fixed: the Maestro seed makes Tags and Categories with `lists.add` before `recipes.create`; no other fixture sends names to a creating path.

Rejected: an Owner moving household while a housemate edits their recipe; the REST create tested through a test router; the E2E blurring before save.

Final review, server round:

- Fixed (776002851): `recipes.updateCategories` had no caller (apps, REST) and is deleted with its allowlist entry.

Whole-branch review, client round:

4. Fixed (bfb266705, e1df81de5, 85a65083e): an edit sends Tags, Cuisines and Categories only when the form changed them; an editor `recipes.update` naming a Tag, Category or Cuisine id its lists no longer have answers `stale` and writes nothing. This replaces the silent drop decided above for updates; editor create, imports, AI and REST keep it.
5. Fixed (2e3a87b1b): `createRecipe` and `updateRecipe` take `SaveCallbacks`; `onSaved` only for a stored or queued save, a stale answer or a refusal is `onFailed` and `failSave` shows it (stale as "Not saved: it changed elsewhere first"). Both editors leave only on `onSaved`.

Client re-review:

3. Fixed (9f3c77f99): a queued edit taking a pending one's place merges into it; fields it leaves out keep the earlier edit's, on the earlier version.
4. Fixed (a2750da1e): after a stale answer the form rereads the recipe and takes its version and the lists the reader left alone (`rebaseRecipeForm`); from Save to its answer the form is inert (web) or untouchable with the keyboard down (mobile).
5. Fixed (b271c79ca, 553164eb0): an empty Categories list clears, as Tags and Cuisines already did; a list's change ignores order.
Final re-review 2. Fixed (ad7cb1047): `rebaseRecipeForm` rebases field by field against the form as opened (lines and steps included): untouched fields take the fresh value, changed ones keep the reader's; the row editors re-seed on the new version.
Final re-review 5. Fixed (ae0ba156d): foreign archive parsers carry Tags and Categories only when the source has them, and never Cuisines (`carriedLists`); Norish archives carry all three.
Final re-review 6. Confirmed and fixed (ff22764b6): the update schema takes null for the times; the editor now sends a cleared time as null, and a queued merge keeps it.
Release check 1. Fixed (fc65bebad): Recipe Keeper and Mealie carry Tags and Categories only when the recipe has a label; Mela, Paprika and Tandoor already did.
Release check 2. Fixed (e279b3002, 3181ba1c8): an edit sends description, notes, URL, the three times, calories, fat, carbs, protein and the provenance place only when changed from the recipe as opened (null when cleared); name, servings and system stay always sent.
Release check 3. Fixed (db365b154): the stale rebase keeps or refreshes lines and steps together, as steps point at lines by position.
Release check 4. Fixed (56c7b5215): the overwrite already follows the documented order (recipe row, then folds), as the plain update shares its path; the takeover locked the fold before the recipes and now locks them first.
