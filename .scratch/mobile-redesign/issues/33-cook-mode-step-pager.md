# 33: Cook mode step pager

**What to build:** Steps that follow the finger. See `.scratch/mobile-redesign/spec.md` Part 6 ("Cook mode").

**Blocked by:** none

**Status:** done

- [x] The vertical step column follows a drag: the next peek rises into the centre and grows to full size and opacity while the current shrinks into the upper peek, and the reverse going back.
- [x] Release springs with the gesture's velocity and snaps to a step; a light haptic per step. Prev/next and peek taps run the same spring. Interruptible mid-flight.
- [x] Steps ↔ Ingredients crossfade-slide. Reduce Motion: a crossfade.
- [x] Gates green, including mobile's lint, typecheck, test and `expo export --platform ios`.

## Comments

- 2026-11-16: One `position` shared value (the step shown, fractional mid-page) poses a slot per step, keyed by step, ±2 mounted (`slotPose` in `utils/cook-pager.ts`, unit-tested). `hooks/use-step-pager.ts` owns the pan, the spring and the step-change effect; `cook-step-slot.tsx` poses a slot; `cook-step-body.tsx` lays out a step and a peek; `cook-steps.tsx` is the column. A jump of several steps springs as one page (`springStart`); the reach, its clamp, the peek hit test and `SPRING` live in `cook-pager.ts` too.
- A slot's full step is gone by `HANDOVER` (0.7 of a page) and its peek fades in after, so a slot never shows its text twice.
- A release decides its step at once (haptic in the screen's `goTo`, once per change). The pan claims a touch only once it drags (`onActivate` stops the spring), so a tap never touches the spring and a peek tap pages at any moment, mid-spring included (`__tests__/use-step-pager.test.ts`). The step's ScrollView runs simultaneously with the pan (`useNativeGesture`); the pan pages from a peek at once, from the text only at its scroll edge; `bounces={false}`.
- Reduce Motion: the same pan pages by the same rule but the column holds (`reduceMotion`): it is keyed by step and crossfades (`ReduceMotion.Never`), and a view switch fades only its own layer (`LayoutAnimationConfig`). The screen has only horizontal flings (Steps ↔ Ingredients); Ingredients has no vertical paging.
- Seen on an iOS 27.2 iPhone 18 Pro Release build (own :3400 stack), Reduce Motion on and off: drag both ways, flicks, first/last step hold, a long step scrolls then pages (from a peek at once), buttons, peek taps of any length and double peek taps 60-300 ms apart in both directions, Steps ↔ Ingredients by the toggle. The switch springs on `SPRING` (crossfade under Reduce Motion).
- The bar is 48 pt and sits on the 34 pt home-indicator inset (`BAR_BOTTOM`): the glass Host stops at the safe area, so a 56 pt bar at 26 pt drew 48 pt of glass with its content 4 pt low.
- Opened by a deep link, cook mode isn't a modal over the recipe route, so the Recipes stack's full-screen back swipe popped the whole route before the screen's fling. `CookModeScreen` turns the host route's `gestureEnabled` off while open (`__tests__/cook-mode-screen.test.tsx`); a right swipe on Ingredients returns to Steps, close is the × or Done.

### Review log (2026-11-16)

Range `1288c1807..893bc7b50`. Standards on Sonnet low, Spec on Opus medium; implemented on Sonnet medium, fix rounds on Opus medium (escalated after the first Spec review), each fix round checked on an iOS 27.2 simulator; re-reviewed on the final state.

Fixed, first review (16): the incoming step jumping at commit and the outgoing step overlapping it (pager rewritten on one `position`); the haptic firing after the spring; chips missing from the peeks; Reduce Motion snapping instead of crossfading; multi-step jumps stalling; the pan fighting the step's scroll; the three duplicated animated styles, the two fling blocks and `fling`'s boolean; bound names and the velocity constant; one shared reanimated mock for every test; `cook-steps.tsx` split into hook, slot, body and column (first rejected because the reviewer said to leave it; the maintainer overruled); doubled text mid-page.

Fixed, from the simulator (4): a peek tap right after a page change (the pan claimed every touch); Reduce Motion fling over a long step (one pan for both modes); cook mode opened by a link being popped by the Recipes stack's back swipe; the bar's content 4 pt low in its glass (maintainer's device note).

Fixed, re-review (10): the Steps ↔ Ingredients switch sprung; comments over two lines; the chips, clamp and view-switch duplications; a double fade under Reduce Motion; peek and bar geometry with one owner; `still` → `reduceMotion`; slot props.

Removed after checking: the vertical fling on Ingredients, which never fired on a device (its list takes the swipe). Closed after checking: reanimated's `clamp` cannot load in the plain unit test, so `cook-pager.ts` keeps its own.

Decided (Mike, 2026-11-16): the bar stays 48 pt on the home-indicator inset; the CookMode board was changed to 48 pt (canvas v83).

Final state `893bc7b50`: all 11 gates exit 0, mobile lint has no warnings.
