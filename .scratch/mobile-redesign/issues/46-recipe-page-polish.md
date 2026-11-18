# 46: Recipe page polish and timer rows

**What to build:** Matching control heights, rating and nutrition motion, a timer row that opens its step. See spec Part 7 ("Recipe page").

**Blocked by:** none

**Status:** ready

- [x] Servings stepper, Convert menu and nutrition portion control share the ingredient control's height.
- [x] Stars fill left to right to the tapped one with a spring scale each; nutrition bars animate their width on a portion change. Neither under Reduce Motion.
- [x] A tap on a timer row closes the timers sheet and opens `cookModeRoute(recipeId, stepIndex)` (first step without one); the row's buttons keep their actions.
- [x] Gates green; checked on the device.

## Comments

- Height: `GLASS_CONTROL_HEIGHT` (40) in `components/glass.tsx` is the one definition; the stepper (servings and nutrition portion) uses it and the Convert/options menu is now a `GlassIconMenu` whose glyph frame derives from it (it was a native 31 pt button). Measured 40 pt for all four, light and dark.
- Motion: stars fade in left to right (45 ms stagger) with the app spring pop (`usePopOnChange` gained a delay); bars `timedTo` 250 ms `Easing.out(cubic)` on the UI thread. Reduce Motion: no pop or stagger, bars snap, verified by hand.
- Timer row: `timerCookStep` (pure, tested); the row's content is its own Pressable beside the round buttons. The sheet must be gone before cook mode (a fullScreenModal) can present: pushing at once or at 400 ms left a dead screen from the recipe page, so it waits 800 ms (`SHEET_LEFT_MS`). A wait on the sheet's real dismissal would be better.
- Not shown on the device: timers on two different steps or a step-less timer (the dev recipe has timers on step 2 only); the unit test and the Maestro flow cover the step choice.
