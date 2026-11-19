# 53: Sheets on the kit

**What to build:** Every remaining sheet laid out to its board, built only from the kit (50), header (51) and plan block (52). Boards in /private/tmp/claude-501/-Users-mike-Documents-norish/d38bec8b-911e-4dc6-bbb1-96fe9e0bbaac/scratchpad/boards: addRecipe, importLink, importText, importPhotos, filters, addToGroceries, addToCookbook, cookbookAdd, newCookbook, rename, servings, share, shareEmpty, timers, choice, item, addItems, editItem, storeStep, repeat, product, stores, storeEdit, pantryAdd, food.

**Blocked by:** 50, 51, 52

**Status:** ready

- [ ] Each listed sheet matches its board's structure (sections, row ends, which controls, order) in both themes; no sheet restyles a kit control locally (no ad-hoc fills, radii, glass).
- [ ] Add recipe: the clipboard row is a card row with a small solid-accent Import. Import from photos: photo strip + Camera/Photo library rows. Share: inset expiry switch, link rows with Copy/Share/Reactivate pill buttons and Active/Expired tags, a no-links state. Timers: solid body icon buttons, the dismiss is a solid circle with a red cross. Add to groceries: servings stepper right-aligned. Repeat: sand stepper for the interval.
- [ ] Translucent or glass content left in any sheet body is gone (grep `GlassSurface`, `bg-fill`, `glass` under `apps/mobile/src` and justify what stays: only header, tab bar, accessory, nav buttons, Today, heart on photos).
- [ ] Tests and Maestro flows follow moved controls; gates green.

## Comments

- Part A (Recipes-tab sheets): kit gained `CardRow` `icon`/`hint`/`disabled` (inset hairline), `PillButton` tone `accent` (the clipboard Import), `IconButton` `small` (photo remove), `SheetInput` `onClear` (board's clear circle), and `slice-row.tsx` (sand rows of a virtualised card, used by pick rows and the choice sheet). New copy `recipes.addRecipe.fromClipboard` in every locale; `importHost` left every locale.
- Filters follow the board's order (Category, Cooking time, Tags, Rating); Rating is chips Any/1+..4+/5 (the app has 1-5, the board shows 3+/4+/5); Sort, Favorites and Pantry-only stay as extra sections after Rating, since the app has them and the board doesn't.
- Not built: Add to groceries drops the "x of y selected" count (board has only label + Select all; web still reads the key); Import from text drops the label and info button, the limit shows as a note under the field; the board's `choice` is the editor's Cuisine sheet, the groceries Store/Aisle choice list is Part C. Share/Timers/Repeat boxes are for B and C, so no checkbox ticked here.
- Part B (recipe page sheets): Servings is the wide kit Stepper ("N servings") plus a Multiplier label over the scale chips (½× to 4×); the two typed fields are gone (board has none), so an arbitrary multiplier like 1.5× is only reachable by stepping. Maestro `recipe-scale` waits on `recipe-servings-sheet-value`.
- Share: Segmented expiry (keeps 1 year, the board shows four), link rows in one Card with Active/Expired/Revoked tags and PillButtons: Copy and new Share (native share sheet, only on the link made this visit, the only one with a URL), Revoke, Reactivate, Delete (danger). Empty state is centred "No share links yet."; existing copy kept ("Expires after", "Copy").
- Timers: rows sit in a Card, buttons are kit IconButtons with a danger dismiss. The ±step buttons the board omits stay (functional); the cook-mode pill shares the rows, so its buttons are solid too.
