## 1. Bug Fixes

- [x] 1.1 Fix invalid `font-lg` class in `timer-chip.tsx` (lines 58, 86) — replace with correct Tailwind class (e.g., `text-lg` or remove if redundant with existing `text-base`)
- [x] 1.2 Replace `data?: any` in `smart-instruction.tsx:27` with a typed `TimerSegmentData` interface
- [x] 1.3 Rename `activeTimers` to `runningTimers` in `timer-dock.tsx:54` to match its actual filter behavior
- [x] 1.4 Return `null` instead of `<TimerTicker />` when `allActiveOrPaused.length === 0` in `timer-dock.tsx:117`
- [x] 1.5 Fix hardcoded `(?:en|s)?` suffix in `timer-parser.ts:138` — make it respect the configured keywords without appending language-specific suffixes
- [x] 1.6 Add/update unit tests for the regex fix in `timer-parser.test.ts`

## 2. Styling Consistency

- [x] 2.1 Replace all hardcoded color classes in `timer-dock.tsx` expanded panel with design tokens:
  - `bg-white dark:bg-zinc-800` => `bg-content1`
  - `bg-zinc-50/80 dark:bg-zinc-700/50` => `bg-content2`
  - `text-zinc-900 dark:text-zinc-100` => `text-foreground`
  - `text-zinc-500 dark:text-zinc-400` => `text-default-500`
  - `border-zinc-200/50 dark:border-zinc-700/50` => `border-default-200`
  - `bg-zinc-200 dark:bg-zinc-700` (divider) => `bg-default-200`
  - `hover:bg-zinc-50 dark:hover:bg-zinc-800/50` => `hover:bg-content2`
  - `bg-red-50/50 dark:bg-red-900/10` => `bg-danger-50`
  - `bg-red-600` (collapsed completed pill) => `bg-danger`
  - `text-red-600 dark:text-red-500` => `text-danger`
  - `bg-white/90 dark:bg-zinc-800/90` => `bg-content1/90`
- [x] 2.2 Update expanded panel border radius from `rounded-xl` to `rounded-2xl` to match card convention
- [x] 2.3 Verify all changes render correctly in both light and dark modes

## 3. Background Notifications

- [x] 3.1 Create `hooks/use-notification-permission.ts` — hook that tracks permission state (`granted`/`denied`/`default`) and exposes a `requestPermission()` function
- [x] 3.2 Integrate permission request into `TimerChip` — on first timer start, call `requestPermission()` if state is `default`
- [x] 3.3 Add notification dispatch to timer store `tick()` — when a timer transitions to `completed` and `document.hidden === true`, call `navigator.serviceWorker.ready` then `registration.showNotification()` with timer label and recipe name
- [x] 3.4 Add `notificationclick` event listener to `public/sw.js` — focus existing client window or open the app URL
- [x] 3.5 Add a subtle "Notifications disabled" indicator in `TimerDock` when permission is `denied`, with guidance text
- [x] 3.6 Add i18n strings for notification title/body and permission UI text (en, de-informal, de-formal, fr, nl)
- [x] 3.7 Test notification flow: start timer => background tab => timer completes => OS notification appears => click notification => app focuses
- [x] 3.8 Test graceful fallback when notifications are denied or unavailable (audio still works)

## Dependencies

- Tasks in section 1 and 2 are independent and can be parallelized
- Task 3.1 must complete before 3.2 and 3.3
- Task 3.4 is independent of 3.1–3.3
- Task 3.6 can be parallelized with 3.1–3.5
- Tasks 3.7 and 3.8 are validation and depend on all prior section 3 tasks
