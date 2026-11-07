# Households add their own Categories

Status: ready-for-agent

Settled in a `/grill-with-docs` session on 2026-11-06 for [issue #442](https://github.com/norish-recipes/norish/issues/442). The vocabulary is CONTEXT.md's **Category** (added that day), **Tag**, **Cuisine**, **Recipe Archive**, **Supplied Recipe Data** and **Enrichment Validation**. The scope decision is ADR-0040. Target Version: 0.27.0-beta. Tickets are in `issues/`.

## Problem Statement

A recipe can only be Breakfast, Lunch, Dinner or Snack. Households want drinks, desserts, appetizers and side dishes, and have no way to add them. The four are a pg enum, `recipe_category`, and the list is written out again in about 30 places: zod schemas, the recipe form, the filters panel, icons, the AI categoriser, importer synonym tables and i18n.

## Solution

A household names a new Category from the recipe form, just as it types a Tag. From then on the household gets that Category everywhere it picks or filters by one: the form chips, the filters panel, the AI categoriser and imports. Another household never gets it offered, whatever the recipe view policy, but a recipe of theirs that you can see still shows its own Categories.

## Decisions

### The model (ADR-0040)

- `categories` (id, name, createdAt, unique on `lower(name)`) with a `recipe_categories` join, the same shape as `tags`/`recipe_tags`. The `recipe_category` enum and the `recipes.categories` column go. A migration moves every recipe's enum values onto join rows.
- **Built-ins**: Breakfast, Lunch, Dinner and Snack are seeded rows, named in one shared const. They are always offered, translated through the existing `category.<lowercase>` keys, keep their icons, and are never removed by orphan cleanup.
- **A household's list** is the built-ins plus every Category on a recipe owned by the user or their household members (`ctx.userIds`), in a `listCategoryNamesForUsers` beside `listTagNamesForUsers`. Unlike `config.tags`, it never switches to the instance-wide list under the "everyone" view policy or for an admin.
- Added Categories show their name verbatim, untranslated, with one generic icon.
- Orphan cleanup deletes a non-built-in row that no recipe carries, the same way it deletes unused tags.
- **Naming**: trim the name, collapse whitespace, and allow 1–40 characters. A name resolves through the existing category matcher's built-in synonyms first, so "breakfast", "Ontbijt" and "Snacks" become the built-in. After that, a case-insensitive match against existing rows reuses the row, and the first spelling wins instance-wide, as it does for tags.
- Meal plan slots (`slot_type`) are untouched. The random recipe picker's `SLOT_TO_CATEGORY` and the quick-filter presets keep using the built-ins only.

### AI

- The categoriser is given the recipe owner's household list. The Decision Model gets one yes/no question per Category, built at runtime instead of from `CATEGORY_QUESTIONS`. The language model's fallback schema is `z.enum(list)`. AI never creates a Category.
- URL extraction is told the household's list through an appended prompt section (ADR-0016) instead of the four hard-coded in `extraction.schema.ts`. `system-messages.ts` stops naming the four.
- Enrichment Validation and the coordinator's "already has categories" skip are unchanged.

### Imports

- **Other apps' formats** (Paprika, Tandoor, Recipe Keeper, Mealie, Mela, JSON-LD, the Python scraper, paste import, AI URL extraction): a source category name becomes a Category when it matches a built-in or one of the importing household's Categories. Otherwise it becomes a Tag. An import never creates a Category. `parseCategories` and the Python adapter's own map tables are replaced by the shared matcher. Formats that already keep every source name as a Tag keep doing so.
- **A Norish Recipe Archive** carries Categories by name. On import they are created as they are, following the naming rules above.
- A recipe share is a read-only public view. It shows the recipe's Categories, with only its schema changing from the enum to strings.

### Out of scope

- Renaming or deleting a Category from settings. A Category disappears from a household's list when no recipe of theirs carries it.
- Extending meal plan slots.
- `apps/mobile`, which is parked.
