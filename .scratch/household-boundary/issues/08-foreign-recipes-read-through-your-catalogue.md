# 08: Another household's recipe reads through your catalogue

**What to build:** At view Everyone, a reader can use another household's recipe. Its lines are then read through the reader's own catalogue:

- adding it to groceries resolves each line's text in the reader's household;
- the Pantry covers it by the reader's foods;
- the nutrition worked out for the reader's household uses the reader's foods and corrections.

The recipe itself is never changed. See the spec, "Ingredient catalogue".

**Blocked by:** 07

**Status:** ready-for-agent

- [ ] **Recipe to groceries:** the add-to-groceries path for a recipe outside the reader's household resolves each line's text through the reader's household's resolver, instead of copying the line's food.
- [ ] **Pantry coverage** of a foreign recipe's lines resolves them in the reader's household before matching.
- [ ] **Ingredient Nutrition** for a foreign recipe is computed per line from the reader household's resolution. The recipe's own Nutrition Information still takes precedence (`packages/db/src/repositories/ingredient-nutrition.ts`).
- [ ] **Display:** a foreign recipe's lines still show its own foods and icons. Only _using_ the recipe reads through your catalogue.
- [ ] **Tests:** B adds A's recipe to groceries and gets B's foods (seed foods shared, A's own foods resolved again or minted in B). B's pantry covers A's "ui" line with B's "ui". E2E.
