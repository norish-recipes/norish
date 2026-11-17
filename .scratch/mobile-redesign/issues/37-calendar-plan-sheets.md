# 37: Calendar plan sheets

**What to build:** A drafted planned-item sheet and one move UI. See `.scratch/mobile-redesign/spec.md` Part 6 ("Calendar").

**Blocked by:** 34

**Status:** open

- [x] The planned-item sheet is a draft: date, slot and note commit on Save; Cancel or swipe down discards (unit test for the draft).
- [x] Remove asks to confirm, then the item animates out of the timeline.
- [x] One move UI, the plan sheet's 14-day strip plus its date picker, then the slot tabs, shared by Move from Today and the planned-item sheet; Calendar's Add uses the same strip. The day-cards list stays only for planning a recipe from the recipe.
- [x] Motion: day cards' items animate in, out and on move.
- [x] Maestro: edit a planned item's date and slot, Save, see it moved.
- [x] Gates green, including mobile's lint, typecheck, test and `expo export --platform ios`.

## Comments

- Save writes through one `saveItem` in `useCalendarMutations`: a changed note's text, then the move at the version the text leaves (the text's optimistic bump has not run yet in the same tick), so the server never answers stale. A blank note disables Save; Save always closes the sheet, so the old "close when the day leaves the range" rule is gone.
- One move UI is `MoveFields` (`DayStrip` plus `SlotTabs`) in components/, used by the planned-item sheet, the new Move sheet (`/move`, a fit sheet that replaces the plan sheet's move mode) and Plan a recipe. The per-day "+" keeps the strip-less form because it carries a date; the accessory's Add is the strip. The day-cards sheet is recipe-only now.
- The Remove confirm is shared (`useConfirmRemovePlanned`) and its title is plain "Remove": the old "Remove from today?" was wrong for a Calendar item. `useFreshRows` moved to hooks/ with an `epoch`, so the Calendar's growth at either edge neither fades rows in nor slides them; layout springs are off for the commit that grew the range.
- Removed the dead `useMovePlannedItem` and two unused i18n keys. Maestro `planned-item-edit` ran 5/5 (server state asserted via a new `/planned` control route); plan-from-today and plan-from-card pass.
- Seen on the iPhone 17, dark and light: draft, Close discards, Save moves all three, Remove confirm, Move from Today with the date picker past 14 days (Dec 27 stored), Calendar Add, new item and neighbours springing in the frames, tab bar minimising. Not seen: the removed row's own exit (hidden behind the dismissing sheet; Wed 18 emptied and the cards below slid up), swipe-down discard, widget push on a device (covered by the existing hook test), haptics (not felt on a simulator).
