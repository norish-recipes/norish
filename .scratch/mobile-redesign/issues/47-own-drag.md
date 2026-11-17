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
