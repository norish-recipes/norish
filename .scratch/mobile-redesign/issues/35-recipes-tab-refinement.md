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

- The shell learns the library's lens from `lib/library-lens.ts`, a mark like `shown-recipe` on a shared `lib/mark.ts` (which `shown-recipe` now uses too); Add cookbook shows only at the Recipes root path, so Settings and a cookbook's own page keep their actions.
- Toggles fade the picked look over the resting one (`SelectFade`, springs, haptic on change) rather than a sliding thumb; the heading is `RollingText` in a new `word` mode. Grid pairs are single-column lines, so the list stays mounted across views and the header's toggles animate.
- Rows animate in/out (fade) and reorder (`itemLayoutAnimation`); a grid delete fades the tail rather than sliding it. The Recipes tab has no selection bar (no multi-select, Part 2), so there was none to slide up. Press feedback is `usePressScale`; a close-on-touch rule lives in `utils/open-row.ts`.
- `delete-recipe.yaml` now scrolls before swiping: a swiped row no longer scrolls itself clear of the accessory. `dedupeTagsByName` moved to shared for web and mobile.
- Simulator (iPhone 17, light and dark): Add cookbook beside a timer, the sheet, glass avatar, rolling heading frames, tags scrolling, swipe open/close, all seen. Haptics unfelt (simulator). Reduce Motion not exercised on device. Maestro: five flows pass; cookbook-create-add failed 1 in about 5 runs (the new-cookbook sheet showed Soup unticked after the tap; the sheet is untouched here, not compared against the old build). Also seen: a recipe created while the Cookbooks lens is open appears among cookbooks until relaunch (cache insertion, not this change).
