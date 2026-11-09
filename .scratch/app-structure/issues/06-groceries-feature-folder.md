# 06: Groceries into `features/groceries`

**What to build:** Web's groceries code moves into `apps/web/features/groceries/`: the screen, components (including `dnd`, `pantry` and `stores`) and web-only hooks. `app/(app)/groceries/` keeps only route files that seed and render the feature's screen. `MiniGroceries`, the panel other pages open, moves in too and is the one thing `features/groceries/index.ts` exports. Other code another feature also uses moves to the shared folders instead: `GroceryCheckbox` becomes `RoundCheckbox` in `components/`. Unit tests move next to their code. See `.scratch/app-structure/spec.md`, "Features" and "Web layout".

**Blocked by:** 02, 05

**Status:** done (E2E pending)

Done at 8f21cc608. `features/groceries/` holds `groceries-screen.tsx`, `components/` (with `dnd/`, `pantry/`, `stores/`, the add, edit and recurrence panels, `MiniGroceries` and the skeleton, all groceries-only), `hooks/` (what was `hooks/stores/`, the grouped drag hook and `use-structural-sharing`, which only the list used), `lib/format-price.ts` and `index.ts`, whose one export is `MiniGroceries` (e27d51414). The tests sit beside their code (557bf3f8d); web's typecheck reads them wherever they sit, since its tsconfig takes the whole app, and they pass it. The layout seeds what it did and renders the screen; the pages and `loading.tsx` stay `null`, since the layout draws both views. The offline page hands its bootstrap the screen, because only a route file imports one. `RoundCheckbox` takes the Store colour as `storeCheckbox`, two class strings `store-colors.ts` keeps for the rows and drag ghosts (0003fda2c). `OnTheListMark` moved to `components/ingredients/`, since the ingredient panel shows it on a recipe and in Settings too (bbbf05f79).

The feature rule stopped shared code importing any feature, `index.ts` included (9375059d6), so the recipe card and the after-planning panel, which stay in `components/` until library and calendar move, could not open `MiniGroceries`. Shared code may now import a feature's `index.ts`, as the spec's "Features" says, and nothing deeper; CONTRIBUTING says so (f37282e58). Moving the card and after-planning into features instead would have pulled in the dashboard grid, today's meals, `MiniCalendar`, `MiniRecipes` and the cookbook page. `hooks/recipes/use-recipe-ingredients.ts` stays: only `MiniGroceries` reads it, but it is recipes' binding and goes with them.

Before it, three follow-ups from 05's review: the Pantry's add and removal, `useFileGroceryName` and the Store writes answer from `useMutation`'s own options, so two overlapping adds both settle and an overlapped failure still reads again (b357b6a66); lint flags `||=`, `&&=` and `??=` in the components and hooks web, mobile and shared-react compile, and found none (3a24dc192); each `DndContext` takes a `useId` id, which ends the hydration mismatch every dev load of `/groceries` logged (6f5a6ad5f). Renders, unchanged: check 0 / 268 / 7, add 19 / 1,529 / 13, edit panel 178 / 221 / 8, echo 0 / 227 / 2, view mode 853 / 700 / 10; `GroceryCheckbox` reads `RoundCheckbox`.

- [x] `components/groceries/` and `hooks/groceries/` are gone; nothing groceries-only remains in the type folders.
- [x] `app/(app)/groceries/` holds only `page.tsx`, `layout.tsx`, `loading.tsx` and the pantry route files, each rendering a screen from `@/features/groceries/`.
- [x] `features/groceries/index.ts` exports only `MiniGroceries`; the recipe card, the recipe page's actions menu and add-to-groceries button, and the after-planning panel import it from `@/features/groceries`.
- [x] `GroceryCheckbox` is renamed `RoundCheckbox` and lives in `components/` with `isCheckboxEvent`; its callers in groceries, the recipe card, a recipe's ingredients and the cookbook picker follow.
- [x] The feature lint rule passes with no exceptions.
- [x] Groceries imports nothing from web's `context/` folder; it reads only `@norish/shared-react/*` and web's shared folders.
- [x] Groceries unit tests sit next to their code, not under `__tests__/`. Lint and typecheck skip test files wherever they sit.
- [ ] The groceries E2E set (spec, "Testing Decisions") passes unchanged. Not run yet: the E2E set runs once, after the whole ticket set.
