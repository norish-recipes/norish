# 33: Cook mode step pager

**What to build:** Steps that follow the finger. See `.scratch/mobile-redesign/spec.md` Part 6 ("Cook mode").

**Blocked by:** none

**Status:** open

- [x] The vertical step column follows a drag: the next peek rises into the centre and grows to full size and opacity while the current shrinks into the upper peek, and the reverse going back.
- [x] Release springs with the gesture's velocity and snaps to a step; a light haptic per step. Prev/next and peek taps run the same spring. Interruptible mid-flight.
- [x] Steps ↔ Ingredients crossfade-slide. Reduce Motion: a crossfade.
- [x] Gates green, including mobile's lint, typecheck, test and `expo export --platform ios`.

## Comments

- 2026-11-16: One `drag` shared value (in steps) drives three fixed-height slots (`utils/cook-pager.ts`, unit-tested); any step change, a release's own included, restarts from the old pose and springs to rest, so buttons, peek taps and notification taps share the spring and a new touch cancels it. Light haptic fires on each step change.
- Decided: peeks are fixed 96 pt slots with text only (no chips), the current step fills the middle and centres its content; under Reduce Motion the pan is off, a vertical fling pages and the Steps/Ingredients swap crossfades (otherwise it fade-slides).
- Not seen: no simulator run. Hand-check on a device: drag follows the finger and a flick snaps with its velocity; a drag started on the step text isn't stolen by its ScrollView (long steps scroll, drag from a peek then); first/last step; haptic per step; Reduce Motion on.
