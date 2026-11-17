# 47: Our own drag inside DragList

**What to build:** Drag where headings and stores never move, with web's feel, on Calendar, Groceries and Manage stores. See spec Part 7 ("Drag").

**Blocked by:** none

**Status:** ready

- [ ] `react-native-reorderable-list` removed; `DragList`'s interface kept; FlatList still virtualised.
- [ ] ~250 ms hold on the UI thread, haptic on lift; an opaque shadowed card follows the finger, the source a faded ghost.
- [ ] Nothing reflows until the drop: a drop line and a highlighted target section; light haptic crossing sections, medium on drop.
- [ ] Frame-driven auto-scroll.
- [ ] A drop on a heading lands in that section (empty and collapsed too); above the first heading snaps back; no remount on drop.
- [ ] Unit tests for hit-testing and drop resolution; Maestro drag flows green; checked on the device.
