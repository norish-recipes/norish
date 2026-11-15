# 22: Live Activity for Recipe Timers

**What to build:** One Live Activity showing every Recipe Timer on the device, on `expo-widgets`. See `.scratch/mobile-redesign/spec.md` Part 3 ("Live Activity") and ticket 18's Live Activity boards.

**Blocked by:** 21

**Status:** open

- [x] First: `expo-widgets` (`expo install`) beside the Share Extension's `@bacons/apple-targets` target, App Group `group.dev.norish.app`; prebuild and a simulator run prove both extensions build and run. If not, stop and fall back to SwiftUI through apple-targets, noted in the comments.
- [x] Starts with the first timer, ends when none is left; the last one finishing ends it showing Done.
- [x] Lock Screen up to three timers soonest first then "+N"; Dynamic Island compact, minimal, expanded; self-ticking countdowns; "Paused" without one.
- [x] Updated only on start, pause, reset, adjust and finish; the pushed state comes from a pure function with unit tests.
- [x] A tap opens cook mode on the soonest timer's step.
- [ ] Checked by hand on a device, locked and with the app closed.
- [x] Gates green, including mobile's lint, typecheck, test and `expo export --platform ios`.

## Comments

- 2026-11-15: `expo-widgets` 58.0.28 (`expo install`) with `bundleIdentifier: dev.norish.app.widgets`, App Group `group.dev.norish.app` and no `widgets[]` (Live Activities register at runtime); clean prebuild + Debug build embed `ExpoWidgetsTarget.appex` beside `NorishShare.appex`, the activity rendered and Safari → Norish still imported in the same build, so no fallback. The state is `timerActivityPlan` (`lib/timer-activity-state.ts`); `syncTimerActivity` runs on the notifications' `syncing` chain and `endRecipeTimers` ends it immediately (Sign-out, Session Expiry, Account deletion; Hidden Items' `clearAll` syncs to an end). `cookModeRoute` moved to `lib/cook-mode-route.ts` with `cookModeUrl`, fed to `widgetURL` on each render so the tap follows the soonest timer.
- Decided: a running row pushes only its end (no clock value), so an identical plan is skipped and a foreground resync pushes nothing; the stale date is the last running end when nothing is paused, and a stale activity reads Done; at launch a stale or extra activity is updated, ended or ended at once; Done ends with iOS's default dismissal, a removal or session end with `immediate`. Deviations from the boards: rows are 42 pt (iOS caps a Lock Screen activity near 160 pt; 54 pt rows clipped the third row and "+N"), the ring is a circular `ProgressView` whose own time label is cleared, the step line is the timer's label ("Step 3"), the surface is opaque cream (an 8-digit hex is read as ARGB).
- Simulator (iPhone 18 Pro, iOS 27.2, Debug): Lock Screen list with one, three soonest-first + "+1 more", Paused, resume, finish dropping a row, Done when the last finished in the foreground, a stale activity ended Done on relaunch, a tap opening cook mode on step 5 (`norish:///recipe/<id>/cook?step=4`), Sign-out dismissing it. Not seen: the Dynamic Island (Simulator draws it outside the screenshot), the stale view flipping to Done with the app suspended (it kept 0:00 until the app ran), the panel colour (the simulator tinted it gold with or without our tint).
- Maintainer device check: start 1, 3 and 5 timers, lock: rows, "+N", countdowns ticking; long-press the island (expanded), compact with one timer, minimal with another app's activity; pause/±/reset each update it; kill the app with timers running and let them run out locked (stale → Done?); tap the activity and the island from the Lock Screen (cook mode on the soonest step); Sign-out and hiding timers end it; light and dark; an earlier Done activity stacking above a new one (default dismissal) — say if Done should leave sooner.
- Ticket 30: docs and release notes for the Live Activity (what it shows, the tap, Done, that it needs Live Activities allowed in Settings).
