# 10: Browser spec

**What to build:** One browser spec in the `ai` project that proves the Ingredient Icon workflows in a real browser, using the fake image provider's image lane. See `.scratch/ingredient-icons/spec.md`.

**Blocked by:** 03, 04, 05, 07

**Status:** ready-for-agent

- [ ] An icon uploaded in the Ingredient panel shows on a recipe line and on the grocery list after Save, not before.
- [ ] A child with no icon shows its parent's.
- [ ] Generate puts the fake provider's picture in the draft, and it shows on the recipe only after Save.
- [ ] Hiding "Ingredient icons" removes the icons from the recipe page.
- [ ] A Draw icons round on "Only foods with no icon at all" fills a bare food.
- [ ] It follows the image-generation and ingredient-catalogue specs' patterns, including their shared-database traps. The catalogue seed stays blank in the harness.
