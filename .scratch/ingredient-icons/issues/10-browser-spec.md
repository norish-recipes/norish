# 10: Browser spec

**What to build:** One browser spec in the `ai` project that proves the Ingredient Icon workflows in a real browser, using the fake image provider's image lane. See `.scratch/ingredient-icons/spec.md`.

**Blocked by:** 03, 04, 05, 07

**Status:** done, pending review

- [x] An icon uploaded in the Ingredient panel shows on a recipe line and on the grocery list after Save, not before.
- [x] A child with no icon shows its parent's.
- [x] Generate puts the fake provider's picture in the draft, and it shows on the recipe only after Save.
- [x] Hiding "Ingredient icons" removes the icons from the recipe page.
- [x] A Draw icons round on "Only foods with no icon at all" fills a bare food.
- [x] It follows the image-generation and ingredient-catalogue specs' patterns, including their shared-database traps. The catalogue seed stays blank in the harness.

## Comments

2026-10-06 (implementation): `apps/web/__tests__/e2e/ai/ingredient-icons.e2e.ts`, five scenarios, green on the first run (15 s) against a fresh build. The upload goes through the panel's file input directly rather than the native file chooser; the Hidden Item is set by its cookie, as the recipe-mobile-layout spec does. The scenario resets recipes, groceries and Ingredients first and turns the image provider off before and after, like the image-generation spec.
