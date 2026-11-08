# 06: Groceries into `features/groceries`

**What to build:** Web's groceries code moves into `apps/web/features/groceries/`: the screen, components (including `dnd`, `pantry` and `stores`) and web-only hooks. `app/(app)/groceries/` keeps only route files that seed and render the feature's screen. `MiniGroceries`, the panel other pages open, moves in too and is the one thing `features/groceries/index.ts` exports. Other code another feature also uses moves to the shared folders instead: `GroceryCheckbox` becomes `RoundCheckbox` in `components/`. Unit tests move next to their code. See `.scratch/app-structure/spec.md`, "Features" and "Web layout".

**Blocked by:** 02, 05

**Status:** ready-for-agent

- [ ] `components/groceries/` and `hooks/groceries/` are gone; nothing groceries-only remains in the type folders.
- [ ] `app/(app)/groceries/` holds only `page.tsx`, `layout.tsx`, `loading.tsx` and the pantry route files, each rendering a screen from `@/features/groceries/`.
- [ ] `features/groceries/index.ts` exports only `MiniGroceries`; the recipe card, the recipe page's actions menu and add-to-groceries button, and the after-planning panel import it from `@/features/groceries`.
- [ ] `GroceryCheckbox` is renamed `RoundCheckbox` and lives in `components/` with `isCheckboxEvent`; its callers in groceries, the recipe card, a recipe's ingredients and the cookbook picker follow.
- [ ] The feature lint rule passes with no exceptions.
- [ ] Groceries imports nothing from web's `context/` folder; it reads only `@norish/shared-react/*` and web's shared folders.
- [ ] Groceries unit tests sit next to their code, not under `__tests__/`.
- [ ] The groceries E2E set (spec, "Testing Decisions") passes unchanged.
