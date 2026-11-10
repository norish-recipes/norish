# 15: Recipes into `features/recipes`

**What to build:** Web's recipe surfaces move into `apps/web/features/recipes/`: the recipe page (desktop and mobile), cooking mode, the editor (new and edit) and the shared recipe page, with their components grouped by area. The read-only pieces both recipe pages render are recipes' own. Route files keep only their seeding, metadata and params, and render a screen; the media route handlers stay where they are. Pieces the Library also renders go to the shared folders. Nothing visible changes. Then the whole E2E suite runs once, as the set's proof. See `.scratch/app-structure/spec.md`, "Features", "Web layout" and "Recipes (the second feature)".

**Blocked by:** 12, 14

**Status:** ready-for-agent

- [x] `features/recipes/` holds the recipe page, cooking mode, the editor and the shared recipe page as screens. Their components are grouped by area, each area with an `index.ts`, and the feature holds the hooks and the store only it uses, the shared recipe page's store among them. The feature has no `index.ts`, since no other feature opens a recipes panel.
- [x] The read-only pieces move in: ingredients, steps, sections, nutrition, the mobile header, cooking time, source, the amount toggle, the page tint, both smart instructions and the recipe skeleton.
- [x] What the Library or settings also render goes to the shared folders, the origin flag and the share status chip among them. The heart, the delete modal, the double-tap container and the swipeable row stay in the shared folders. `MiniCookbooks` and `MiniCalendar` stay where they are until library and calendar move.
- [x] The recipe, editor and share routes render a screen from the feature, and the offline page hands its bootstrap the recipe screen, as it does groceries'.
- [x] Recipes' unit tests move into `features/recipes/__tests__/`.
- [x] CONTRIBUTING's feature list and the Architecture page name `library` with the cookbook page and `recipes` with the shared recipe page, and drop `cookbooks` and `share`. shared-react's `recipes` line names the two features that import it.
- [x] Gates green: `pnpm lint`, `pnpm typecheck`, `pnpm test:run`, `pnpm i18n:check`, `pnpm build`, `pnpm deps:cycles`.
- [ ] The whole E2E suite (`ai`, `offline`, `realtime`) passes once, after this ticket. A test that only passes on re-run is a bug to fix.
