# 11: Names in the viewer's language

**What to build:** Surfaces that show an Ingredient rather than a line (the Ingredients page, the Pantry and ingredient search) show the alias in the viewer's locale, falling back to the canonical name. A Dutch user sees "ui" where an English user sees "onion". Recipe lines and grocery lines always keep their as-written text. Search finds an Ingredient by any of its aliases in any language.

**Blocked by:** 07, 10

**Status:** done

- [x] Choosing a display name is tested for: locale present, locale missing (canonical fallback), and several aliases in one locale (chosen deterministically).
- [x] The Pantry and the Ingredients page render the locale name. Recipe and grocery lines are unchanged.
- [x] Search matches aliases in every language.

## Comments

- The viewer's locale lives in a browser cookie, not on the server, so the server sends each Ingredient's best spelling per catalogue language (`localeNames`, on the Pantry DTO and the Ingredients page's list items) and the browser picks the viewer's (`ingredientDisplayName`, `@norish/shared/lib/ingredient-names`). Only the languages some Norish locale reads are sent. `de-formal`/`de-informal` read `de`, `pt-BR` reads `pt`, `no` reads `nb`, then `no`, then `nn`.
- "Chosen deterministically": the catalogue's own spellings before a person's, then the shortest (the taxonomy lists the plain word before plurals and variants), then alphabetical. No rank column: every seeded alias of a file is inserted in one transaction, so `created_at` cannot order them.
- The Pantry sorts by the name the viewer sees, and its "already in the Pantry" check matches a typed name against the Ingredient's names in every language.
- The Ingredients page shows the viewer's name with the Ingredient's own name beside it when they differ (rename edits the own name). A seeded food has dozens of spellings, so a row shows the viewer's-language, language-free and person-added ones, and "Show all N spellings" shows the rest. The list is still ordered by the Ingredient's own name.
- Search already matched every alias in every language (07); a test now pins it against the seed.
