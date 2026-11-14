# 21: Cook mode and Recipe Timers

**What to build:** Cook mode and Recipe Timers that outlive it. See `.scratch/mobile-redesign/spec.md` Part 3 ("Cook mode", "Recipe Timers") and the CookMode board.

**Blocked by:** 20

**Status:** open

- [ ] Moved first, in separate commits, web switched over: `apps/web/lib/timers.ts` to shared-react on platform storage, web's service-worker notification behind a platform notifier.
- [ ] Cook mode as web's: prev/next peeks, ingredient chips, progress and Ready At, steps and ingredients views; the screen stays awake.
- [ ] Timer chips on the Recipe page's steps and in cook mode; the clock pill opens the timer list.
- [ ] Timers survive closing cook mode and the app; a local notification per timer (`expo-notifications` via `expo install`), scheduled on start, cancelled on pause, reset or removal; permission asked on the first timer.
- [ ] A notification tap opens cook mode on the timer's step. Hidden recipe timers start nothing.
- [ ] Gates green, including mobile's lint, typecheck, test and `expo export --platform ios`.

## Comments
