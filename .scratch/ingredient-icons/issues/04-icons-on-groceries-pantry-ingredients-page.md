# 04: Icons on groceries, recurring groceries, the Pantry and the Ingredients page

**What to build:** Every list row that names a food shows its Ingredient Icon:

- groceries, including ones typed by hand, once Norish knows the food;
- recurring groceries;
- the Pantry;
- the Ingredients page's rows.

Icons a person has seen before still show offline. See `.scratch/ingredient-icons/spec.md`.

**Blocked by:** 01

**Status:** done, pending gates and review

- [x] Each surface collects the food ids it shows and reads the icons query once, not once per row.
- [x] The recurring groceries DTO gains its `ingredientId`.
- [x] A grocery whose food the server hasn't resolved yet (offline-added) shows the placeholder, then its icon once resolved.
- [x] The icons query is persisted with the rest of the query cache, and icon images go through the service worker's existing cache-first image cache, so a list opened offline shows the icons it has shown before.
- [x] Rows keep their alignment with or without an icon.
- [x] Tests: the grocery, Pantry and Ingredients-row components render the icon or the placeholder from the map, following their existing component tests.

## Comments

2026-10-06 (implementation): each grocery list (by store, grouped, by recipe) and the Pantry wrap their rows in one icons read; a grouped row shows the icon of the first of its groceries that knows its food, and the expanded breakdown under it shows none. The Pantry's catalogue matches and the Ingredients page's rows carry the icon on the list item. Nothing was added for offline: the icons query persists with the rest of the cache and the images go through the service worker's existing cache-first image route.
