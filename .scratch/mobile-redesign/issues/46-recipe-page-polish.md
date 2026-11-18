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
- Review round 1 (Standards + Spec), dispositions:
  1. fix (bug): a timer row closes the sheet, then pushes cook mode from a `setTimeout` of 800 ms (`timers-sheet-screen.tsx:35-38`): the recipe page sits dead for 0.8 s, the timeout is never cleared (it fires after the user has gone elsewhere), a double tap pops twice and pushes twice, and the dismissal time is a guess (400 ms failed). Cook mode opens when the sheet has really gone; no timer.
  2. fix: the rating's stagger counts from star 1, so 3 → 5 waits 135 ms with nothing moving; stars pop when they unfill; a rating arriving from the server (query load, realtime) runs the whole fill. The stagger starts at the first star that changes, an unfill only fades, and only a tap animates.
  3. fix: the timer row has no button role, label or press feedback (`timer-list.tsx:72`), so VoiceOver never says it opens cook mode.
  4. fix: `cook-bar.tsx:69` keeps its own `PILL_HEIGHT = 40` beside `GLASS_CONTROL_HEIGHT`; `timerCookStep` repeats the cook screen's own `?? 0`; `onOpen?` is optional though its only caller always passes it; `Math.min(percent, 100)` twice in `ReferenceBar`.
  5. fix (verify): the "button press does not open cook mode" test holds only through the mock's click bubbling; `nutrition-section.tsx:79`'s inline ease-out beside the same easing in `auth/utils/motion.ts`.
  6. fix: screenshots: `timer-row-tap-cook-mode-step-2.png` shows the recipe page, not cook mode; no dark shot of the timers sheet or cook mode.
  7. ask (Mike): the height. The page has no separate "ingredient control": the options menu (31 pt) was raised to the stepper's 40 pt, the height of every other glass button. Which height was meant.
  8. reject: the bars animating on any change of their value, not only a portion change; harmless, and one code path.
  9. reject: `SIZES.regular` deriving from the control height; one glass control height is the point.
  10. kept: the options menu in cook mode also going to 40 pt, with the page's.
