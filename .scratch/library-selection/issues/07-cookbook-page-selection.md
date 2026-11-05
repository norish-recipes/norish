# 07: Selecting on the cookbook page

**What to build:** the same selection and action bar on the cookbook page, which shares the Library's grid and recipe card. The bar offers:
- **Remove from cookbook**, through the bulk remove. Removing the last recipes leaves the cookbook in place;
- **Add to cookbook**, to copy recipes into other cookbooks;
- **Delete**, which deletes for good, same as in the Library.

Entry, exit and modifier behaviour are the same as in the Library.

See `.scratch/library-selection/spec.md`.

**Blocked by:** 02, 04, 06.

**Status:** ready-for-agent

- [ ] E2E: select several members on the cookbook page and remove them; they stay in the Library and the cookbook remains
- [ ] E2E: Add to cookbook and Delete work from the cookbook page
- [ ] Gates green
