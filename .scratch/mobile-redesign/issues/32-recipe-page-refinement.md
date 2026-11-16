# 32: Recipe page refinement

**What to build:** A native Recipe page with its media viewer and its motion. See `.scratch/mobile-redesign/spec.md` Part 6 ("Recipe page", "Web's motion, the floor") and the Recipe board.

**Blocked by:** 34

**Status:** open

- [x] Home and Cook as a native `Stack.Toolbar`, centred; `recipe-bottom-bar.tsx` deleted. Header items pinned while scrolling, no scroll-edge title bar.
- [x] Glass servings and portion steppers; the calorie card matches the canvas.
- [x] A hero tap opens a full-screen viewer of every image and video from the one tapped: pinch zoom, swipe down to dismiss, "n / m". The video fullscreen button works (it sits under the transparent nav bar today).
- [x] `expo-image` (via `expo install`) for every server image app-wide, memory and disk cache; a recipe's icons prefetched as the page opens.
- [x] No grey circle for a food without an icon: an empty slot only when another row in that list has an icon, otherwise none (unit test for the rule).
- [x] Motion: rolling digits for servings, amounts, nutrition and portions; step number → check scale-swap; ingredient check fade and strike; the double-tap heart pop; haptics on servings steps and check-offs.
- [x] Gates green, including mobile's lint, typecheck, test and `expo export --platform ios`.

## Comments

- Decided: the viewer is a component in an RN `Modal` (hero and step photos share it, fade-and-fly out on a swipe down or the close button); zoom and pan are gesture-handler + reanimated (no installed package ships a viewer). `expo-image` came through `expo install` (no release-age block); the Avatar uses its `asChild`; the widget photo download and local picker previews stay as they are (not server images). Icons prefetch through a new shared `useIngredientIconAnswer`.
- The calorie card is the canvas's Nutrition card (big kcal, bar against 2,000 kcal, Protein/Carbs/Fat columns with reference bars): new `DAILY_REFERENCE` in shared, two i18n keys in all 18 locales; the donut is deleted. Steppers are one `GlassStepper` (page, portions, editor, Add to groceries).
- Deviations: ingredient amounts roll in their own column, so a wrapped line hangs under the name; the check "strike" is the instant line-through with an animated fade; `RollingText.keyFrom` was dropped (no caller used "left"), `rising` is used by `AnimatedNumber`. Cook in the toolbar is text-only (an icon replaced its label). `useSheetOpen` is gone: the native toolbar sits under a sheet.
- Seen on an iOS 27.2 iPhone 18 Pro Release build (own :3400, light; dark for the page): toolbar, pinned header, viewer (open on tap, swipe, 4 items incl. video, pinch, double-tap, swipe-down), video fullscreen, Servings and Share sheets with nothing through, rolling digits mid-roll, Reduce Motion (plain swap), check fade, icons for some foods and none. A swipe-down crash (a non-worklet called from the drag) was found and fixed here.
- Not seen: the icon slot with all foods iconed, the second-visit image cache, the heart pop and scale-swap frames, haptics (a simulator cannot play them), a video poster. PNGs in the scratchpad `t32/`.
