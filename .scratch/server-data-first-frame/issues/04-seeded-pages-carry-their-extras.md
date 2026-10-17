# 04: Seeded pages carry their extras

**What to build:** The pages already seeded stop shifting after load.

- Groceries and the Pantry (`app/(app)/groceries/layout.tsx`): also `stores.groceryPrices`, `stores.aisleLinks` and `pantry.suggestions`, which take no input and are read below the boundary.
- The recipe page (`app/(app)/recipes/[id]/layout.tsx`): also `ratings.getAverage` and `ratings.getUserRating` for the recipe, and `cookbooks.forRecipe` only when the reader's Device Preferences show the cookbooks card. Hearts come with 03.

**Blocked by:** 01.

**Status:** done

- [x] `first-paint.e2e.ts`: the server's markup has a grocery's price and its aisle heading, and a recipe's rating.
- [x] 01's harness: before and after for `/groceries`, `/groceries/pantry` and a recipe, with the document size.

## Comments

- 2026-10-16, **measured** (service worker blocked, median and spread of 15, ms; before is the build with 03, just before this change):

  | Page                | Mark                | Before               | After         | Document (KB gzip) |
  | ------------------- | ------------------- | -------------------- | ------------- | ------------------ |
  | recipe              | rating              | 7,456 (7,416–8,455)  | 672 (640–1,027) | 40.0 → 41.3      |
  | `/groceries`        | a price, an aisle   | 6,990 (6,888–7,110)  | 580 (576–592) | 32.2 → 36.8        |
  | `/groceries/pantry` | From your recipes   | 6,889 (6,803–7,867)  | 560 (556–588) | 30.7 → 35.0        |

  First paint didn't move (recipe 644 → 664, groceries 656 → 580, Pantry 556 → 560). The in-app tap to a recipe: 1,209 (1,190–1,306), against 1,223 at baseline. `cookbooks.forRecipe` is read only where the reader shows the cookbooks card.
