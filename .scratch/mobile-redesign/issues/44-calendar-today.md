# 44: Calendar's Today follows the accessory

**What to build:** Today at the bottom right, moving exactly with the accessory. See spec Part 7 ("Calendar").

**Blocked by:** none

**Status:** ready

- [ ] Today is glass at the bottom right above the accessory.
- [ ] A small native module reports the accessory's real placement (inline or expanded); `nextTabBarMinimised`'s scroll guess goes where the real state replaces it (check the library footer and the tab lists' end padding from ticket 38 too).
- [ ] The control moves with a layout transition, never a jump.
- [ ] Gates green; checked on the device scrolling up and down.
