# 03: Prefactor: a recipe line's foods are a list

**What to build:** "Make the change easy" for ticket 04, with no visible change. A recipe line's food moves out of its single alias column into a child table of its own. The table has one row per food, in order, each pointing at an Ingredient Alias. The line gains an empty "joined" field (`together` / `alternatives`, unused until 04). The single column is dropped in the same migration, with no fallback, and every line moves its alias into position 0.

Every reader of a line's food reads the first in order:
- nutrition;
- pantry coverage and the add-to-groceries panel;
- icons;
- the "where used" panel and in-use counts;
- merges and spelling moves;
- deletes;
- the stale-reference retry;
- Recipe Archive export and import;
- offline and realtime payloads.

Deleting a food deletes its aliases' rows, so its lines name no food. Groceries, recurring groceries and Pantry Ingredients keep their single columns.

**Also, the one visible change (Mike, 2026-10-18): removing a spelling keeps the food.** Today, removing a spelling (the ✕ in the Ingredient panel) leaves what wrote it with no food. Instead, its line food rows, Groceries, recurring groceries and Pantry Ingredients move to another spelling of the same food: the one whose fold is the food's name, else the oldest. Nothing loses its food, and nothing moves to a parent. A wrong translation ("deegroller" under dough) is fixed with Move, which carries its lines to the right food. Lines keep pointing at a spelling only, with no food column beside it: a single pointer can't disagree with itself, and a merge's Undo needs to know which lines wrote which spelling. Update `CONTEXT.md` (Ingredient Alias), ADR-0037's second 2026-10-17 amendment and the spec's "Catalogue edits" to match.

See ADR-0037's third 2026-10-17 amendment.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] The migration moves every line's alias into the child table at position 0 and drops the old column. Lines with no food (headings) get no row.
- [x] Recipe pages, nutrition, pantry coverage, add to groceries, icons and the "where used" panel behave exactly as before. The existing tests pass unchanged, apart from fixtures that build lines.
- [x] A merge and a spelling move carry line foods with them. Deleting a food leaves its lines with no food.
- [x] Removing a spelling that a line, a Grocery, a recurring grocery and a Pantry Ingredient use leaves each on the same food, under the spelling that is the food's name (else the oldest). Their text is unchanged.
- [ ] A Recipe Archive round trip keeps every line's food. Moved to ticket 10.
- [x] A database repository test covers the child table's ordering and its cascade when a food is deleted.
- [x] All `CONTRIBUTING.md` gates pass, and the E2E suites stay green.

## Comments

2026-10-18, implemented:

- A line's foods are `recipe_ingredient_foods` (line, position, alias), migration 0077. `joined` is added, unused, and kept off the client schemas.
- A reader of "the line's food" reads the lowest position through `isFirstLineFood(foods)`. It names its outer table, so an aliased join cannot rebind it. The where-used panel, the in-use counts, the sweep and the seed's dropped-food check match a food at any position, ticket 04's rule (Mike, 2026-10-18).
- Both line writers insert through `insertRecipeLinesTx`, which makes the ids and writes the foods.
- Removing a food's last spelling is refused in the repository as well as in the catalogue.
- The archive keeps a line's food only while its text still resolves to it; a line a removed spelling moved imports as a new food with AI off. That is ticket 10 (Mike, 2026-10-18).
- The `packages/db` tests now run in `pnpm test:run`. A Library sort test that compared this machine's clock with the database's was fixed on the way.
