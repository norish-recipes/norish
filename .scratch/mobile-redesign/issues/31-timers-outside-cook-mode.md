# 31: Recipe Timers outside cook mode

**What to build:** Timers reachable from every signed-in screen. See `.scratch/mobile-redesign/spec.md` Part 6 ("Rules", "Recipe Timers outside cook mode").

**Blocked by:** 34

**Status:** open

- [ ] While any Recipe Timer exists, the bottom accessory holds the tab's add action and a timer capsule (soonest countdown and ring); a tap on the capsule opens the timer list as a sheet. No timers: the add action alone.
- [ ] A long press on a timer chip opens Reset and Remove; a tap stays start, pause or resume.
- [ ] Motion: the capsule springs in and out of the accessory, its countdown digits roll, haptics on start and done.
- [ ] Maestro: start a timer on the Recipe page, stop it from the accessory on another tab.
- [ ] Gates green, including mobile's lint, typecheck, test and `expo export --platform ios`.
