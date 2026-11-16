# 32: Recipe page refinement

**What to build:** A native Recipe page with its media viewer and its motion. See `.scratch/mobile-redesign/spec.md` Part 6 ("Recipe page", "Web's motion, the floor") and the Recipe board.

**Blocked by:** 34

**Status:** open

- [ ] Home and Cook as a native `Stack.Toolbar`, centred; `recipe-bottom-bar.tsx` deleted. Header items pinned while scrolling, no scroll-edge title bar.
- [ ] Glass servings and portion steppers; the calorie card matches the canvas.
- [ ] A hero tap opens a full-screen viewer of every image and video from the one tapped: pinch zoom, swipe down to dismiss, "n / m". The video fullscreen button works (it sits under the transparent nav bar today).
- [ ] `expo-image` (via `expo install`) for every server image app-wide, memory and disk cache; a recipe's icons prefetched as the page opens.
- [ ] No grey circle for a food without an icon: an empty slot only when another row in that list has an icon, otherwise none (unit test for the rule).
- [ ] Motion: rolling digits for servings, amounts, nutrition and portions; step number → check scale-swap; ingredient check fade and strike; the double-tap heart pop; haptics on servings steps and check-offs.
- [ ] Gates green, including mobile's lint, typecheck, test and `expo export --platform ios`.
