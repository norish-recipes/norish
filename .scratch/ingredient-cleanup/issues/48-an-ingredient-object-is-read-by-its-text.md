# 48: An ingredient object in a page's recipe is read by its text

**What to build:** Found while checking the 18 "[object Object]" lines on the copy (2026-10-22, `m31c_post_on`). `normalizeIngredientSource` in `packages/api/src/parser/parsers/ingredients.ts` turns each `recipeIngredient` entry into text with `v.toString()`. A string is fine. An object entry, such as `{ "@type": "HowToSupply", "name": "2 el sojasaus" }` or `{ "text": "1 komkommer" }`, becomes "[object Object]", with no amount and no unit. Every JSON-LD import goes through it (`normalize.ts` → `parseIngredients`). The recipe-scrapers path does not: `collectIngredientStrings` in `python/adapter.ts` keeps strings only.

A scratch check (not committed) confirmed it on today's code: `parseIngredients({ recipeIngredient: [{ "@type": "HowToSupply", name: "2 el sojasaus" }, { text: "1 komkommer" }, "5 bosuitjes"] }, {})` gives the names `["[object Object]", "[object Object]", "bosuitjes"]`.

**Fix:** an object entry is read by its `text`, else its `name`, where that is a string. Any other entry is dropped. One unit test in `packages/api/__tests__/server/parser/parsers/ingredients.test.ts`.

**Not what wrote the 18 old lines.** They are in one AH recipe ("Crispy gyoza's met tuinerwtensalade van Veggilaine", imported 2025-11-01). They keep their amounts and units ("4 el", "270 gram"), and the one with no unit reads "null [object Object]". So their text was put together from amount, unit (null printed as "null") and a name object, before the parser ran. That code predates this repo's first commit (2025-12-03), so no commit fixed it. The same code left six spellings that start with "null" ("null zout" on salt, "null sriracha"). They name the right food and are left alone. AH serves plain strings: archived copies from 2025-07-28 and 2026-05-15 list "4 el zonnebloemolie" … "2 el ongezouten cashewnoten". The live page refuses both curl and Obscura.

**The 18 existing lines:** nothing to do. `lineNamesNoFood` names "[object Object]" no food (22f4526c3), and on the copy none of the 18 has a food. Re-importing the recipe is the person's call; it reads the lines cleanly today.

**Blocked by:** None

**Status:** done

- [x] A JSON-LD `recipeIngredient` entry `{ "@type": "HowToSupply", "name": "2 el sojasaus" }` imports as 2 el "sojasaus", and `{ "text": "1 komkommer" }` as 1 "komkommer".
- [x] An entry with neither field as a string is dropped, never stored as "[object Object]".

## Implemented (2026-10-22)

- `ingredientEntryText` in `packages/api/src/parser/parsers/ingredients.ts`: a string entry as is, an object by its `text`, else its `name`, when that is a string; anything else (numbers, objects without either string) is `""` and dropped by `normalizeIngredientSource`. Commit b71cf929d.
- Test: "reads an object entry by its text, else its name, and drops any other entry" in `packages/api/__tests__/server/parser/parsers/ingredients.test.ts` (2 el sojasaus → "sojasaus", 2, tablespoon).
- Release-notes line under Fixes in `apps/docs/docs/release-notes/0.26.0-beta.md` (8f6c43f67).
- Other coercions on the parser path checked: nutrition `toString()` runs on parsed numbers, steps/videos/jsonld `String()` only read `@type` values. `getName` in `parsers/metadata.ts` does `String(raw[0])` on an array `name`, the same shape, but a recipe name is not an ingredient and schema.org never gives an object there; left alone.
