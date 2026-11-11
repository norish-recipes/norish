# 19: Library into `features/library`, and the shared panels

**What to build:** Web's Library moves into `apps/web/features/library/`: the dashboard's Library, the cookbook page, the filters panel, the selection bar and their components, grouped by area. The dashboard's route composes today's meals and the library screen. Panels opened by more than one feature live in `components/Panel/consumers/`. `MiniGroceries` moves back there, and features stop importing each other altogether. Nothing visible changes. Then the whole E2E suite runs once, as the set's proof. See `.scratch/app-structure/spec.md`, "Features", "Web layout" and "Library (the third feature)".

**Blocked by:** 18

**Status:** done

- [x] `features/library/` holds library's root, the library screen and the cookbook screen. Their components are grouped by area, each area with an `index.ts`. The feature has no `index.ts`, since no other feature opens a library panel.
- [x] What only the Library and the cookbook page use moves in. That includes:
  - `components/dashboard/*` except `today/`
  - `components/cookbooks/*` except `cookbook-icon`
  - the filters panel and `shared/filters.tsx`
  - the swipeable row
  - the action bar
  - the card and grid skeletons
  - `lib/library-items.ts`
  - the hooks only these pages use

  The import modals stay in `components/shared/` until imports moves.
- [x] The dashboard's route renders today's meals, which stays shared in `components/dashboard/today/`, above the library screen. The `Dashboard` component goes, and the dashboard's skeleton composes the same two. The offline bootstrap renders the same composition and the cookbook screen.
- [x] `MiniGroceries` moves from `features/groceries` to `components/Panel/consumers/`, beside `MiniCalendar`, `MiniCookbooks` and the after-planning step. `features/groceries/index.ts` goes.
- [x] Each app's lint blocks `@/features/<x>` and `@/features/<x>/**` everywhere outside feature `<x>` except route files, mobile's included. The exception for a feature's `index.ts` goes.
- [x] CONTRIBUTING's "App architecture" and the Architecture page state the panel rule: a panel several features open lives in the shared folders, and features never import each other. They drop "A feature's `index.ts` exports only the panels other features open" and "Opening a panel is the one way back". "Project Structure" shows `features/library`.
- [x] Library's unit tests move into `features/library/__tests__/`.
- [x] Gates green: `pnpm lint`, `pnpm typecheck`, `pnpm test:run`, `pnpm i18n:check`, `pnpm build`, `pnpm format:check`, `pnpm deps:cycles`, and mobile's lint.
- [x] The whole E2E suite (`ai`, `offline`, `realtime`) passes once, after this ticket. A test that only passes on re-run is a bug to fix.

## Comments

- Areas: `grid/` (both screens' grids, the cards, `CookbookMembers`), `header/`, `filters/` (panel, button, floating chip), `selection/` (bar, action bar, the leaving store), `cookbooks/` (edit, title, delete and add panels), `skeleton/`; plus `hooks/` and `lib/library-items.ts`. No area barrel imports another in a cycle (`deps:cycles` green).
- Stayed shared though the list says `components/cookbooks/*` moves: `cookbook-cover` and `selectable-row`, since `MiniCookbooks` uses them. `use-in-view.tsx` has no importer and was left alone.
- The offline bootstrap renders the dashboard's `page.tsx` and the cookbook's `loading.tsx` (route files, as it already did for calendar), so the composition is written once; `page.tsx` and `loading.tsx` each hold the wrapper `div`. `MiniGroceries` is imported by file, not through the consumers barrel, so pages that open it don't load the rest.
- Also: the skeleton key-exemption glob now reaches `features/*/components/**`, and `heroui-styles` and `root-messages` scan `features/` too (they skipped it). The mini-groceries test moved to `__tests__/components/panel/`.
- Left for the docs writer: the docs checkbox, including CONTRIBUTING's `@/hooks/use-library` import example (now `@/features/library/hooks`). E2E left for the orchestrator.
- Review round: an area's `index.ts` re-exports only what both Library screens draw; a piece only one screen draws (`LibraryView`, `CookbookMembers`, `FloatingRecipeChip`, both headers, `CookbookSelectionBar`, `CookbookTitlePanel`) is imported by file, so `grid/index.ts` is gone and `CookbookSelectionBar` sits in `selection/` outside its index. `LibraryHeader`/`CookbookHeader` live in `header/`, `LibrarySkeleton`/`CookbookSkeleton` in `skeleton/` (both loading files import them by file; `LibraryScreen` lost its `skeleton` prop). Cookbook loading chunks went from 589 KB to 71 KB.
- Renames: `CookbookPage` → `CookbookScreen` (named), `components/cookbooks/` → `components/panels/`, `lib/library-items.ts` → `components/grid/library-items.ts`; `use-in-view` deleted; `useContainerColumns` tests moved into the feature; `webSourceFiles()` in `__tests__/helpers/`.
