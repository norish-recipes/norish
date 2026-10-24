# 50: AI merges a brand product into its general food

**What to build:** Found by ticket 31's run after tickets 32-48 (2026-10-22, HEAD fa3fb4295, `m48_post_on`). Ticket 40 let AI read the own foods whose parent was confirmed in 0.25, and many of those are brand products filed under their general food. AI now reads such a product as the general food itself (English name "cream cheese", "hot sauce") and the pass merges it into that food. In the last run they stayed own foods under it, which the audit counted as filed fine.

- On the production copy: 9 brand products merged into the general food, 6 sure and 3 unsure (about 10 recipe lines). The product's name becomes a spelling of the general food, so it shows as a translation.
- Also doubtful, same shape without a brand: 6 more specific foods merged into the general one (baby potatoes into potato, pumpkin puree into pumpkin, italian sausage into sausage).
- Mike's call: is a brand product its general food (merge is right), or its own food under it (AI should answer "parent", and a merge needs the same product)?

**Blocked by:** None

**Status:** done

## Brand half: decided (Mike, 2026-10-22)

A brand product is its general food, so the merge is right. Nothing to build for the brands. AI gives the general name as the English name ("Monchou roomkaas" is "cream cheese", "Franks Hot Sauce" is "hot sauce"), and that name finds the food.

## Specific foods: findings (2026-10-22)

"First find out before anything is built." Taken from `m48_post_on`, `norish_prod_pristine` and `server-48.log`. The run notes named 3 of the 6; the other 3 here are the merges into the food's own 0.25 parent that are a narrower food, not a brand or a form. Fat-free greek yogurt and red pepper flakes are added because they merged the same way.

| Food → merged into                                     | AI's reading (all sure, category none)                                                                               | What found the target                                                                                                  | Cause               | Lines |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------- | ----: |
| baby potatoes → potato                                 | "baby potatoes", parent potato, other names "mini potatoes", "petite potatoes"                                       | the other name "petite potatoes" read as "potatoes" ("petite" is a French size word), a seeded spelling of potato      | b                   |    13 |
| mini-krieltjes → potato                                | "baby potatoes", parent potato, other names "small potatoes", "petite potatoes"                                      | the other name "small potatoes" read as "potatoes" ("small" is a size word)                                            | b                   |     1 |
| canned petite diced tomatoes → tomato                  | itself, parent tomato, other names "canned diced tomatoes", "petite diced tomatoes"                                  | the other name "petite diced tomatoes" read as "tomatoes" (size "petite", preparation "diced")                         | b                   |     3 |
| deli ham → ham                                         | itself, parent ham, other names "sliced ham", "lunch meat ham"                                                       | the other name "sliced ham" read as "ham" (preparation "sliced")                                                       | b                   |     1 |
| pumpkin puree → pumpkin                                | itself, parent pumpkin, other names "pumpkin purée", "pureed pumpkin"                                                | "pureed pumpkin", an own spelling pumpkin already held in 0.25                                                         | c (own spelling)    |     5 |
| italian sausage → sausage                              | "Italian sausage", parent sausage, other names "Italian-style sausage", "salsiccia"                                  | "salsiccia", sausage's seeded Italian spelling                                                                         | c (seeded spelling) |     1 |
| fat free plain greek yogurt → greek yogurt             | "fat-free plain Greek yogurt", parent Greek yogurt, other names "nonfat plain Greek yogurt", "fat-free Greek yogurt" | "fat-free Greek yogurt", an own spelling greek yogurt already held in 0.25                                             | c (own spelling)    |     4 |
| red pepper flakes → red bell pepper (a different food) | itself, parent chili pepper, other names "crushed red pepper", "red chili flakes"                                    | the other name "crushed red pepper" read as "red pepper" (preparation "crushed"), a seeded spelling of red bell pepper | b                   |     7 |

- **Not (a).** AI read every one correctly: the English name is the specific food (the food's own name, which the lookup skips), and the parent is the general food. The merge comes only from an **other name**, so this is ticket 39's shape (other names are taken exactly, no second question). Ticket 32's name-first lookup found none of them, and no slip was involved.
- **No second question ran** for any of them. No Decision or language-model pick names these foods in the log. Each found one food exactly, and `findNamed` asks only when it finds several exact foods or only slips. Sure = reading sure and an exact find. `review.ts` turns `same` into `mergeByAI`. The spelling check later kept the moved spellings on potato, pumpkin and greek yogurt (`this-food`).
- **Root cause 1 (b), 5 of 8:** `findNamed` looks AI's other names up through rungs 1-2 (`findOtherFoodsNamed` → `matchKnown`: fold, then bare, then plain fold). The plain fold drops size and preparation words, and the size words are pooled across all languages (French "petite" strips English "petite potatoes"). So a specific other name becomes the general food's own seeded spelling. Ticket 20's forms list does not do this ("puree" is not a form).
- **Root cause 2 (c), 3 of 8:** the general food already holds a spelling of the specific food. Two are own spellings from 0.25 recipe lines ("pureed pumpkin" on pumpkin, "fat free greek yogurt" on greek yogurt). One is a seeded foreign word ("salsiccia" on sausage). AI lists that spelling as an other name, and it matches exactly.
- Open for Mike: is a more specific food (baby potatoes, pumpkin puree, italian sausage) its general food like a brand, or its own food under it? If it is its own food, the narrowest fix for root cause 1 looks other names up by their full spelling only (fold and bare, no plain fold). That leaves root cause 2, the general food holding the specific spelling, which belongs with ticket 52.

## Implemented (2026-10-22)

Mike's decisions: a brand is its general food (no code, see above); a more specific food is its own food, so AI's names are looked up as written.

- `findOtherFoodsNamed` (`packages/shared-server/src/ingredients/resolver.ts`) takes `asWritten`: each text is read by `asWritten(spelling)`, whose plain fold is the bare fold (else the fold), so `matchKnown` finds a food by the fold, the fold without what follows a comma or sits in brackets, and plurals or diminutives of that whole spelling; never the plain fold with sizes and preparation words stripped. Slips are measured from the same whole spelling (`findSlips` reads the plain fold, so "petite potatoes" can no longer be a zero-letter "slip" of "potatoes"). Ticket 32's name-first lookup is unchanged.
- `findNamed` (`ai/resolution/ingredient-resolution.ts`) passes `asWritten: true`, so every AI name gets it: English name, other names, parent, category, split parts, and the spelling check's other food (`findFoodNamed`). The recheck of undecided mints (`recheck-mints.ts`) and the import (`resolveTexts`) keep the plain fold, so no `RUNG_VERSION` bump.
- Kept, as not word-stripping: plurals of the whole spelling ("tomato, chopped" still finds "tomatoes"; the existing test "looks the reading up as an import does: plurals, preparation and slips" holds).
- Prompt (`ingredient-resolution.txt`): the two lines as Mike wrote them; "Unox Knaks" stays on parent only, "koud water" left the English-name examples with the old bullet. `new-prompt-defaults.test.ts` checks both lines. Upgrade note on the Ingredient resolution prompt, a release-notes line under Fixes, an ADR-0037 amendment, CONTEXT.md's Alias entry.
- Tests (`review.test.ts` "AI's names, looked up as written"; 4 red first, the sausage one green before and after): baby potatoes stays under potato; mini-krieltjes merges into the own food baby potatoes in one request; red pepper flakes goes under chili pepper, not into red bell pepper; deli ham stays under ham; italian sausage still merges into sausage by "salsiccia".
- Ticket 49 closed by this: its red pepper flakes merge came from "crushed red pepper" read as "red pepper" (cause 1 here).

**Left, for Mike.**

- Root cause 2 (c) is untouched: a general food that already holds the specific food's spelling ("pureed pumpkin" on pumpkin, "fat free greek yogurt" on greek yogurt, "salsiccia" on sausage) still takes the merge. That is ticket 52's.
- The structured-output schema still describes `englishName` as "Its plain English name, as a shopper would look for it." (`readFoodSchema` in `ingredient-resolution.ts`), which the model also sees. Not changed, since the decision named the two prompt lines only; say if it should match the new bullet.
