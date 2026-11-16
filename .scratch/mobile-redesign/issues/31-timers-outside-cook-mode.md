# 31: Recipe Timers outside cook mode

**What to build:** Timers reachable from every signed-in screen. See `.scratch/mobile-redesign/spec.md` Part 6 ("Rules", "Recipe Timers outside cook mode").

**Blocked by:** 34

**Status:** open

- [x] While any Recipe Timer exists, the bottom accessory holds the tab's add action and a timer capsule (soonest countdown and ring); a tap on the capsule opens the timer list as a sheet. No timers: the add action alone.
- [x] A long press on a timer chip opens Reset and Remove; a tap stays start, pause or resume.
- [x] Motion: the capsule springs in and out of the accessory, its countdown digits roll, haptics on start and done.
- [x] Maestro: start a timer on the Recipe page, stop it from the accessory on another tab.
- [x] Gates green, including mobile's lint, typecheck, test and `expo export --platform ios`.

## Comments

- Decided: the Pantry draws the capsule alone (no add action there) and no accessory without a timer. The capsule shows the cook bar's soonest timer, so both share `TimerGlance`; rolling digits (`components/rolling-text.tsx`, one spring in `lib/motion/spring.ts`, `toSlots` moved to `@norish/shared`) are ready for ticket 32. The sheet is the root `/timers` route over `TimerRows`, the rows the cook-mode popover also uses. The long-press menu is the native `ActionSheetIOS`.
- Shared timer pieces moved to `components/` and `lib/` because a feature never imports another.
- Maestro `timer-from-accessory.yaml` passed 3 times in a row on iPhone 18 Pro (iOS 27.2); the seed takes `steps` now.
- Simulator saw: add alone with no timer, capsule on Recipes, Groceries and Pantry, two timers show the soonest, sheet with native header (pause/resume and remove worked), last removal closes the sheet and capsule, long press Reset/Remove, Done capsule, dark, cook mode pill and popover.
- Not seen: Reduce Motion actually changing the animation (flag set with simctl after launch, no relaunch); ± and sheet Reset in the sheet; Live Activity and haptics; the springs' motion (stills only).
