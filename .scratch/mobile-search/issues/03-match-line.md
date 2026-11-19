# 03: Why a result matched

**What to build:** Each search result says why it matched (board SrResults). The server reports the strongest match within the Search Scope, ordered title > tag > ingredient > description > step, with the matched text; the card shows it in place of its description while searching.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Server: `library.list` results carry `{ field, text }` when there is search text: title → no text; tag → the tag; ingredient → the line as written; description/step → a short snippet around the first hit (step with its number). Only fields in the Search Scope count. `recipeSearchSql` (`packages/db/src/repositories/recipes.ts:402-468`) computes the vector at query time; derive the match from the same terms rather than a second matcher.
- [ ] Repository tests for each field, scope respected, and no match data without text.
- [ ] Mobile: the line reads "In the title", "Tag: …", "Ingredient: …", "Step 3: …" or the snippet, with the hit highlighted (i18n); without search text the card shows its description as on the Recipes tab.
- [ ] Gates green.

## Comments
