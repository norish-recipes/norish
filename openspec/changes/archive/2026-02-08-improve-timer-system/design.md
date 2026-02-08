## Context

Norish is a PWA (`display: "standalone"`) with a hand-rolled service worker (`public/sw.js`). Timers are fully client-side (Zustand store persisted to localStorage, tick loop via `setInterval`). When a timer completes, the app currently plays an audio loop — but only while the tab is in the foreground. There is zero notification infrastructure: no Notification API usage, no push event listener in the SW, no VAPID keys, no server-side push.

Since timers are client-side countdowns (not server-driven), we do NOT need Web Push (server-to-client push). We only need the browser's **Notification API** triggered directly from the client when a timer completes while the page is hidden.

### Stakeholders

- Users cooking with recipes open — they leave the phone on the counter and need an alert when the timer finishes
- Admin — no new configuration required (notification permission is per-user browser choice)

## Goals / Non-Goals

- **Goals:**
  - Notify the user via OS-level notification when a timer completes and the app is in the background
  - Request notification permission with a non-intrusive UX (not on first visit — only when user first interacts with a timer)
  - Handle `notificationclick` in the SW to focus/open the app
  - Keep the existing audio alert for foreground usage
  - Fix all identified bugs and styling inconsistencies

- **Non-Goals:**
  - Server-side Web Push infrastructure (not needed for client-side timers)
  - Push notification for recipe imports, household events, or other server events (separate future work)
  - Custom notification sounds via the Notification API (browser support is inconsistent)
  - Notification grouping or action buttons (keep it simple)

## Decisions

### Decision: Use Notification API directly, not Web Push

- **Why:** Timers tick client-side. The page/SW is already running when the timer completes — we just need to show an OS notification. Web Push requires VAPID keys, a push subscription endpoint, and a server component, all unnecessary here.
- **Alternatives considered:**
  - _Web Push via `web-push` library:_ Full server infrastructure for a client-side event — over-engineered.
  - _`ServiceWorkerRegistration.showNotification()`:_ This is the method we'll use since it works even when the page is backgrounded, unlike `new Notification()` which may be suppressed in some browsers when the page is hidden.

### Decision: Request permission on first timer interaction, not on page load

- **Why:** Browsers penalize sites that request notification permission without user gesture. Asking when the user first clicks a timer chip is contextually appropriate and has high grant rates.
- **Alternative:** Settings page toggle — adds complexity, and users may not find it. We can add this later if needed.

### Decision: Foreground detection via `document.hidden` (Page Visibility API)

- **Why:** Simple, well-supported, and already partially used in the codebase (`use-wake-lock.tsx`). When `document.hidden === true` at timer completion, fire an OS notification. When `false`, keep existing audio behavior.

### Decision: Replace hardcoded colors with design tokens, not custom CSS variables

- **Why:** The app uses HeroUI's semantic color system (`content1`–`content4`, `foreground`, `default-*`, `danger`) mapped via Tailwind CSS v4 `@theme`. Using these tokens ensures automatic light/dark mode support and visual consistency.

## Risks / Trade-offs

- **Notification permission denied:** Users who deny permission won't get background alerts. Mitigation: show a subtle hint in the timer dock that notifications are disabled, with a link to re-enable.
- **Browser differences:** `ServiceWorkerRegistration.showNotification()` requires the SW to be active. On most browsers this is fine for a PWA, but Safari has historically been restrictive. Mitigation: graceful fallback — if `showNotification` fails, log a warning and rely on audio.
- **Tab throttling:** Background tabs may throttle `setInterval`. Mitigation: the existing `lastTickAt` drift-correction in the tick loop already handles this — the timer will still complete at the right wall-clock time even if ticks are delayed.

## Open Questions

- Should we add a "Test notification" button in settings for users to verify their setup?
- Should completed timer notifications auto-dismiss after a timeout, or persist until tapped?
