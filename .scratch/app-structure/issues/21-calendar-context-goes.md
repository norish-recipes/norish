# 21: `CalendarContext` goes

**What to build:** `CalendarContext` held the range, the planned items and the mutations in one value. The calendar page and today's meals each mounted one, and the panels borrowed its mutations. Now the planned items are read through `useCalendarQuery(range)`, the mutations come from `useCalendarMutations()`, and the range lives in a per-page store that calendar's root makes. Nothing visible changes. See `.scratch/app-structure/spec.md`, "Calendar (the fourth feature)" and the per-page store rule under "State".

**Blocked by:** 20

**Status:** done

- [x] A per-page range store in `shared-react/calendar` is made once from the reader's today (`useReaderToday`, so a hydrating render asks for the seeded range) and handed down through a context that holds only the store. It holds the range and whether it is growing, with the action the context had that anything read: grow into the past or the future by 12 days. Components read it with a selector.
- [x] The calendar page's root makes the store, mounts `useCalendarSubscription()` and renders the timeline. The desktop and mobile timelines read the range from the store and the planned items through `useCalendarQuery`. "Loading" means the first load only, as before.
- [x] Today's meals (`components/dashboard/today/`) reads the week the dashboard layout seeds (`getInitialDateRange("desktop", today)`) through `useCalendarQuery`, mounts `useCalendarSubscription()` itself and keeps no store. It stays in `components/dashboard/today/`.
- [x] `MiniRecipes`, `EditNotePanel` and `EditPlannedRecipePanel` plan, move, update and delete through `useCalendarMutations()`. `MiniRecipes` stays in `components/Panel/consumers/`.
- [x] `app/(app)/calendar/context.tsx` and `context-types.ts` are deleted, and nothing imports `useCalendarContext`.
- [x] The range store gets a unit test: it is made from a given today and grows both ways. `__tests__/app/calendar/context.test.tsx` becomes that test. `todays-meals.test.tsx` and `panels-read-while-open.test.tsx` mock the plain hooks instead of the context.
- [x] Gates green: `pnpm lint`, `pnpm typecheck`, `pnpm test:run`, `pnpm i18n:check`, `pnpm build`, `pnpm format:check`, `pnpm deps:cycles`, and mobile's lint, typecheck, test and `expo export --platform ios`.

## Comments

- `createPageStoreContext` moved from `shared-react/recipes` to a new cross-cutting `shared-react/page-store` folder (exported as `@norish/shared-react/page-store`, listed in the lint rule's `crossCutting`), since calendar can't import recipes.
- The store holds a `CalendarRange` of date keys. Its unit test lives in `shared-react/src/calendar/__tests__/calendar-range-store.test.ts`; `getItemsForSlot` had no reader and went.
- Review (Opus xhigh, both axes). Fixed: `use-calendar-dnd.ts` and its test are deleted, since nothing but the test imported the hook before this run either (the timelines drag through their own `DndContext`), so `hooks/calendar/` is gone here, and 22 writes the one hook both timelines drag through; the store's `isDateInRange` goes for the same reason, though this ticket's first box asked for it; today's meals keeps the week it mounted with, as the context did; "loading" is the first read only again, errors included, held once in the hook both timelines read the range and its items through; a grow in one direction no longer drops one in the other; one helper makes the opening `CalendarRange` for the layouts, the store and today's meals; one `CalendarRange` type, in `@norish/shared/lib/helpers` beside `getInitialCalendarRange` and `parseDateKey`; `planRecipe`/`planNote` replace `createItem`'s positional `undefined`; the timelines use the store's names.
- Withdrawn: dropping the memo hooks in the rewritten hunks. The timelines and `MiniRecipes` are `"use no memo"`, so their hand-written memo is the only memoisation they have (reverted in a81c5b7c8).
- Re-review of the fix range (Opus xhigh): no bugs. Fixed: the `parseDateKey` test pins a zone west of UTC; the calendar page parses its date key with `parseDateKey`; `useCalendarRangeQuery` hands back `grow` and `isGrowing`; today's meals drops a memo hook on a rewritten line. The grow-on-scroll effect both timelines repeat goes to 22.
- Rejected: porting the context test's "throws outside provider" case (the page-store helper throws it, not calendar code).
- Docs: CONTRIBUTING's and the Architecture page's cross-cutting lists get `page-store/` in the docs pass after 22.
