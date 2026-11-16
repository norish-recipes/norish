# 33: Cook mode step pager

**What to build:** Steps that follow the finger. See `.scratch/mobile-redesign/spec.md` Part 6 ("Cook mode").

**Blocked by:** none

**Status:** open

- [x] The vertical step column follows a drag: the next peek rises into the centre and grows to full size and opacity while the current shrinks into the upper peek, and the reverse going back.
- [x] Release springs with the gesture's velocity and snaps to a step; a light haptic per step. Prev/next and peek taps run the same spring. Interruptible mid-flight.
- [x] Steps ↔ Ingredients crossfade-slide. Reduce Motion: a crossfade.
- [x] Gates green, including mobile's lint, typecheck, test and `expo export --platform ios`.

## Comments

- 2026-11-16: One `position` shared value (the step shown, fractional mid-page) poses a slot per step, keyed by step, ±2 mounted (`slotPose` in `utils/cook-pager.ts`, unit-tested). A slot fades its full step into its peek (text + chips) on the way out, so a commit moves nothing; a jump of several steps springs as one page (`springStart`).
- A release decides its step at once (haptic in the screen's `goTo`, once per change); a touch mid-flight lands on a step on finalize. The step's ScrollView runs simultaneously with the pan (`useNativeGesture`); the pan pages from a peek at once, from the text only at its scroll edge; `bounces={false}`.
- Reduce Motion: no pan, the column is keyed by step and crossfades (`ReduceMotion.Never`); vertical flings page under Reduce Motion and from Ingredients.
- Seen on an iOS 27.2 iPhone 17 Release build (own :3400 stack): drag follows the finger both ways, flicks carry, no jump at commit, first/last step hold, a long step scrolls then pages, buttons and both peeks page (peeks use gesture handler's Pressable; RN's missed the posed bottom peek), Steps ↔ Ingredients and Reduce Motion crossfade.
- Not seen working: a vertical fling over Ingredients; its ScrollView (unchanged since before the ticket) takes the swipe. A tap truly mid-flight wasn't reproducible with agent-device. Mid-page, a step's full and peek layers briefly overlap as a faint double.
