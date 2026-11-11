# 26: CalDAV into `features/calendar`

**What to build:** The CalDAV tab's 312-line context goes: its cards read `@norish/shared-react/calendar` directly, and the tab moves into `apps/web/features/calendar`, since CalDAV is the calendar's sync. Three bugs go with the context. See `.scratch/app-structure/spec.md`, "Settings (the fifth feature)".

**Blocked by:** 23

**Status:** ready-for-agent

- [ ] The CalDAV cards read `useCaldavConfigQuery`, `useCaldavSyncStatusQuery`, `useCaldavSummaryQuery`, `useCaldavConnectionQuery`, `useCaldavPasswordQuery` and `useCaldavMutations` from `@norish/shared-react/calendar`. The CalDAV screen mounts `useCaldavSubscription()`. The sync-status page and filter are `useState` in the sync-status card, starting from `FIRST_SYNC_STATUS_PAGE`, which the route's seed and the card share. `settings/caldav/context.tsx` goes, with its unread fields (`isConnected`, `connectionMessage`, `isCheckingConnection`, `fetchCalendars`, `syncAll`, `isFetchingCalendars`, `isDeletingConfig`) and the config summary's unused `syncStatuses` and `syncStatusSummary`.
- [ ] Fixed: the connection badge reads `useCaldavConnectionQuery` and shows the check it just made. Today `checkConnectionStatus` starts a reread and returns the previous result, so a first check always reads "disconnected" and backs off. The hand-rolled poller goes for the query's `refetchInterval`: every 60 s, backing off to 5 min while disconnected.
- [ ] Fixed: the stored password is read only while the edit modal is open, not on every visit to the tab.
- [ ] Fixed: the success toasts (configuration saved, deleted, sync started) are translated in every locale.
- [ ] `features/calendar` holds the CalDAV screen and its cards in an area of their own, with `use-connection-test`. `settings/caldav/page.tsx` renders the screen and keeps its seed.
- [ ] Tests: the three CalDAV card tests mock the plain hooks and live in `features/calendar/__tests__/`; one pins the badge showing the current check and fails on today's code; one pins the password read only while the modal is open.
- [ ] Gates green: `pnpm lint`, `pnpm typecheck`, `pnpm test:run`, `pnpm i18n:check`, `pnpm build`, `pnpm format:check`, `pnpm deps:cycles`, and mobile's lint, typecheck, test and `expo export --platform ios`.

## Comments
