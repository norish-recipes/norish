# 22: Live Activity for Recipe Timers

**What to build:** One Live Activity showing every Recipe Timer on the device, on `expo-widgets`. See `.scratch/mobile-redesign/spec.md` Part 3 ("Live Activity") and ticket 18's Live Activity boards.

**Blocked by:** 21

**Status:** done

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
- 2026-11-15 review round: rows carry `state` (running/paused/done); a running row's countdown starts at `min(end − duration, now)` and keeps its first start while its end holds (`keepStarts`), so an adjust past the duration keeps ticking; a swiped-away activity stays away until a timer id starts running (new, resume, restart), and a launch's first sync starts nothing; the stale date is the last running end beside paused timers too, so stale running rows read Done and paused ones stay; the island's URL is a static attribute of `Activity.request` (expo-widgets `LiveActivityFactory.start`), so it cannot follow the soonest timer and compactTrailing now carries `widgetURL` like the other regions; one failed sync step is logged and no longer stops the chain; `syncTimerNotifications` → `syncTimers`; `runningTimers` is shared in shared-react. Simulator (iPhone 18 Pro, iOS 27.2, Debug): a 3:00 timer at +0:15 kept counting down on the Lock Screen; swiped away it stayed away through a finish, a foreground resync, a pause and +0:10, came back on Restart and on a new 2-min timer; the activity tap opened cook mode on step 2; Safari → Norish imported Easy pancakes.
- 2026-11-15 re-review round: a Live Activity start that throws (Live Activities off) restores the running set, so the next sync, such as the foreground resync after turning them on, starts it; the logging of failed sync steps is asserted, and a kept `startsAt` is tested through the sync (an unchanged end pushes once, a moved end pushes again). Simulator clean-up: leftover test timers dismissed, the imported Easy pancakes deleted.
- Limit: the extension renders with no clock and one stale date, so without a push a finished row among running ones stays first at 0:00 until the app runs.
- Maintainer device check, added: tap the island compact (leading and trailing), minimal and expanded: each opens cook mode on the soonest step; swipe the activity away, then pause or adjust: it stays away; start a timer: it returns.
- Ticket 30: docs and release notes for the Live Activity (what it shows, the tap, Done, that it needs Live Activities allowed in Settings).

### Review log (2026-11-15)

Range `89402fdb9..a0f1e240e`. Standards on Sonnet low, Spec on Opus high; fixes `4d721d16f..ffba250ff`, re-reviewed on Opus high, second round `eb9ca7dc2..a0f1e240e`. The Spec review found the update triggers, the serialised start and end, the session end, Hidden Items, the tap's route and the `expo-widgets` set-up beside the Share Extension clean.

Fixed, first round (12): a running timer adjusted up freezing its countdown (the interval's start is never after now); a swiped-away activity coming back on the next resync (only a timer start creates one); the cook-mode link on every island region; the stale date set from the last running end when paused timers are present; one failed step stalling every later timer sync; tests for ties and for Live Activities switched off; one strings type; `runningTimers` shared with the notification planner; rows carrying a `state`; names, `syncTimers`, comments.

Fixed, second round (3): a start that failed with Live Activities off being counted as done; three tests asserting the log; the unchanged-plan skip tested with a running row.

Rejected (1): after a cold start the ring of a timer adjusted past its duration starts full again (the countdown stays right; it would need a new persisted field).

Known limits, written above: a row that ended early among running ones shows 0:00 until the app next runs; a launch after iOS ended the activity at eight hours shows none until a timer is started.

For the maintainer: the device hand-check box (list above, including the island taps and the swipe-away rule); the 42 pt rows; a Done activity ending with iOS's default dismissal, so an earlier one can sit above a new one; whether a launch with timers running should bring a missing activity back.

Final state `a0f1e240e`: all 11 gates exit 0, mobile lint without warnings.
