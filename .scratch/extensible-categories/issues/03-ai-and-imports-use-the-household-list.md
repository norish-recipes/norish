# 03: AI and imports pick from the household's list

**What to build:** A household with a Drinks Category imports a cocktail URL, and the recipe lands as Drinks. Auto-categorising a margarita also lands Drinks. A Mealie export whose categories are "Drinks" and "Holiday" gives Drinks as a Category and Holiday as a Tag. Neither AI nor an import ever creates a Category. See `.scratch/extensible-categories/spec.md`, "AI" and "Imports".

**Blocked by:** 01

**Status:** done

- [x] `auto-categorizer.ts` takes the recipe owner's household list. It builds the Decision Model's yes/no questions from that list at runtime and uses `z.enum(list)` for the language model fallback. `CATEGORIES` and `CATEGORY_QUESTIONS` go, and `system-messages.ts:19` stops naming the four.
- [x] URL extraction appends the household's list as a prompt section (ADR-0016) in place of the four in `extraction.schema.ts:98-101`.
- [x] One import rule through the shared matcher (`category-matcher.ts`): match the importing household's Categories (exact, case-insensitive), then a built-in through the full matcher (synonyms and fuzzy), and anything else becomes a Tag. The household rung goes first so "Dessert" lands on a household's Dessert Category rather than Snack. Apply it in Paprika, Tandoor, Recipe Keeper, Mealie, Mela, JSON-LD `parseCategories`, the Python adapter's map and paste import, deleting their own map tables.
- [x] Tests: the categoriser offers a household Category and never returns a name outside the list. Each importer's existing category test gains a household-Category case and an unmatched-becomes-Tag case.
