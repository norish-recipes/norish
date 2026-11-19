# 53: Sheets on the kit

**What to build:** Every remaining sheet laid out to its board, built only from the kit (50), header (51) and plan block (52). Boards in /private/tmp/claude-501/-Users-mike-Documents-norish/d38bec8b-911e-4dc6-bbb1-96fe9e0bbaac/scratchpad/boards: addRecipe, importLink, importText, importPhotos, filters, addToGroceries, addToCookbook, cookbookAdd, newCookbook, rename, servings, share, shareEmpty, timers, choice, item, addItems, editItem, storeStep, repeat, product, stores, storeEdit, pantryAdd, food.

**Blocked by:** 50, 51, 52

**Status:** done

- [x] Each listed sheet matches its board's structure (sections, row ends, which controls, order) in both themes; no sheet restyles a kit control locally (no ad-hoc fills, radii, glass).
- [x] Add recipe: the clipboard row is a card row with a small solid-accent Import. Import from photos: photo strip + Camera/Photo library rows. Share: inset expiry switch, link rows with Copy/Share/Reactivate pill buttons and Active/Expired tags, a no-links state. Timers: solid body icon buttons, the dismiss is a solid circle with a red cross. Add to groceries: servings stepper right-aligned. Repeat: sand stepper for the interval.
- [x] Translucent or glass content left in any sheet body is gone (grep `GlassSurface`, `bg-fill`, `glass` under `apps/mobile/src` and justify what stays: only header, tab bar, accessory, nav buttons, Today, heart on photos).
- [x] Tests and Maestro flows follow moved controls; gates green.

## Comments

- Part A (Recipes-tab sheets): kit gained `CardRow` `icon`/`hint`/`disabled` (inset hairline), `PillButton` tone `accent` (the clipboard Import), `IconButton` `small` (photo remove), `SheetInput` `onClear` (board's clear circle), and `slice-row.tsx` (sand rows of a virtualised card, used by pick rows and the choice sheet). New copy `recipes.addRecipe.fromClipboard` in every locale; `importHost` left every locale.
- Filters follow the board's order (Category, Cooking time, Tags, Rating); Rating is chips Any/1+..4+/5 (the app has 1-5, the board shows 3+/4+/5); Sort, Favorites and Pantry-only stay as extra sections after Rating, since the app has them and the board doesn't.
- Not built: Add to groceries drops the "x of y selected" count (board has only label + Select all; web still reads the key); Import from text drops the label and info button, the limit shows as a note under the field; the board's `choice` is the editor's Cuisine sheet, the groceries Store/Aisle choice list is Part C. Share/Timers/Repeat boxes are for B and C, so no checkbox ticked here.
- Part B (recipe page sheets): Servings is the wide kit Stepper ("N servings") plus a Multiplier label over the scale chips (½× to 4×); the two typed fields are gone (board has none), so an arbitrary multiplier like 1.5× is only reachable by stepping. Maestro `recipe-scale` waits on `recipe-servings-sheet-value`.
- Share: Segmented expiry (keeps 1 year, the board shows four), link rows in one Card with Active/Expired/Revoked tags and PillButtons: Copy and new Share (native share sheet, only on the link made this visit, the only one with a URL), Revoke, Reactivate, Delete (danger). Empty state is centred "No share links yet."; existing copy kept ("Expires after", "Copy").
- Timers: rows sit in a Card, buttons are kit IconButtons with a danger dismiss. The ±step buttons the board omits stay (functional); the cook-mode pill shares the rows, so its buttons are solid too.
- Part C (groceries sheets): Store/Aisle choices are card rows with a dot slot, `RepeatPills` and Repeat labels follow the board (interval reads "Every 2 weeks", the preview is one plain line); Product is a label/value card row (name and cost; the pack-size and strike-through detail line is dropped), its search has the clear circle and Unlink is a danger PillButton; Manage stores rows show "N items" and a chevron, the header + is the confirm with a plus glyph; Edit store's link has a link prefix; Pantry food's "On the list" tag is its own Groceries row.
- Not built or kept: Manage stores keeps the per-row Delete button (the board has none; ticket 54's swipe can take it) and drops the pencil (the row opens the editor, Maestro taps `store-row-*`); "0 items" instead of "No items"; Edit grocery keeps the "From recipe" note under the field (information, the board drops it); Edit store's aisle rows and add field, Pantry add's CardSlice rows (full-width hairline) are unchanged.
- Glass grep (`GlassSurface|bg-fill|glass` under `apps/mobile/src`): no `bg-fill` and no glass in any sheet body. What keeps glass: header/native sheet (`modal-header`, `sheet-options`, `glass.tsx`), nav buttons (`library-header`, `cook-mode` and `media-viewer` close), account avatar disc, Today, heart/buttons over photos (`recipe-hero`, editor `media-strip`/`step-photos` remove), cook bar and timer pill/capsule (accessory), server chip on sign-in. Page content still on glass, outside the sheets and for ticket 55: `cookbooks-section` and `ingredients-section` (`GlassIconButton`/`GlassIconMenu`).
- Review round 1 (Standards on Hydrogen, Spec on Opus), dispositions:
  1. fix: Import from text shows the limit as a permanent line under the field (`import-text-screen.tsx:60-65`); restore the info button + popover for the limit and the error only when too long; the `import-text-too-long` testID only on the error.
  2. fix: Servings lost typed input (`recipe-servings-screen.tsx:40-48`); the stepper's value is tappable to type servings (keyboard number entry), keeping the board's look; any value the old fields allowed is reachable again. Test it.
  3. fix: Edit grocery's "From recipe" note sits as a line under the field (`edit-grocery-screen.tsx:142-146`); it becomes a card row (label + recipe name as value), no line under a field.
  4. fix: glass left in the recipe page content (`cookbooks-section`, `ingredients-section`); kit controls (solid), no glass in the content layer.
  5. fix: hand-rolled kit pieces: Planned item's recipe row (`planned-item-screen.tsx:80-100`) -> Card/CardRow; Plan recipe's result rows restyle a HeroUI Button with `pickRowClass` (`plan-recipe-screen.tsx:141-148`) -> the slice row; `ChoiceRow` (`choice-list.tsx:26-40`) and the pending cookbook row (`add-to-cookbook-screen.tsx:88-110`) -> CardRow/PickRow with a trailing slot; Repeat confirmed pill (`form-parts.tsx:84`) -> the kit Tag with the repeat icon (board addItems).
  6. fix: `pickRowClass` (`pick-row.tsx:10`) only wraps `sliceRowClass`; callers use `sliceRowClass` and the wrapper goes.
  7. fix: hairline written four ways: `grocery-line-row.tsx:13-14`, `recipe-share-screen.tsx:66`, `card.tsx:51-55`, `timer-list.tsx:47` (full-width `border-separator`) -> `SliceHairline` (inset `bg-line`) everywhere.
  8. fix: section label `"text-muted px-1 text-[13px] font-semibold"` in `recipe-servings-screen.tsx:21`, `recipe-share-screen.tsx:29`, `filter-section.tsx:18`, `grocery-lines-section.tsx:41` (and any other copy) -> one kit SectionLabel.
  9. fix: Manage stores shows "0 items" where the board says "No items" (`store-list-row.tsx:53`). (verify) the count includes ticked groceries (`manage-stores-screen.tsx:183`); match what web counts for a store.
  10. fix (verify): Product row lost shelf price, pack size and the struck regular price (`product-row.tsx`) and the name is capped to one line at 62%; keep the board's "name · cost" line and bring back the lost price detail as a second line, name up to two lines.
  11. fix (verify): Plan recipe's first result row always gets a hairline (`plan-recipe-screen.tsx:148`, `first={false}`); no hairline above the first row of a card.
  12. fix (verify): Share expiry is five segments at 44 pt (~71 pt each, `recipe-share-screen.tsx:143`); check the longest locale labels fit (de, fi, nl, fr); if any is cut, show the expiry as a CardRow with a value + native menu instead.
  13. fix (verify): Pantry food's "Groceries" row reuses `navbar.nav.groceries` (`food-screen.tsx:66-70`); use a groceries-namespace key if one exists with the same text, else add one.
  14. fix: `repeat-view.tsx:23-32` reads 3-tuples by index (`?.[2]`); a keyed record.
  15. fix: `plan-recipe-screen.tsx:125` skeleton keeps `size-11` where the row's photo is `size-10`.
  16. reject: Repeat says "Every other week" where the board says "Every 2 weeks": existing shared copy, and the canvas's own recurrence preview reads "Every other week on Friday".
  17. reject: Servings label "Multiplier" vs the board's "Scale": existing copy shared with web.
  18. reject: Share's native Share button only on the link made this visit: only that link has its URL client-side (no feature to invent).
  19. reject: `bg-accent/10` / `/15` tints in page content (`source-section`, `empty-card`, `library-states`, `steps-section`): accent tints, not the content fill the spec makes solid.
  20. kept for ticket 55: cook mode's timer pill now uses the solid rows and red cross; checked on device there.

- Round 1 fixes: 1-10, 12-15 done (typed servings tap the stepper value, test in `typed-servings.test.tsx`; kit gained `IconMenu`, `SectionLabel`, `CardRow` `media`/`leading`/`detail`/`chevron`; `pickRowClass` and `GlassIconMenu` removed; `fromRecipe` and `paste.label` left every locale; `groceries.item.items` reads "No items" at zero and the store row counts open items).
- Not fixed: 11 does not hold, the first result row follows the Random/Note row in the same card, so its hairline is the divider (`header` card, `plan-recipe-screen.tsx`). Share expiry is now a menu row (item 12 held: "1 settimana", "Безстроково" overflow a 71 pt segment). Maestro flows need no change (testIDs kept).

- Re-review of the fix range (Opus), dispositions:
  1. fix (bug): 9012aca77 removed `common.import.paste.label` from every locale but web's `import-from-paste-modal.tsx:66` reads `t("label")`; restore it in every locale (revert that commit).
  2. fix (bug): the typed servings field goes stale (`typed-servings.tsx:37-52`): type 6, tap + -> servings 7, field still "6" (the sheet keeps taps with `keyboardShouldPersistTaps: "handled"`). The field shows the current servings after any outside change (stepper, chip) and leaves edit mode on those presses. Test first.
  3. fix: `grocery-lines-section.tsx:42` doubles the label padding (`HEADER` px-2 + `SectionLabel` px-2); the Servings and Share labels moved from px-1 to px-2. `SectionLabel` carries the board's label inset (`Panel.dc.html` label rule) and no caller adds its own.
  4. fix: `choice-list.tsx:26-38` lost `accessibilityState={{ selected }}` when it moved onto `CardRow` (`card.tsx:105` passes only disabled); `CardRow` takes `selected` and passes it through.
  5. fix: the delete-store alert now counts only open items (`manage-stores-screen.tsx:94`) while deleting a store affects every grocery in it (web's dialog counts all via `stores.getGroceryCount`); the alert counts all, the row keeps open items.
  6. reject: the decimal pad has no return key; tapping outside the field ends editing, as in the other sheets' numeric fields.

- Round 2 fixes: 1-5 done (paste label restored; typed servings leave edit on outside changes, tested; label inset once; choice rows report selected; delete-store alert counts all lines, tested). 6 rejected.
- Exit gate on `cab1ea64b`: all six gates exit 0 (fixer's run after the last change).
