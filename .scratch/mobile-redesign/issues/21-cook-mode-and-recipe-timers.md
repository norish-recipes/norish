# 21: Cook mode and Recipe Timers

**What to build:** Cook mode and Recipe Timers that outlive it. See `.scratch/mobile-redesign/spec.md` Part 3 ("Cook mode", "Recipe Timers") and the CookMode board.

**Blocked by:** 20

**Status:** open

- [x] Moved first, in separate commits, web switched over: `apps/web/lib/timers.ts` to shared-react on platform storage, web's service-worker notification behind a platform notifier.
- [x] Cook mode as web's: prev/next peeks, ingredient chips, progress and Ready At, steps and ingredients views; the screen stays awake.
- [x] Timer chips on the Recipe page's steps and in cook mode; the clock pill opens the timer list.
- [x] Timers survive closing cook mode and the app; a local notification per timer (`expo-notifications` via `expo install`), scheduled on start, cancelled on pause, reset or removal; permission asked on the first timer.
- [x] A notification tap opens cook mode on the timer's step. Hidden recipe timers start nothing.
- [x] Gates green, including mobile's lint, typecheck, test and `expo export --platform ios`.

## Comments

- 2026-11-14: Moved first: web's SW notification behind the ticker's notifier, the timers store to `@norish/shared-react/recipes/timers` (own entry so web's root provider doesn't pull the recipes barrel; connected to platform storage on import, same `norish-timers` key), cooking-mode step resolution, timer markup (`markTimers`) and the adjust step; web switched in each. The store gained `stepIndex` and `timerEndsAt` (wall-clock end). Mobile keeps one pending notification per running timer, named `timer:<id>@<end>`, reconciled against the system's pending list on every start/pause/adjust/reset/remove and after the permission answer; a just-fired one is left alone. Timer ids follow web's page scheme (step number − 1), which cook mode shares; `cookModeRoute` and the store are for ticket 22.
- Deviations: Done on the last step closes cook mode (web disables it); the timer list keeps web's −/+ adjust beside pause; cook ingredients reuse the page's servings stepper and options menu instead of the board's ½/0.5 segment and US pill; glass is SwiftUI `glassEffect` behind RN controls. Web's cooking mode keys timers by `originalIndex` (headings counted) while its page uses step number − 1, so a heading recipe's timers differ between web's page and cook mode; left for a web fix.
- Simulator (iPhone 18 Pro, iOS 27.2, Debug dev client, local server, light and dark): chips idle/running ring/paused/Done on the page and in cook mode, started on either side showing on the other; permission prompt on the first start; pause, ±10 s, restart and dismiss in the clock pill's popover; prev/next, peeks, ingredients view, progress, Ready At; Keep screen awake reads selected while open; a running timer survived closing cook mode and a kill + relaunch (2:11 → 1:45 by wall clock); the notification fired with the app in the background ("Step 2 — Sausage…, Timer complete!"); a cook deep link with `step=1` opens on step 2 and closes onto the recipe. Not seen: tapping the notification (taps on SpringBoard banners and the cover sheet don't reach it through agent-device; the handler is unit-tested, cold start included), a cold-start deep link (the dev client's launcher takes it), hiding timers on device (chips are gated by `useTimersEnabledQuery`, timers cleared as on web).
- Open: the inline chips aren't in the accessibility tree (a Pressable inside Text); permission granted later in Settings resyncs only on the next timer change. Ticket 30: docs and release notes for cook mode, timer chips, the notification and its permission.
