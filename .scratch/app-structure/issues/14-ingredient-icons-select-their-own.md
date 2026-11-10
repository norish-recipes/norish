# 14: Ingredient icons select their own

**What to build:** Each Ingredient Icon reads its own food's icon from the Query cache instead of the surface's context, so a food joining a list renders that food's icon only, not every icon on the screen (all 41 on groceries for an add, 07's leftover). A surface still reads its foods' icons in one query, as today. The answer still survives Offline, and the previous icons stay on screen while a changed set is read. Whether the reader hid Ingredient Icons comes from the Device Preference, which each icon selects itself. `IngredientIconsProvider` goes from everywhere that mounts it. Nothing visible changes. See `.scratch/app-structure/spec.md`, "Recipes (the second feature)".

**Blocked by:** None (groceries has landed)

**Status:** ready-for-agent

- [ ] The icons context is deleted. Every surface reads its foods' icons in one query through a plain hook: a recipe's lines, the editor, the shared recipe page, the grocery lists, By Recipe, the Pantry, From your recipes, `MiniGroceries` and the ingredient settings. Each icon subscribes to its own address in the cache, so an unchanged address renders nothing.
- [ ] An icon given its address outright, as on the shared recipe page, needs no read.
- [ ] Each icon, and the panel field and settings row that ask whether icons are hidden, select that Device Preference themselves.
- [ ] A line whose food's read is still on its way holds its empty slot, and a food with no icon shows nothing, as today.
- [ ] A full load's seeded icons still paint in the first frame.
- [ ] A unit test adds a food to a surface: the new food's icon appears, and the icons already shown don't render again.
- [ ] Gates green: `pnpm lint`, `pnpm typecheck`, `pnpm test:run`, `pnpm i18n:check`, `pnpm build`, `pnpm deps:cycles`.
