# 21: `CalendarContext` goes

**What to build:** `CalendarContext` held the range, the planned items and the mutations in one value. The calendar page and today's meals each mounted one, and the panels borrowed its mutations. Now the planned items are read through `useCalendarQuery(range)`, the mutations come from `useCalendarMutations()`, and the range lives in a per-page store that calendar's root makes. Nothing visible changes. See `.scratch/app-structure/spec.md`, "Calendar (the fourth feature)" and the per-page store rule under "State".

**Blocked by:** 20

**Status:** ready-for-agent

- [x] A per-page range store in `shared-react/calendar` is made once from the reader's today (`useReaderToday`, so a hydrating render asks for the seeded range) and handed down through a context that holds only the store. It holds the range and whether it is growing, with the actions the context had: grow into the past or the future by 12 days, and whether a date is in range. Components read it with a selector.
- [x] The calendar page's root makes the store, mounts `useCalendarSubscription()` and renders the timeline. The desktop and mobile timelines and `use-calendar-dnd.ts` read the range from the store and the planned items through `useCalendarQuery`. "Loading" means the first load only, as before.
- [x] Today's meals (`components/dashboard/today/`) reads the week the dashboard layout seeds (`getInitialDateRange("desktop", today)`) through `useCalendarQuery`, mounts `useCalendarSubscription()` itself and keeps no store. It stays in `components/dashboard/today/`.
- [x] `MiniRecipes`, `EditNotePanel` and `EditPlannedRecipePanel` plan, move, update and delete through `useCalendarMutations()`. `MiniRecipes` stays in `components/Panel/consumers/`.
- [x] `app/(app)/calendar/context.tsx` and `context-types.ts` are deleted, and nothing imports `useCalendarContext`.
- [x] The range store gets a unit test: it is made from a given today, grows both ways, and answers whether a date is in range. `__tests__/app/calendar/context.test.tsx` becomes that test. `todays-meals.test.tsx`, `calendar-dnd.test.tsx` and `panels-read-while-open.test.tsx` mock the plain hooks instead of the context.
- [x] Gates green: `pnpm lint`, `pnpm typecheck`, `pnpm test:run`, `pnpm i18n:check`, `pnpm build`, `pnpm format:check`, `pnpm deps:cycles`, and mobile's lint, typecheck, test and `expo export --platform ios`.

## Comments

- `createPageStoreContext` moved from `shared-react/recipes` to a new cross-cutting `shared-react/page-store` folder (exported as `@norish/shared-react/page-store`, listed in the lint rule's `crossCutting`), since calendar can't import recipes.
- The store holds a `CalendarRange` of date keys; `isDateInRange` takes a date key, and its last day now counts as in range. Its unit test lives in `shared-react/src/calendar/__tests__/calendar-range-store.test.ts`; `getItemsForSlot` had no reader and went.
- "Loading on the first load only" relies on `useCalendarQuery`'s `initialData`: a grown range starts from the overlapping range already read, so it never shows the skeleton.
- Today's meals derives its week from `useReaderToday()` each render instead of freezing it at mount. `useCalendarDnd` has no caller outside its test; it was rewired, not deleted.
