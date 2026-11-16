# 32: Recipe page refinement

**What to build:** A native Recipe page with its media viewer and its motion. See `.scratch/mobile-redesign/spec.md` Part 6 ("Recipe page", "Web's motion, the floor") and the Recipe board.

**Blocked by:** 34

**Status:** open

- [ ] The recipe page keeps the tab bar; its bottom accessory reads Cook and opens cook mode, with the timer capsule beside it while a Recipe Timer exists (Mike, 2026-11-16: replaces the Home and Cook `Stack.Toolbar`, which goes with `recipe-bottom-bar.tsx`; no Home button). Cook mode and the editor still hide the tab bar. Header items pinned while scrolling, no scroll-edge title bar.
- [x] Glass servings and portion steppers; the calorie card matches the canvas.
- [x] A hero tap opens a full-screen viewer of every image and video from the one tapped: pinch zoom, swipe down to dismiss, "n / m". The video fullscreen button works (it sits under the transparent nav bar today).
- [x] `expo-image` (via `expo install`) for every server image app-wide, memory and disk cache; a recipe's icons prefetched as the page opens.
- [x] No grey circle for a food without an icon: an empty slot only when another row in that list has an icon, otherwise none (unit test for the rule).
- [x] Motion: rolling digits for servings, amounts, nutrition and portions; step number → check scale-swap; ingredient check fade and strike; the double-tap heart pop; haptics on servings steps and check-offs.
- [x] Gates green, including mobile's lint, typecheck, test and `expo export --platform ios`.

## Comments

- Decided: the viewer is a component in an RN `Modal` (hero and step photos share it, fade-and-fly out on a swipe down or the close button); zoom and pan are gesture-handler + reanimated (no installed package ships a viewer), the pan offset clamped by `clampOffset` also while pinching. `expo-image` came through `expo install` (no release-age block); the Avatar uses its `asChild`; the widget photo download and local picker previews stay as they are (not server images). The page reads its icons once with `useIngredientIcons`; `PrefetchIngredientIcons` pulls each answered picture into the image cache. Every spring-or-fade move goes through `lib/motion/settle-to.ts`.
- The calorie card is the canvas's Nutrition card (big kcal, bar against 2,000 kcal, Protein/Carbs/Fat columns with reference bars): `DAILY_REFERENCE` lives in the recipe feature, two i18n keys in all 18 locales; the donut is deleted. Steppers are one `GlassStepper` (page, portions, editor, Add to groceries); a step that cannot move is disabled and gives no haptic.
- Deviations: ingredient amounts roll in their own column, so a wrapped line hangs under the name, as the Recipe board draws it (fixed 54 px amount column); the check "strike" is the instant line-through with an animated fade, as web's row is; `RollingText.keyFrom` was dropped (no caller used "left"), `rising` is used by `AnimatedNumber`. Cook in the toolbar is text-only (an icon replaced its label). `useSheetOpen` is gone: the native toolbar sits under a sheet. The viewer is a `fullScreenModal` route (`recipe/[id]/viewer`) with `statusBarStyle: "light"`, so no app-wide `UIViewControllerBasedStatusBarAppearance` flag; a transparent modal cannot set the status bar (react-native-screens), so the page no longer shows through while dragging down.
- Seen on an iOS 27.2 iPhone 18 Pro Release build (own :3400): viewer (open, light status text, restored on close), step-badge number → check swap, a list with some foods iconed (empty slot for the rest) and one with all iconed, a list with none (no slot), icons and the hero photo from cache with the server stopped, Servings and Share sheets and the viewer in dark, Reduce Motion (earlier round), swipe-down. A tap in the step-photo viewer did not tick the step behind it. `timer-from-accessory.yaml` passed three runs in a row. Frames/PNGs in the scratchpad `t32/round2/`.
- Not seen: the heart pop (synthetic taps never read as a double tap: the viewer opened or nothing), a viewer pinch-then-shrink on the device, haptics (a simulator cannot play them), a video poster.
