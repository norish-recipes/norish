# 22: `features/calendar`

**What to build:** Web's calendar moves into `apps/web/features/calendar`: the page, both timelines, the drag hook and the two edit panels only the calendar page opens. What the shared `MiniCalendar` draws stays in `components/calendar/`, and today's meals and `MiniRecipes` stay shared. After this ticket the whole E2E suite runs. Nothing visible changes. See `.scratch/app-structure/spec.md`, "Calendar (the fourth feature)" and "Web layout".

**Blocked by:** 21

**Status:** ready-for-agent

- [x] `features/calendar` holds the calendar screen (today's `app/(app)/calendar/page.tsx` content and its root), the desktop and mobile timelines, `EditNotePanel` and `EditPlannedRecipePanel`. Its `components/` is grouped by area, with an `index.ts` only for pieces more than one screen draws. `app/(app)/calendar/page.tsx` renders the screen and the layout keeps its seed.
- [x] Both timelines drag through one hook in `features/calendar` (the dragged item, the day dragged over, the start, over and end handlers and the collision detection), each passing its own sensors. Today each timeline holds a copy of the same handlers. The hook gets a unit test: a drop on a day moves the item there, and a drop elsewhere moves nothing.
- [x] The effect that grows the range when a scroll rests near an edge is written once and used by both timelines; they differ only in the edge threshold and in rows against days.
- [x] Everything `MiniCalendar` imports from `components/calendar/` (`TimelineDaySection`, `land-on-day` and their own imports) stays there, and so does whatever else today's meals or `MiniCalendar` draws. Nothing in the shared folders imports `@/features/calendar`.
- [x] `hooks/calendar/` and `components/calendar/desktop/` are gone. Whatever of `components/calendar/mobile/` only the timeline draws has moved.
- [x] The calendar's unit tests move into `features/calendar/__tests__/`.
- [x] Gates green: `pnpm lint`, `pnpm typecheck`, `pnpm test:run`, `pnpm i18n:check`, `pnpm build`, `pnpm format:check`, `pnpm deps:cycles`, and mobile's lint, typecheck, test and `expo export --platform ios`.
- [ ] The whole E2E suite (`ai`, `offline`, `realtime`) passes once, with no retries.

## Comments

- Areas: `components/timeline/` (both timelines, the desktop day card, both drag overlays and scroll-to-today buttons), `panels/` (the two edit panels), `skeleton/` (`calendar-skeleton` moved too, only calendar draws it); `hooks/` holds `use-calendar-dnd`, `use-grow-at-edges` and `use-prepend-anchor-restore`. One screen, so no `index.ts` anywhere.
- `calendar-screen.tsx` holds the content and its root (`CalendarScreen` makes the range store and mounts the subscription); `page.tsx` renders it, so git records the page as rewritten rather than renamed. The offline bootstrap still imports the route file.
- `components/calendar/mobile/` keeps what `MiniCalendar` draws (day section, slot container, planned item, item content, types); its `index.ts` lost the three moved exports. `land-on-day` and its test stay shared.
- `useCalendarDnd(calendarData, sensors)` returns the active item, the day dragged over and `DndContext` props; each timeline still passes `id={useId()}` itself, which the dnd-kit lint rule requires on the element. Neither new hook is `"use no memo"`.
- Left: the E2E box, for the orchestrator.

- Review (Opus xhigh, both axes): the moves and both extractions hold, line by line. Fixed: the screen's three `useCallback`s go (a compiled file); one scroll hook owns landing on today, the anchor restore, growing at the edges, scroll-to-today and today's visibility, where the grow hook's seam ran through a ref the timeline wrote; the two drag-overlay wrappers go; the timelines hand `sensors` to `DndContext` themselves; a cancelled drag clears the day highlight; the drop id is built and parsed in one shared file; `components/calendar/mobile/` flattens into `components/calendar/` without its barrel, since desktop and `MiniCalendar` draw those pieces too; `hasReachedDay` moves into the feature; unused values and exports go; the drag hook's test asserts what the cache holds after a drop; one E2E drags a planned item to another day, since no spec dragged on the calendar and both timelines' drag code was rewritten here.
- Rejected: nothing.
- Fix round: `useTimelineScroll` replaces `use-grow-at-edges` (options `pastGrowEdge`, `futureGrowEdge`, `todayBuffer`, `deferVisibilityCheck`); the per-day slot sort was deleted rather than shared, since both day cards regroup by slot and sort by `sortOrder` themselves; the drag E2E is in `ai/calendar-planning.e2e.ts` (5 of 5 with repeats). The fix range is re-reviewed inside the whole-branch review.
