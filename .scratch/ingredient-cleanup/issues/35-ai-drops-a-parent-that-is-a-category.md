# 35: AI drops a parent that is a category

**What to build:** Found by ticket 31. With AI on, the pass dropped 12 parents as sure changes (ticket 23). Half look wrong: "chinese 5 spice" from spice, "Cajun seasoning" from mixed spices, "ranch seasoning" from mixed condiments, "harissa kruiden" and "bagel everything kruiden" from herb, and "adobo sauce" from sauce (6). The others look right ("Klop-Fix" from fish, "bone-in short ribs" from bone, "nut butter" from butter, and 3 more). The cause: ticket 27's prompt said `parent` is never a category, so AI answered null for a blend whose right parent in the catalogue is a category food, and null drops the parent.

**Fix (Mike, 2026-10-22):** "leave out the category it's that simple if our catalogue contains the category we can file it under a category and perhaps we can even extend the schema for the AI to return a category as a last fallback to match a product under."

- The prompt drops the "never a category" rule. `parent` stays the plain base food a shopper buys (whey, herbs, onion), null when none.
- Each food in AI's answer gets `category` (nullable): the general group it belongs under ("spice", "herbs", "sauce", "mixed spices", "dog food").
- The parent is looked up first; where it is null or not found, the category is looked up the same way. Found: filed under it, sure or unsure as a parent is. Neither found: the parent is dropped, as before.

**Blocked by:** None

**Status:** done

- [x] "chinese 5 spice" (parent null, category spice) keeps spice; "Cajun seasoning" (category mixed spices) is filed under mixed spices.
- [x] "Klop-Fix" (parent null, a category the catalogue lacks) still loses its parent.
- [ ] Checked against the real model on the production copy (left to the measurement rerun).

## Implemented (2026-10-22)

- Schema `readingSchema` (`packages/shared-server/src/ai/resolution/ingredient-resolution.ts`): each food has `category: string | null` beside `parent`, required and nullable (OpenAI strict mode). `asReading()` trims it like `parent`; no new shape check. `ReadFood.category`, and `ReviewTrace.category` (`packages/shared/src/contracts/ingredient-catalogue.ts`, `noTrace()` sets null).
- Lookup in `readThenLookUp`: one loop over `[food.parent, food.category]` through `findNamed` (exact/name first, slips asked, hidden foods never targets); the first that finds a food is the parent, its sureness as before. Neither finding one leaves `kindOf` null, so ticket 23's drop is unchanged.
- Prompt `ingredient-resolution.txt`: `parent` keeps its examples without the category ban; a new `category` entry; a shown parent ("Filed under") is given back as `parent` or `category` when right.
- Tests (`review.test.ts`, "a food whose parent is a category"): spice kept with no change listed, Cajun seasoning under mixed spices when the named parent "Cajun spice" is missing, a Klop-Fix food under fish dropped when the category is missing. The first two were red first. The `under(parent, text)` helper moved up to the suite's scope. Test helper `foodReading({ ..., category? })` defaults to null; the two E2E stubs in `ingredient-catalogue.e2e.ts` carry `category: null`.
- Docs: the 0.26 release-notes line on the plain-food parent names blends under their group; the upgrade note on the Ingredient resolution prompt names `category`; the Ingredients page's "files it under a parent" bullet.
- Results: shared-server suite 1195/1195, queue ingredient-review tests, repo typecheck, lint (shared, shared-server, web), `pnpm i18n:check`, and the `ai` E2E spec (13/13) green.

**Open, for Mike:** a category AI names that the catalogue only has as a slip goes to the second question, as a parent does (one more request per such food). A category is only used where the parent is not found, so a wrong plain parent still wins over a right category.
