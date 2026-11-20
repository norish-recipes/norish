# 03: Why a result matched

**What to build:** Each search result says why it matched (board SrResults). The server reports the strongest match within the Search Scope, ordered title > tag > ingredient > description > step, with the matched text; the card shows it in place of its description while searching.

**Blocked by:** 02

**Status:** done

- [x] Server: `library.list` results carry `{ field, text }` when there is search text: title → no text; tag → the tag; ingredient → the line as written; description/step → a short snippet around the first hit (step with its number). Only fields in the Search Scope count. `recipeSearchSql` (`packages/db/src/repositories/recipes.ts:402-468`) computes the vector at query time; derive the match from the same terms rather than a second matcher.
- [x] Repository tests for each field, scope respected, and no match data without text.
- [x] Mobile: the line reads "In the title", "Tag: …", "Ingredient: …", "Step 3: …" or the snippet, with the hit highlighted (i18n); without search text the card shows its description as on the Recipes tab.
- [x] Gates green.

## Comments

Implementation (2026-11-19):
- Derived by `recipeSearchMatches` (`recipes.ts`): the same sanitised prefix-OR tsquery as `recipeSearchSql` (one shared `searchTsqueryTerms`), tested per tag, line and step; an OR query agrees with the field's concatenated vector. Snippets are one `ts_headline` fragment (6-14 words, markers stripped).
- Computed only for the returned page and only with a new `withMatch` request flag, which only mobile Search sends (`useLibraryList({ withMatch })`), so web's query and cost are unchanged.
- Shape: recipe items carry `match?: { field: "title"|"tags"|"ingredients"|"description"|"steps", text?, step? }`; `step` is the 1-based number, `text` for an ingredient is its `name` (the column the vector reads), title has neither.
- Mobile: wording and highlighting are `features/recipes/utils/match-line.ts` (prefix-of-word, case/accent-insensitive; stemmed hits stay unhighlighted); `RecipeCard` takes `match` + `search`, the Recipes tab passes neither. Keys `recipes.search.match{Title,Tag,Ingredient,Step}` in all 18 locales. Grid cards show the line too; not seen on device.

Review (2026-11-20), range `b975f76cf..291b20f48`, two review rounds:
- fixed, round 1 (`352a93856..cc1069e17`): the step number follows the recipe page (one system, headings take no number); the ingredient match is the line as written, formatted by the page's formatter; every returned recipe carries a match (an OR form of the same terms locates the row when a phrase query matches no single row); snippets go through `plainText`; the match is a discriminated union with structured SQL columns; one term splitter and diacritic fold in `packages/shared`; `match` and `search` travel as one value; comments.
- fixed, round 2 (`84cc1dd79..291b20f48`): the highlighter looped forever on a term folding to nothing (`basil ^`); a heading-only ingredient hit is reported as the heading; a NULL step order sorts as 0 and one heading rule (`heading-line.ts`) serves SQL and the page; the OR fallback's hit is highlighted (`searchWords`); a cut snippet drops unpaired markdown (`snippetText`).
- rejected: "the snippet is the best-covering fragment, not the first hit" (it explains the match better); "title highlight on the result card" (the SrResults board draws it).
- not done: the match line has not been seen on a device; ticket 05's device pass covers it.
