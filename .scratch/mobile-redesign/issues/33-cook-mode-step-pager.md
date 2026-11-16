# 33: Cook mode step pager

**What to build:** Steps that follow the finger. See `.scratch/mobile-redesign/spec.md` Part 6 ("Cook mode").

**Blocked by:** none

**Status:** open

- [x] The vertical step column follows a drag: the next peek rises into the centre and grows to full size and opacity while the current shrinks into the upper peek, and the reverse going back.
- [x] Release springs with the gesture's velocity and snaps to a step; a light haptic per step. Prev/next and peek taps run the same spring. Interruptible mid-flight.
- [x] Steps ↔ Ingredients crossfade-slide. Reduce Motion: a crossfade.
- [x] Gates green, including mobile's lint, typecheck, test and `expo export --platform ios`.

## Comments

- 2026-11-16: One `position` shared value (the step shown, fractional mid-page) poses a slot per step, keyed by step, ±2 mounted (`slotPose` in `utils/cook-pager.ts`, unit-tested). `hooks/use-step-pager.ts` owns the pan, the spring and the step-change effect; `cook-step-slot.tsx` poses a slot; `cook-step-body.tsx` lays out a step and a peek; `cook-steps.tsx` is the column. A jump of several steps springs as one page (`springStart`).
- A slot's full step is gone by `HANDOVER` (0.7 of a page) and its peek fades in after, so a slot never shows its text twice.
- A release decides its step at once (haptic in the screen's `goTo`, once per change); a touch mid-flight lands on a step on finalize. The step's ScrollView runs simultaneously with the pan (`useNativeGesture`); the pan pages from a peek at once, from the text only at its scroll edge; `bounces={false}`.
- Reduce Motion: no pan, the column is keyed by step and crossfades (`ReduceMotion.Never`); vertical flings page Steps. Ingredients has no vertical fling: its ScrollView took every swipe on the simulator, even a three-line list. Steps is reached by the horizontal swipe and the toggle.
- Seen on an iOS 27.2 iPhone 17 Release build (own :3400 stack): drag follows the finger both ways with no doubled text mid-page, flicks carry, first/last step hold, a long step scrolls then pages, buttons and both peeks page, Steps ↔ Ingredients and Reduce Motion work.
- Open: a peek tap right after another page (peek tap or drag) sometimes doesn't page; a tap after a pause does. Under Reduce Motion a fling over a long step does not page; its ScrollView takes it.
