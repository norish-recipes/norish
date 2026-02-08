# Change: Improve Timer System (Bugs, Styling, Background Notifications)

## Why

The timer detection system has several bugs and code quality issues (invalid CSS class, `any` type, misleading variable names), uses hardcoded color values instead of the app's design tokens (breaking theme consistency), and critically lacks any mechanism to alert users when the app is in the background — making timers effectively useless during real cooking sessions where the phone screen is off or switched to another app.

## What Changes

### 1. Bug Fixes

- Fix invalid `font-lg` Tailwind class in `timer-chip.tsx` (appears twice, lines 58 and 86)
- Replace `data?: any` type in `smart-instruction.tsx:27` with a proper typed interface (violates "no type suppression" convention)
- Fix misleading `activeTimers` variable name in `timer-dock.tsx:54` (filters to only "running" timers, not all "active" ones)
- Remove unnecessary `<TimerTicker />` render when there are zero timers (`timer-dock.tsx:117`)
- Fix hardcoded `(?:en|s)?` language suffix in `timer-parser.ts:138` regex — this causes false matches like "minutess" and is fragile for multilingual support

### 2. Styling Consistency

- Replace all hardcoded `zinc-*`, `white`, `red-*` color classes in `timer-dock.tsx` with design token classes (`bg-content1`, `bg-content2`, `text-foreground`, `text-default-500`, `bg-danger`, `divide-default-100`, etc.)
- Align border radius with app conventions (`rounded-2xl` for expanded panel to match cards)
- Use `divide-default-100` pattern for timer row separators instead of manual border classes

### 3. Background Notifications (PWA)

- Add browser Notification API integration for timer completion alerts when the app is backgrounded
- Add notification permission request flow in the timer UI
- Add `notificationclick` handler in the service worker to focus/navigate back to the app
- Detect foreground/background state via Page Visibility API to choose between in-app audio vs. OS notification

## Impact

- Affected specs: none existing (new `timer-notifications` and `timer-ui` capabilities)
- Affected code:
  - `components/recipe/timer-chip.tsx` — CSS fix
  - `components/recipe/smart-instruction.tsx` — type fix
  - `components/timer-dock.tsx` — styling overhaul + notification trigger
  - `stores/timers.ts` — notification dispatch on completion
  - `lib/timer-parser.ts` — regex fix
  - `public/sw.js` — notification click handler
  - New: notification permission hook/component
