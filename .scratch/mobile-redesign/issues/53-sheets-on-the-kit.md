# 53: Sheets on the kit

**What to build:** Every remaining sheet laid out to its board, built only from the kit (50), header (51) and plan block (52). Boards in /private/tmp/claude-501/-Users-mike-Documents-norish/d38bec8b-911e-4dc6-bbb1-96fe9e0bbaac/scratchpad/boards: addRecipe, importLink, importText, importPhotos, filters, addToGroceries, addToCookbook, cookbookAdd, newCookbook, rename, servings, share, shareEmpty, timers, choice, item, addItems, editItem, storeStep, repeat, product, stores, storeEdit, pantryAdd, food.

**Blocked by:** 50, 51, 52

**Status:** ready

- [ ] Each listed sheet matches its board's structure (sections, row ends, which controls, order) in both themes; no sheet restyles a kit control locally (no ad-hoc fills, radii, glass).
- [ ] Add recipe: the clipboard row is a card row with a small solid-accent Import. Import from photos: photo strip + Camera/Photo library rows. Share: inset expiry switch, link rows with Copy/Share/Reactivate pill buttons and Active/Expired tags, a no-links state. Timers: solid body icon buttons, the dismiss is a solid circle with a red cross. Add to groceries: servings stepper right-aligned. Repeat: sand stepper for the interval.
- [ ] Translucent or glass content left in any sheet body is gone (grep `GlassSurface`, `bg-fill`, `glass` under `apps/mobile/src` and justify what stays: only header, tab bar, accessory, nav buttons, Today, heart on photos).
- [ ] Tests and Maestro flows follow moved controls; gates green.

## Comments
