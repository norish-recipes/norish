# 22: `features/calendar`

**What to build:** Web's calendar moves into `apps/web/features/calendar`: the page, both timelines, the drag hook and the two edit panels only the calendar page opens. What the shared `MiniCalendar` draws stays in `components/calendar/`, and today's meals and `MiniRecipes` stay shared. After this ticket the whole E2E suite runs. Nothing visible changes. See `.scratch/app-structure/spec.md`, "Calendar (the fourth feature)" and "Web layout".

**Blocked by:** 21

**Status:** ready-for-agent

- [ ] `features/calendar` holds the calendar screen (today's `app/(app)/calendar/page.tsx` content and its root), the desktop and mobile timelines, `use-calendar-dnd.ts`, `EditNotePanel` and `EditPlannedRecipePanel`. Its `components/` is grouped by area, with an `index.ts` only for pieces more than one screen draws. `app/(app)/calendar/page.tsx` renders the screen and the layout keeps its seed.
- [ ] Everything `MiniCalendar` imports from `components/calendar/` (`TimelineDaySection`, `land-on-day` and their own imports) stays there, and so does whatever else today's meals or `MiniCalendar` draws. Nothing in the shared folders imports `@/features/calendar`.
- [ ] `hooks/calendar/` and `components/calendar/desktop/` are gone. Whatever of `components/calendar/mobile/` only the timeline draws has moved.
- [ ] The calendar's unit tests move into `features/calendar/__tests__/`.
- [ ] Gates green: `pnpm lint`, `pnpm typecheck`, `pnpm test:run`, `pnpm i18n:check`, `pnpm build`, `pnpm format:check`, `pnpm deps:cycles`, and mobile's lint, typecheck, test and `expo export --platform ios`.
- [ ] The whole E2E suite (`ai`, `offline`, `realtime`) passes once, with no retries.
