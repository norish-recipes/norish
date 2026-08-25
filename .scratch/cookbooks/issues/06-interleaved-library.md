# 06 — One interleaved Library

**What to build:** Under the All chip, cookbooks and recipes stop being two things and become one list — interleaved, ordered by whatever sort the reader already chose, and paged as a single list rather than two (ADR-0026). Searching finds cookbooks by title, and a matching cookbook is shown ahead of the matching recipes. Filters that only mean something for a recipe simply show recipes.

This is where the whole feature first exists end to end, so it carries the browser E2E coverage.

**Blocked by:** 05 — the union's cookbook projection carries the member count.

**Status:** ready-for-agent

- [ ] All shows both kinds in one list ordered by the active sort, with every sort mode applying to both
- [ ] Paging through the mixed list produces no gaps and no repeated entries
- [ ] A new repository entry point serves the mixed list; the existing recipe list entry point is unchanged, so the mobile app's caller is untouched
- [ ] Searching matches a cookbook on its title alone, and matching cookbooks are ordered ahead of the relevance-ranked recipes
- [ ] Removing Title from the search fields removes cookbooks from search results entirely
- [ ] An active rating, cooking time, category, tag or favourites filter restricts results to recipes
- [ ] The cookbook card's height matches the recipe card's in both grid and list, so the virtualizer's row estimates stay accurate on mixed pages
- [ ] Nothing treats the list's total as a recipe count
- [ ] Database seam tests cover all four sort modes, paging across the union, the search pinning, the type filter and the recipe-only filter behaviour
- [ ] Browser E2E in the production-like browser project covers: switching chips changes the list and the heading; a cookbook and a recipe appear interleaved; creating a cookbook from the Library; filing a recipe from its quick actions and seeing it on the recipe page card; removing it from the same panel; opening the cookbook page and finding the member; and renaming then deleting a cookbook without disturbing its recipes
