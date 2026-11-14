# 19: Shared drag list

**What to build:** One drag list for Groceries, Manage stores and the Calendar tab. See `.scratch/mobile-redesign/spec.md` Part 4 ("Gestures", "The drag list").

**Blocked by:** 18

**Status:** done

- [x] Checked first: `react-native-reorderable-list` on RN 0.88 / Reanimated 4.7 with headings as non-draggable rows; else built on Gesture Handler and Reanimated. The choice and its reason go in this ticket's comments.
- [x] A flat list with heading rows; hold lifts a row, a drop reports the row and the heading above where it landed.
- [x] Haptic on lift and drop, auto-scroll near the edges, Reduce Motion fallback; a tap still reaches the row.
- [x] Proven on the simulator in a throwaway screen that is removed again; no feature uses it yet.
- [x] Gates green, including mobile's lint, typecheck, test and `expo export --platform ios`.

## Comments

- 2026-11-14: chose `react-native-reorderable-list` 0.18.3 (peers: Reanimated >=3.12, Gesture Handler >=2.12; ran on RN 0.88 / Reanimated 4.7 / GH 3.3), so nothing was hand-built. Headings are plain rows that never call the drag hook; the library splices the dragged row, so `resolveDrop` reads the heading above the landing index (null above the first heading).
- `DragList` (`src/components/drag-list/`) is controlled: `rows`, `renderHeading`, `renderItem(item, drag)` (the row puts `drag` on `onLongPress`, `onPress` stays free) and `onDrop({ item, heading, rows })`; Medium haptic on lift and drop; Reduce Motion drops the lift transform and animation duration.
- Simulator (iPhone 18 Pro, Debug build, throwaway route, removed): tap reached `onPress`; hold-drag lifted and a drop under "Aisle B" reported that heading; dragging to the bottom edge auto-scrolled past a section into Store C; with Reduce Motion on the drop still reported correctly. Haptics and the lift look were not observable in the simulator.
- Reduce Motion first drag: the inline `cellAnimations` object changed identity every render, so the library rebuilt `startDrag` and the cell handlers; it is now a module constant. Ten relaunch + first-drag runs with Reduce Motion on all landed (probe screen removed); the old miss was not reproduced on the old code, so that cause is inferred from the library source. Android untested.

### Review log (2026-11-14)

Range `a19935fbb..HEAD`. Standards on Sonnet low, Spec on Opus medium; fixes `5db77b2a5..ea029f792` plus the prop-order lint fix after the exit gate.

Fixed (5): one haptic handler named for both lift and drop; the test's helper names; `Drop.index` removed (the ticket asks for the row and the heading, `rows` has the order); `resolveDrop` without a non-null assertion and with `findLast`; the Reduce Motion cell style as a module constant, since the library rebuilds every row's drag handler when that object changes. Ten relaunch-and-first-drag runs with Reduce Motion on then landed; the earlier miss was not reproduced on the old code, so its cause is inferred.

Kept after checking: Reduce Motion is read once at launch (Reanimated's `useReducedMotion`), as on every other screen in the app.

Rejected (3): `Status: open` with every box ticked (the gatekeeper sets it); the list-prop passthrough as speculative (Groceries, Manage stores and Calendar need list props such as padding and headers); the type re-export from `drag-list.tsx` (one import path for consumers).

For the consumers: `Drop.heading` is the nearest heading only, so a grocery drop under an Aisle finds its Store by scanning `drop.rows` (ticket 25); a drop above the first heading reports `null` (Calendar rejects it, ticket 28); a hold that starts on a row's own checkbox does not lift the row; `from`/`to` are positions in `rows` as the drag started, so a realtime change mid-drag needs care.

Final state: all 11 gates exit 0, mobile lint without warnings.
