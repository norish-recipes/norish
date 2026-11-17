# 47: Our own drag inside DragList

**What to build:** Drag where headings and stores never move, with web's feel, on Calendar, Groceries and Manage stores. See spec Part 7 ("Drag").

**Blocked by:** none

**Status:** ready

- [x] `react-native-reorderable-list` removed; `DragList`'s interface kept; FlatList still virtualised.
- [x] ~250 ms hold on the UI thread, haptic on lift; an opaque shadowed card follows the finger, the source a faded ghost.
- [x] Nothing reflows until the drop: a drop line and a highlighted target section; light haptic crossing sections, medium on drop.
- [x] Frame-driven auto-scroll.
- [x] A drop on a heading lands in that section (empty and collapsed too); above the first heading snaps back; no remount on drop.
- [ ] Unit tests for hit-testing and drop resolution; Maestro drag flows green; checked on the device.

## Comments

- 2026-11-17: hit-testing uses the lifted card's middle and finger *travel* (a sheet's `absoluteY` counts from the sheet, not the screen). Rows mark what a hold lifts with `DragHandle`, wrap their tap in `useDragTap` (a short carry stays inside the press's reach), and slices register their visible card with `useDragCard` so the line and outline hug the cards. Calendar outlines the day and draws no line (`dropLine={false}`), since the drop lands by the day rule. The nested editor lists and the aisle list moved to the same drag.
- Deviations: scroll is not disabled while carrying on a FlatList (toggling `scrollEnabled` drops an automatic content inset, jumping the Groceries list 116 pt); a capture-free `.map` callback in a worklet is hoisted by the React Compiler into a plain function and crashed the UI thread, so the frame loop uses a loop. Groceries/Calendar pass their tab-bar clearance as `edgeInsets.bottom` for the auto-scroll band. Commit `d15d50bdd` (library removed) landed before the drag commit, so that one commit alone does not build.
- Open: `calendar-drag` fails intermittently *before* its drag (on a fresh account the timeline grows 12 days into the past right after opening and MVCP does not keep today in place; dev-account opens hold 10/10). Not proven to be this ticket's; ticket 30 had it 3/3 before ticket 41 changed the opening. Not checked on device: collapsed-section drop, the editor's nested drag, haptics (simulator).
- Review round 1 (Standards + Spec), dispositions:
  1. fix (bug): a cancelled gesture (app to background, system gesture, sheet dismiss) commits the drop; `onDeactivate` ignores `event.canceled`. It snaps back.
  2. fix (bug): the drop uses the index the UI thread saw at lift; a realtime change before `held.lift()` shifts it and another row moves. The row is found by key.
  3. fix (verify): no cleanup when the source cell is virtualised out mid-drag (`lift` stays set, later lifts refused) or when a DragList unmounts mid-drag (the page stays locked).
  4. fix (verify): past the rendered rows `gapAt` and `landingTop` disagree, so the card flies home while the drop commits elsewhere.
  5. fix: `release` has no key check, so a second finger's row can end the first drag.
  6. fix (bug, verify): on a fresh account the Calendar loses today when 12 past days are prepended after opening (the cells' layout spring racing `maintainVisibleContentPosition` is the lead); reproduced with repeats, cause fixed, `calendar-drag` green on repeats.
  7. fix: a no-op Calendar drop (same day) fades the card at the finger; it slides back.
  8. fix (as web does): the Calendar has no drop line (`dropLine={false}`) and the card fades instead of settling. It follows web's calendar drag; if web draws no line there, the outline stays and the card settles where the item lands.
  9. fix: `drag-list.tsx` (681 lines) holds four jobs; the engine (frame callback and worklets) moves beside `drop-target.ts`.
  10. fix: duplication: `recordCell`/`recordCard`; the `DragHandle` + `Pressable` + `tap` wrapper in four rows; the lifted-row style per row type; the `{top, height, x, width}` box declared three times.
  11. fix (verify): options with one or no caller (`dropLine` after #8, `shownRef`, `nested`, `itemLayoutAnimation`, `edgeInsets` beside `contentInset`) go.
  12. fix: `use-held-rows.ts` `drop` doc is three lines; names used for two things in `DragList` (`frame`, `held`, `layer`, `box`).
  13. fix (verify): `use-held-rows.test.ts` lost the refused-drop ordering test and the `settle()` test; restored unless the behaviour itself is gone.
  14. fix (verify on device): `keyboardShouldPersistTaps="handled"` removed from the editor's ingredient and step lists.
  15. device check still owed: auto-scroll, a drop on a collapsed section, the recipe editor's drag.
  16. reject: auto-scroll moving the title fade and the tab-bar guess; a scrolling list is scrolling.
  17. reject: auto-scroll duplicating `use-tab-scroll.ts`; one reads the offset, the other drives it.
  18. reject: a component test for the gesture wiring; the spec's tests are the pure functions plus the Maestro flows.
- 2026-11-17, review round 1 fixed (`0545f44b2`..`aba96eb90`): Calendar's cause was the cells' layout spring. On a prepend it held the cells at their old frames while UIKit's `maintainVisibleContentPosition` measured, so the offset was never adjusted (fresh account failed run 3 of 8; with no spring 8/8, then 5/5). The Calendar now has no layout spring, as web, and `useFreshRows` lost `settled`.
- Web's calendar drag only rings the day (`ring-2`, none on the item's own day) and lands the item last in its slot, with no line. So the outline stays, there is still no line, and `landAt` (replacing `dropLine` and the fade) settles the card where `timelineLanding` puts the item. A same-day drop slides back with no write.
- Deleted (11): `dropLine`, and `edgeInsets` falling back to `contentInset`. Kept: `shownRef` (Calendar scrolls by index in the rows shown), `nested` (ingredient and step lists), `itemLayoutAnimation` (Groceries; Calendar no longer passes it). 13: `settle()` and the refused-drop intermediate order are gone. The list never reorders on its own now, and `drop` sets the rows straight back.
- Device (Release, iOS 27.2): Calendar, Groceries, Manage stores and the editor drag, both auto-scroll edges with the source off screen plus a second lift, collapsed/empty/above-first-heading drops, and the editor with the keyboard up all checked. Not checked: a drag cancelled by backgrounding, because agent-device runs one session's commands in turn, so `home` waits for the held gesture to end. The last box stays open for that.
- Review round 2 (the fix range), dispositions:
  1. fix: `targetAt` takes `sections` beside slots that already carry `.section`, and the engine rebuilds that array every frame.
  2. fix: the shared value `section` is shadowed by a destructured `section` in `slotsNow` (`use-drag-engine.ts:59,90`).
  3. fix (verify): `card-slice.tsx` `SIZES.sheet.liftedInset` equals its `inset`.
  4. fix: `DragList` and `DragScrollView` each define the same `onContentSizeChange` wrapper.
  5. fix: when both sides of `landAt`'s gap are undrawn the card slides home while the drop commits elsewhere; it fades instead, and `landingTop`'s comment says what holds.
  6. reject: lifted aisle rows now tilt; one lifted look for every row is what the deduplication was for. Listed for Mike to see.
  7. reject: a drop committing after the list unmounts during the settle; the user made the drop.
