# 31: Recipe Timers outside cook mode

**What to build:** Timers reachable from every signed-in screen. See `.scratch/mobile-redesign/spec.md` Part 6 ("Rules", "Recipe Timers outside cook mode").

**Blocked by:** 34

**Status:** done

- [x] While any Recipe Timer exists, the bottom accessory holds the tab's add action and a timer capsule (soonest countdown and ring); a tap on the capsule opens the timer list as a sheet. No timers: the add action alone.
- [x] A long press on a timer chip opens Reset and Remove; a tap stays start, pause or resume.
- [x] Motion: the capsule springs in and out of the accessory, its countdown digits roll, haptics on start and done.
- [x] Maestro: start a timer on the Recipe page, stop it from the accessory on another tab.
- [x] Gates green, including mobile's lint, typecheck, test and `expo export --platform ios`.

## Comments

- Decided: the Pantry draws the capsule alone (no add action there) and no accessory without a timer. The capsule and the cook bar's pill share `TimerGlance`, which owns the ring, the countdown and the done dot. One order says which timer a glance shows (done, else soonest running, else soonest paused, drawn muted with a play icon): `sortTimers` and `timerGlance` in `@norish/shared-react/recipes/timers`, also used by web's dock and the Live Activity plan. Rolling digits (`components/rolling-text.tsx`, one spring in `lib/motion/spring.ts`, `toSlots` in `@norish/shared`) hold the countdown's width with figure-space slots. The sheet is the root `/timers` route over `AllTimers` (the rows cook mode's popover also uses), a fit sheet that scrolls past 62% of the window. The long-press menu is the native `ActionSheetIOS`. The capsule's VoiceOver label gives the state and the time as a spoken duration (`recipes.cookMode.timersLeft`, `spokenTime`, every locale). Haptics go through `lib/haptics.ts`.
- Shared timer pieces moved to `components/` and `lib/` because a feature never imports another.
- Maestro `timer-from-accessory.yaml` passed 3 times in a row on iPhone 18 Pro (iOS 27.2) after the review fixes.
- Simulator saw: add alone with no timer, capsule on Recipes, Groceries and Pantry, two timers show the soonest, the sheet fitting one row and six rows, ± in the sheet, pause/resume and remove, last removal closes the sheet and capsule, a timer finishing on Groceries (Done capsule), long press Reset/Remove, cook mode pill and popover, dark, the inline accessory beside the collapsed tab bar (the add label drops to its icon beside a countdown), the capsule's VoiceOver label, a digit caught mid-roll.
- Not seen: the capsule's spring in and out (frames missed it), a visible difference under Reduce Motion (set, relaunched, capsule drew a plain countdown), the Live Activity (the simulator shows none; the plan's order is unit-tested), a sheet with more rows than fit, haptics (a simulator cannot play them).

### Review log (2026-11-16)

Range `278f49d43..6b57980f5`. Standards on Sonnet low, Spec on Opus medium; implemented and fixed on Sonnet medium; two fix rounds, the first checked on an iOS 27.2 simulator; reviewed twice. `timer-from-accessory.yaml` passed three times in a row, twice over.

Fixed, first review (15): the capsule showing a paused timer as soonest (one glance order in shared-react for the capsule, cook mode's pill, the Live Activity and web's dock, test first); the timer sheet going back twice when its list empties (test first); the capsule's VoiceOver label carrying the time; a fixed slot count for the countdown; a haptic on Resume and Restart through one haptics helper used app-wide; the inline accessory (tab bar minimised) dropping the add label; the timers sheet as a fit sheet; the done dot and ring-or-check in `TimerGlance`; one add-action table; the spring's builder type; comments.

Fixed, second review (7): VoiceOver saying a timer is done beside running ones (test first); spoken duration and slot width in shared-react; one start-or-pause toggle; one timers name and one tabular style; a named `AccessoryPlan`; names; comments. A lint warning the round introduced (`6b57980f5`).

Changed outside mobile: web's timer dock now lists running timers before paused ones (it sorted both by time left); the Live Activity's order is unchanged.

Deferred to ticket 32: `RollingText`'s `keyFrom` and `rising` props have one caller today; ticket 32 uses the component for servings, amounts and nutrition, and drops them if it does not need them.

For the maintainer to judge: the recipe page hides the tab bar, so it shows no capsule (another recipe's timers are reached from a tab or cook mode); the Pantry shows the capsule alone until ticket 36 gives it an add action.

Not seen on the simulator: the capsule's spring (frames missed it), a visible Reduce Motion difference, the Live Activity (its order is unit-tested), haptics (a simulator cannot play them). `ce5b26325` does not build on its own (its new file is in `e454aeefc`).

Final state `6b57980f5`: all 11 gates exit 0, mobile lint has no warnings.
