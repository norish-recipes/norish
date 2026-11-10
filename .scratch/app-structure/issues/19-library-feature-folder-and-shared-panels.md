# 19: Library into `features/library`, and the shared panels

**What to build:** Web's Library moves into `apps/web/features/library/`: the dashboard's Library, the cookbook page, the filters panel, the selection bar and their components, grouped by area. The dashboard's route composes today's meals and the library screen. Panels opened by more than one feature live in `components/Panel/consumers/`. `MiniGroceries` moves back there, and features stop importing each other altogether. Nothing visible changes. Then the whole E2E suite runs once, as the set's proof. See `.scratch/app-structure/spec.md`, "Features", "Web layout" and "Library (the third feature)".

**Blocked by:** 18

**Status:** ready-for-agent

- [ ] `features/library/` holds library's root, the library screen and the cookbook screen. Their components are grouped by area, each area with an `index.ts`. The feature has no `index.ts`, since no other feature opens a library panel.
- [ ] What only the Library and the cookbook page use moves in. That includes:
  - `components/dashboard/*` except `today/`
  - `components/cookbooks/*` except `cookbook-icon`
  - the filters panel and `shared/filters.tsx`
  - the swipeable row
  - the action bar
  - the card and grid skeletons
  - `lib/library-items.ts`
  - the hooks only these pages use

  The import modals stay in `components/shared/` until imports moves.
- [ ] The dashboard's route renders today's meals, which stays in `components/dashboard/today/` until calendar, above the library screen. The `Dashboard` component goes, and the dashboard's skeleton composes the same two. The offline bootstrap renders the same composition and the cookbook screen.
- [ ] `MiniGroceries` moves from `features/groceries` to `components/Panel/consumers/`, beside `MiniCalendar`, `MiniCookbooks` and the after-planning step. `features/groceries/index.ts` goes.
- [ ] Each app's lint blocks `@/features/<x>` and `@/features/<x>/**` everywhere outside feature `<x>` except route files, mobile's included. The exception for a feature's `index.ts` goes.
- [ ] CONTRIBUTING's "App architecture" and the Architecture page state the panel rule: a panel several features open lives in the shared folders, and features never import each other. They drop "A feature's `index.ts` exports only the panels other features open" and "Opening a panel is the one way back". "Project Structure" shows `features/library`.
- [ ] Library's unit tests move into `features/library/__tests__/`.
- [ ] Gates green: `pnpm lint`, `pnpm typecheck`, `pnpm test:run`, `pnpm i18n:check`, `pnpm build`, `pnpm format:check`, `pnpm deps:cycles`, and mobile's lint.
- [ ] The whole E2E suite (`ai`, `offline`, `realtime`) passes once, after this ticket. A test that only passes on re-run is a bug to fix.
