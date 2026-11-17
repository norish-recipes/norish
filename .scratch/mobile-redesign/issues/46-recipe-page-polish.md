# 46: Recipe page polish and timer rows

**What to build:** Matching control heights, rating and nutrition motion, a timer row that opens its step. See spec Part 7 ("Recipe page").

**Blocked by:** none

**Status:** ready

- [ ] Servings stepper, Convert menu and nutrition portion control share the ingredient control's height.
- [ ] Stars fill left to right to the tapped one with a spring scale each; nutrition bars animate their width on a portion change. Neither under Reduce Motion.
- [ ] A tap on a timer row closes the timers sheet and opens `cookModeRoute(recipeId, stepIndex)` (first step without one); the row's buttons keep their actions.
- [ ] Gates green; checked on the device.
