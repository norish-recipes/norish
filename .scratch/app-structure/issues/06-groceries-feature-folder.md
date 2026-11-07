# 06: Groceries into `features/groceries`

**What to build:** Web's groceries code moves into `apps/web/features/groceries/`: the screen, components (including `dnd`, `pantry` and `stores`) and web-only hooks. `app/(app)/groceries/` keeps only route files that seed and render the feature's screen. Code another feature also uses moves to the shared folders instead. Unit tests move next to their code. See `.scratch/app-structure/spec.md`, "Features" and "Web layout".

**Blocked by:** 02, 05

**Status:** ready-for-agent

- [ ] `components/groceries/` and `hooks/groceries/` are gone; nothing groceries-only remains in the type folders.
- [ ] `app/(app)/groceries/` holds only `page.tsx`, `layout.tsx`, `loading.tsx` and the pantry route files, each rendering from `@/features/groceries`.
- [ ] The feature lint rule passes with no exceptions.
- [ ] Groceries imports nothing from web's `context/` folder; it reads only `@norish/shared-react/*` and web's shared folders.
- [ ] Groceries unit tests sit next to their code, not under `__tests__/`.
- [ ] The groceries, pantry, aisles, prices and versions E2E specs pass unchanged.
