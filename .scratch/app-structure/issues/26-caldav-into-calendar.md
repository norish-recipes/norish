# 26: CalDAV into `features/calendar`

**What to build:** The CalDAV tab's 312-line context goes: its cards read `@norish/shared-react/calendar` directly, and the tab moves into `apps/web/features/calendar`, since CalDAV is the calendar's sync. Three bugs go with the context. See `.scratch/app-structure/spec.md`, "Settings (the fifth feature)".

**Blocked by:** 23

**Status:** ready-for-agent

- [x] The CalDAV cards read `useCaldavConfigQuery`, `useCaldavSyncStatusQuery`, `useCaldavSummaryQuery`, `useCaldavConnectionQuery`, `useCaldavPasswordQuery` and `useCaldavMutations` from `@norish/shared-react/calendar`. The CalDAV screen mounts `useCaldavSubscription()`. The sync-status page and filter are `useState` in the sync-status card, starting from `FIRST_SYNC_STATUS_PAGE`, which the route's seed and the card share. `settings/caldav/context.tsx` goes, with its unread fields (`isConnected`, `connectionMessage`, `isCheckingConnection`, `fetchCalendars`, `syncAll`, `isFetchingCalendars`, `isDeletingConfig`) and the config summary's unused `syncStatuses` and `syncStatusSummary`.
- [x] Fixed: the connection badge reads `useCaldavConnectionQuery` and shows the check it just made. Today `checkConnectionStatus` starts a reread and returns the previous result, so a first check always reads "disconnected" and backs off. The hand-rolled poller goes for the query's `refetchInterval`: every 60 s, backing off to 5 min while disconnected.
- [x] Fixed: the stored password is read only while the edit modal is open, not on every visit to the tab.
- [x] Fixed: the success toasts (configuration saved, deleted, sync started) are translated in every locale.
- [x] `features/calendar` holds the CalDAV screen and its cards in an area of their own, with `use-connection-test`. `settings/caldav/page.tsx` renders the screen and keeps its seed.
- [x] Tests: the three CalDAV card tests mock the plain hooks and live in `features/calendar/__tests__/`; one pins the badge showing the current check and fails on today's code; one pins the password read only while the modal is open.
- [x] Gates green: `pnpm lint`, `pnpm typecheck`, `pnpm test:run`, `pnpm i18n:check`, `pnpm build`, `pnpm format:check`, `pnpm deps:cycles`, and mobile's lint, typecheck, test and `expo export --platform ios`.

## Comments

- Implementation (2e3760317..d93c06312): the screen is `features/calendar/caldav-screen.tsx` (`CaldavScreen`, mounting `useCaldavSubscription`); its cards, modals, skeleton, `CaldavShape`, `FIRST_SYNC_STATUS_PAGE` and `use-connection-test` sit in `features/calendar/components/caldav/`, which `root-messages.test.ts` exempts. `readCaldavShape` is `settings/caldav/read-caldav-shape.ts`; `read-settings-shape.ts` is gone.
- `useCaldavMutations` holds the toasts (`calendar.caldav.*`) and the errors (the platform's `showError`) in `useMutation`'s options; `saveConfig`/`deleteConfig` resolve whether they went through, `testConnection` answers a failed request as a failed test, and `triggerSync` is fire-and-forget. Unread `fetchCalendars`, `syncAll` and their pending flags went with the context.
- The badge reads `isChecking`/`isConnected`; the query rechecks each 60 s while connected, each 5 min while not (a step, not the old doubling), and a save rereads it. `useCaldavPasswordQuery({ enabled })` has `read()`, which waits for the read when the modal's reveal or test comes before it answers.
- Beyond the ticket: a saved config lands through `writeOverRead` (04e974281, test first); the unused `connectionStatus.unknown` message is dropped; the sync table's aria-label is translated; the sync-status rows are typed (`lastSyncAt` is a `Date`, which `any[]` hid).
- The password test drives the real hook over the tRPC fake (it asserts no `caldav.getPassword` read while closed); the other card tests mock the plain hooks.
