# 20: `shared-react/calendar`, with CalDAV and mutations without a range

**What to build:** The calendar domain moves to `@norish/shared-react/calendar` as plain hooks: the planned items (query, mutations, cache helpers, subscription) and their CalDAV mirror (config, password, connection, sync status, summary, mutations, subscription). The mutations stop taking a range, so whatever plans or edits can call them without borrowing an opener's range. `CalendarContext` stays for now, fed by the plain hooks; 21 removes it. Nothing visible changes but the CalDAV sync toast's wording, which becomes translated. See `.scratch/app-structure/spec.md`, "Calendar (the fourth feature)".

**Blocked by:** None (library has landed)

**Status:** ready-for-agent

- [ ] `packages/shared-react/src/calendar/` holds the calendar and CalDAV hooks, exported as `@norish/shared-react/calendar`, each importing `useTRPC` from `trpc/`. `createCalendarHooks`, `createCaldavHooks`, their `hooks/calendar` and `hooks/caldav` folders and their entries in `./hooks` are gone.
- [ ] `useCalendarMutations()` takes no range. A delete, move or update writes optimistically into every cached `calendar.listItems` range, as a create and the subscription already do (`upsertItemAcrossRanges`, `removeItemAcrossRanges`). A failed write that wasn't Queued rolls every range back, and a stale write rereads every range. The version a write sends comes from whichever cached range holds the item.
- [ ] The CalDAV subscription toasts the sync start through `usePlatform().toast` with translated keys, as `use-ratings-subscription.ts` does. Its `useToastAdapter` option and web's `toastAdapter` go. The new keys are in every locale (`pnpm i18n:check`).
- [ ] Web's `hooks/calendar/` bindings (`shared-calendar-hooks.ts`, `use-calendar-query.ts`, `use-calendar-mutations.ts`, `use-calendar-cache.ts`, `use-calendar-subscription.ts`) and all of `hooks/caldav/` are deleted. Every reader imports `@norish/shared-react/calendar`: the calendar context, `MiniCalendar` and the CalDAV settings tab (`app/(app)/settings/caldav/context.tsx`, which otherwise stays). `use-calendar-dnd.ts` stays in `hooks/calendar/` until 22.
- [ ] The context and `MiniCalendar` call `useCalendarMutations()` with no range.
- [ ] Tests move into `shared-react/src/calendar/__tests__/`: `caldav-versioning.test.ts` and web's `__tests__/hooks/calendar/` and `__tests__/hooks/caldav/` suites, which test shared code, now running against the plain hooks.
- [ ] New unit tests: a delete, a move and an update each land in two cached ranges at once; a failed write rolls both back; a Queued write keeps both.
- [ ] Gates green: `pnpm lint`, `pnpm typecheck`, `pnpm test:run`, `pnpm i18n:check`, `pnpm build`, `pnpm format:check`, `pnpm deps:cycles`, and mobile's lint, typecheck, test and `expo export --platform ios`.
