# 35: Recipes tab refinement

**What to build:** The Recipes tab's accessory, toggles, tags, swipe rows and motion. See `.scratch/mobile-redesign/spec.md` Part 6 ("Rules", "Recipes tab").

**Blocked by:** none

**Status:** open

- [x] The accessory reads Add cookbook while the library shows Cookbooks and opens the new-cookbook sheet; the library's own plus button goes.
- [x] The avatar sits in a glass container.
- [x] The Recipes/Cookbooks and grid/list toggles animate their selection with a haptic; the heading word rolls; the content swaps without a morph.
- [x] Grid cards: every tag, allergens first, in a sideways-scrolling row (web's `recipe-tags.tsx`).
- [x] Opening a swipe row never scrolls the list (`revealRow` in `card-list.tsx` goes); an open row closes on scroll or a tap anywhere else.
- [x] Motion: press feedback on cards, pills and chips; the selection bar slides up; rows animate in, out and on reorder; haptic at the swipe threshold.
- [ ] Gates green, including mobile's lint, typecheck, test and `expo export --platform ios`.

## Comments

- The shell learns the library's lens from `lib/library-lens.ts`, a mark like `shown-recipe` on a shared `lib/mark.ts` (`set`, `update`, `use`); Add cookbook shows only at the Recipes root path (`accessory-plan.ts`), so Settings and a cookbook's own page keep their actions. A recipe update no longer touches the Cookbooks lens's `library.list` queries, nor a cookbook update the Recipes lens's (`libraryQueryHolds`, unit-tested against the real query input; the lens-to-kind rule is `lensHoldsKind` beside `LIBRARY_TYPE_FILTERS`).
- The grid/list toggle has a thumb that springs to the picked segment (it leaves on the press; a fade under Reduce Motion). The lens chips fade their picked look in (`SelectFade`, content built once with an animated colour). The heading is `RollingText` with `growth="end"`, one space between the words.
- The list is one single-column list in both views. List rows are cells keyed by recipe; a grid cell holds 8 cards that wrap two to a line (`utils/card-chunks.ts`), so a card leaving or arriving animates the others in its cell and a card crossing into the next cell is drawn anew. A card that crosses a cell boundary on an insert or delete at the top therefore remounts: the list component offers no per-item layout animation with columns. The grid mounts two cells first and one per batch (about the 20 cards pairs mounted). Overlapping one cell onto the line above hid the right-hand cards from the accessibility tree, so that layout was dropped.
- Cards fade in and out; Reduce Motion fades. The Recipes tab has no selection bar (no multi-select, Part 2). The press scale (`usePressScale`, `PressTap` for cards) waits 90 ms, so a scroll or swipe that starts on a card does not dip it; a tap that lifts sooner dips and returns. `lib/open-row.ts` owns the open swipe row: it closes on scroll, on a touch elsewhere, on the accessory's press and when the Library loses focus (tab switch, a sheet over it).
- A grid card's tag strip scrolls with its own pan (`tag-strip.tsx`) when it can go the way the finger moves; otherwise the card's swipe, which waits on it, takes the drag, and a vertical drag scrolls the list. A strip's last chip is clipped by the card's edge, as web's is.
- `delete-recipe.yaml` scrolls before swiping: a swiped row no longer scrolls itself clear of the accessory. `dedupeTagsByName` moved to shared for web and mobile. A sheet's native confirm calls the latest handler.
- Simulator (iPhone 17, light and Reduce Motion): both toggles, the heading rolling and plain, grid and list swipe, strip scroll then swipe at its end, an open row closing on a tab switch, a list and a grid delete closing up, cookbook covers with photos. Haptics unfelt (simulator). The earlier "Your  cookbooks" gap and grey covers did not appear on this build. Maestro: recipes-browse-filter, plan-from-card, delete-recipe and add-to-groceries pass once each. cookbook-create-add failed about 1 run in 5 before the last changes (the tap on the sheet's recipe row did not tick it, so the cookbook was made empty; cause not isolated, not the sheet resizing: frames show it still); with the flow hiding the keyboard before the tap it passed 14 of 15 runs, the one failure a Maestro driver startup timeout after a reinstall. The app is not changed for that flake. The flow now asserts the row is ticked right after the tap (iOS gives the state as the row's text `checkbox, checked`).
