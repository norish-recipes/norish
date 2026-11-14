# 19: Shared drag list

**What to build:** One drag list for Groceries, Manage stores and the Calendar tab. See `.scratch/mobile-redesign/spec.md` Part 4 ("Gestures", "The drag list").

**Blocked by:** 18

**Status:** open

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
