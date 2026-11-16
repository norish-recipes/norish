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
- A release decides its step at once (haptic in the screen's `goTo`, once per change). The pan claims a touch only once it drags (`onActivate` stops the spring), so a tap never touches the spring and a peek tap pages at any moment, mid-spring included (`__tests__/use-step-pager.test.ts`). The step's ScrollView runs simultaneously with the pan (`useNativeGesture`); the pan pages from a peek at once, from the text only at its scroll edge; `bounces={false}`.
- Reduce Motion: the same pan pages by the same rule but the column holds (`still`): it is keyed by step and crossfades (`ReduceMotion.Never`). The screen has only horizontal flings (Steps ↔ Ingredients); Ingredients has no vertical paging.
- Seen on an iOS 27.2 iPhone 18 Pro Release build (own :3400 stack), Reduce Motion on and off: drag both ways, flicks, first/last step hold, a long step scrolls then pages (from a peek at once), buttons, peek taps of any length and double peek taps 60-300 ms apart in both directions, Steps ↔ Ingredients by the toggle.
- Open, not from this fix (also with the a1f353bd4 screen): a rightward swipe on Ingredients pops cook mode instead of returning to Steps.
