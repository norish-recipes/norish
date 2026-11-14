# 22: Live Activity for Recipe Timers

**What to build:** One Live Activity showing every Recipe Timer on the device, on `expo-widgets`. See `.scratch/mobile-redesign/spec.md` Part 3 ("Live Activity") and ticket 18's Live Activity boards.

**Blocked by:** 21

**Status:** open

- [ ] First: `expo-widgets` (`expo install`) beside the Share Extension's `@bacons/apple-targets` target, App Group `group.dev.norish.app`; prebuild and a simulator run prove both extensions build and run. If not, stop and fall back to SwiftUI through apple-targets, noted in the comments.
- [ ] Starts with the first timer, ends when none is left; the last one finishing ends it showing Done.
- [ ] Lock Screen up to three timers soonest first then "+N"; Dynamic Island compact, minimal, expanded; self-ticking countdowns; "Paused" without one.
- [ ] Updated only on start, pause, reset, adjust and finish; the pushed state comes from a pure function with unit tests.
- [ ] A tap opens cook mode on the soonest timer's step.
- [ ] Checked by hand on a device, locked and with the app closed.
- [ ] Gates green, including mobile's lint, typecheck, test and `expo export --platform ios`.

## Comments
