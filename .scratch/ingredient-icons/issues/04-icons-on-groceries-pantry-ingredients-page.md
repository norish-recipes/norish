# 04: Icons on groceries, recurring groceries, the Pantry and the Ingredients page

**What to build:** Every list row that names a food shows its Ingredient Icon:

- groceries, including ones typed by hand, once Norish knows the food;
- recurring groceries;
- the Pantry;
- the Ingredients page's rows.

Icons a person has seen before still show offline. See `.scratch/ingredient-icons/spec.md`.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Each surface collects the food ids it shows and reads the icons query once, not once per row.
- [ ] The recurring groceries DTO gains its `ingredientId`.
- [ ] A grocery whose food the server hasn't resolved yet (offline-added) shows the placeholder, then its icon once resolved.
- [ ] The icons query is persisted with the rest of the query cache, and icon images go through the service worker's existing cache-first image cache, so a list opened offline shows the icons it has shown before.
- [ ] Rows keep their alignment with or without an icon.
- [ ] Tests: the grocery, Pantry and Ingredients-row components render the icon or the placeholder from the map, following their existing component tests.
