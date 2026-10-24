# 37: A category finds a placeholder food

**What to build:** Found by ticket 31's rerun (2026-10-22, HEAD 095149606). With AI on, the pass filed 1 food as a sure parent under an own food that is no food at all: its 2 recipe lines leave the choice to the cook, and AI read it as a food whose category is its own name. Ticket 31's run had deleted that own food as not a food; this run kept it, so ticket 35's category lookup ("the category is looked up the same way") found it for the other food's category.

- On the production copy: 1 food filed under it, sure; the placeholder food kept, 2 lines.
- To decide: whether a category may land on an own food (not seeded), or only on a seeded one; and whether a food AI reads with its own name as category is a placeholder.

**Blocked by:** None

**Status:** done

- [x] A food is not filed under an own food whose lines name no particular food.

## Implemented (2026-10-22)

- Mike's call: a category only lands on a seeded food (`off_id is not null`); an own food is never a category. The parent keeps today's lookup (listed foods, own ones included).
- `findNamed` (`ingredient-resolution.ts`) takes `{ seeded }`; the category branch of `readThenLookUp` passes `true`, and the one listed-ids query becomes `findSeededIngredientIds` (new, `packages/db/src/repositories/ingredient-aliases.ts`) instead of `findListedIngredientIds`. A seeded food is always listed, so it is still one query.
- Not decided: whether a food AI reads with its own name as category is a placeholder. Nothing reads it so; the own "toppings" food stays as it is.
- Tests (`review.test.ts`, "a food whose parent is a category"): "never files it under an own food the category names, a placeholder whose lines leave the choice to the cook" (red first). The Cajun seasoning test now seeds "mixed spices" instead of keeping an own one.
- Docs: the 0.26 release notes ("filed under its group where the catalogue has one") still hold; unchanged.
