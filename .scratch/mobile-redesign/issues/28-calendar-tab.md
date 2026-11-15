# 28: Calendar tab

**What to build:** The Calendar tab. See `.scratch/mobile-redesign/spec.md` Part 5 ("Calendar tab", "Drag") and the Calendar boards plus ticket 18's empty and offline.

**Blocked by:** 19, 27

**Status:** open

- [x] Moved first, in separate commits, web switched over with its unit tests: the drop rule of `use-calendar-dnd.ts`.
- [x] The timeline of day cards, two weeks either side, growing at the edges, opened on today with a way back, Today ringed; empty and offline states.
- [x] A tap opens the planned-item sheet (date, slot, go to recipe, add to groceries, remove); a day's add opens add-to-day; "Plan recipe" accessory with a day picker.
- [x] Hold and drag to another day: keeps its slot, lands last, no growth while dragging; through the Outbox.
- [x] Gates green, including mobile's lint, typecheck, test and `expo export --platform ios`.

## Comments

- 2026-11-15: moved first: the drop rule as `dayDropTarget` (beside `moveTargetIndex`) and the range's days on `useCalendarRangeQuery` (plus `isRead`), web switched. Server: a missing plan answers move/update `stale` and the app's delete a no-op (REST delete keeps its 404); a failed update now rejects and no longer publishes `failed` to the household; post-commit reads never fail a stored write. The client's version predictions already matched the server (a move bumps the moved plan only); `offline-plan-replay.test.ts` proves move-move, move-slot, move-remove, two into one slot, rename-move and plan-move against a fake following those rules.
- Decided: the timeline is one `DragList` of day tops, slot labels and item rows (fixed heights, `getItemLayout`, `initialScrollIndex` on today, `maintainVisibleContentPosition`, grows on start/end reached unless a row is held via the new `onHeldChange`); title row fixed above it with the Offline pill and a "Today" button pointing up or down while today is off screen. Add-to-day and Plan recipe are the existing `plan-recipe` sheet (a `date` param drops the day strip and titles it "Add to {day}"); the Calendar stack has its own `plan-recipe`, `add-to-groceries` and FIT `item` sheet; date/slot in the sheet move at once (last in the slot), Remove has no confirm (as web), a note shows Remove only. Fixed in `useHeldRows`: a refused drop left the row where it was dropped (the library had already moved it); it is now shown for one commit and moved back as a reorder.
- Deviations: no photo in the planned-item sheet's header (the shared `Sheet` has text only); no target-day ring or ghost while dragging (the library moves rows live, as ticket 25); an offline plan shows only after Replay (ticket 11's decision), so plan-then-move offline is proven by the Replay test, not on the device.
- Simulator (iPhone 18 Pro, iOS 27.2, own server :3400, throwaway Postgres and Valkey, light and dark): opened on today ringed; scrolled back into September and forward into March with growth at both edges and no jump; Today button both ways; planned-item sheet: slot, native date picker, Go to recipe, Groceries (opens the Calendar's Add to groceries), Remove; add-to-day with a recipe, a note and Random; Plan recipe from the accessory on a picked day; hold-drag to another day kept the slot and landed last, with auto-scroll at the top edge; drop on its own day put the row back with no write; a tap still opens the sheet. Server stopped: plan, move, move, slot change, remove, relaunch, server back: all stored (moved note v2→v5), sign-out asked about nothing unsent. A note added over the API while a row was held showed and the drop landed last by id. Not seen: the first-frame skeleton (Warm Set always held data), haptics, the lifted card mid-gesture, no-growth-while-held on screen (code only).
