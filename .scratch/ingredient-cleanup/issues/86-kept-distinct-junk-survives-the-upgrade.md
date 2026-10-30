# 86: Kept-distinct junk survives the upgrade

**What to build:** Ticket 85's check on the 0.25 production copy left foods Mike had kept distinct in 0.25 although they name no food or read as another food: "melted", "chopped", "overnight", "deegroller", "Keukenmachine", "Bakvorm", "Cakevorm", "INGREDIËNTEN", "kippenbouillon met laag zoutgehalte". The cleanup treated kept distinct and a chosen name as decisions, the junk pile was seeded only after the cleanup, and a line reading none kept its food.

**Blocked by:** 85

**Status:** done

## Decided (Mike, 2026-10-27)

"also remove those, we just don't reparent I think thats fair". Grocery-only and unused household purchases stay hidden, as they are.

## Implemented (2026-10-27)

- `listSpellingsForCleanup` gives `cleanable` (own, no chosen parent) in place of `undecided`: kept distinct and a chosen name no longer keep a note food from merging.
- `resolveAgain`'s `refine` takes the food from a line that now names none when that food is an own one; a seeded food stays (its spelling is AI's spelling check's).
- Step 10 `deleteUnnamedOwnFoods`: own foods the lines named before the re-read, or whose every spelling is on the junk pile, go where nothing names them and they are no one's parent. Other unused own foods keep the sweep's 90 days.
- `spellingNamesNoFood`: a text whose words before its note are on the junk pile names no food ("Bakvorm met opstaande randen of een braadslede").
- `apps/web/server/index.ts` seeds the junk pile before the cleanup.
- `CLEANUP_VERSION` 9.
- Tests: `first-start-cleanup.test.ts` (kept-distinct note food merges; a parent a person chose since 0.25 holds; "melted", "Bakvorm" and an unused "chopped" go).
- On the production copy (`m85d_upgrade`): 9 foods deleted; of the kept-distinct junk only "toppings" was left (ticket 87). Kept-distinct household purchases are grocery-only (4) or named by nothing (37): hidden either way.
