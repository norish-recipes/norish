# Ingredient Catalogue

Status: ready-for-agent

## Problem Statement

Norish's ingredients are a flat list of whatever text a recipe once held. "Onion", "onions", "onion, diced", "ui" and "ajuin" are five ingredients, because the name the parser leaves over — preparation included — is minted as-is, and nothing records that they are one food. Everything a household teaches Norish about a food is therefore taught once per spelling: a Product Link or an Aisle Link filed for "onion" does nothing for "onions", a Pantry holding "ui" never covers an English recipe's "onion", and a household that cooks from Dutch and English recipes keeps two of everything. The groceries, product links, aisles and pantry all match on folded name text, so a tidier list alone would change nothing they do.

## Solution

One catalogue of **Ingredients**, each known by many **Ingredient Aliases** — every spelling, plural, preparation-bearing variant and translation ever seen. A recipe line, a Grocery, a recurring grocery and a Pantry Ingredient keep their text exactly as written ("2 onions, diced" still reads that way on the recipe and the list, so a shopper can still choose to buy them pre-diced) and point at the alias that text resolved to; the alias points at the Ingredient. Product Links, Aisle Links and store preferences are facts about an Ingredient at a Store, so teaching Norish where "onion" is filed files "onions", "ui" and "onion, diced" with it.

A new name is resolved on the way in: an exact alias match, then the same match with preparation stripped, then a Decision (or the language model when no Decision Model is configured), and only then a new Ingredient — minted **flagged** when nothing was sure, so a person can merge it or mark it distinct later on a new **Ingredients** page. Ingredients may have a **Parent Ingredient** ("red onion" under "onion"): a child falls back to its parent's Aisle and a child in the Pantry covers a recipe line for its parent, never the reverse.

The catalogue is seeded from the Open Food Facts ingredients taxonomy — every entry, every language — fetched nightly, so a new instance already knows that "ui" is "onion". Its licence (ODbL) is accepted: a Data sources page credits it and offers the catalogue as a download.

## User Stories

1. As a cook importing a recipe, I want "2 onions, diced" to still read "2 onions, diced" on the recipe, so that the recipe reads as its author wrote it.
2. As a cook importing a recipe, I want "onions, diced" recognised as the onion Norish already knows, so that everything learned about onions applies to it.
3. As a shopper, I want the grocery line to say "onions, diced", so that I can decide to buy them pre-diced.
4. As a shopper, I want an Aisle filed for "onion" to file "onions" and "ui" too, so that I file a food once rather than once per spelling.
5. As a shopper, I want a Product Link made for "onion" to apply to "onions, diced", so that a price and a pack size are learned once per food.
6. As a shopper, I want my store preference for "milk" to hold for "melk", so that a Dutch and an English recipe send the same food to the same Store.
7. As a household member, I want "ui" in the Pantry to cover an English recipe's "onion", so that a staple is left off the list whatever language the recipe is in.
8. As a household member, I want "red onion" in the Pantry to cover a recipe line for "onion", so that having the specific food counts as having the general one.
9. As a household member, I want "onion" in the Pantry never to cover "red onion", so that a recipe that needs the specific food still puts it on the list.
10. As a shopper, I want "red onion" to land in the onion Aisle when it has no Aisle of its own, so that a new variant is filed without teaching.
11. As a shopper, I want "red onion" never to borrow the onion Product Link, so that Norish never buys the generic food for a recipe that asked for the specific one.
12. As a shopper, I want a grocery I type by hand to be recognised the same way an imported line is, so that "Uien" typed on my phone joins what the household already knows about onions.
13. As a shopper, I want a recurring grocery recognised the same way, so that the weekly "melk" keeps its Store and Aisle.
14. As a shopper offline, I want a grocery added in the basement to be recognised when it syncs, so that working offline never leaves a line unfiled for good.
15. As a new administrator, I want the catalogue to already know common foods in my language, so that deduplication works from the first import.
16. As an administrator, I want the seed kept current without upgrading Norish, so that new Open Food Facts entries and translations arrive on their own.
17. As an administrator of a server without internet, I want Norish to work with an empty seed, so that the catalogue is an improvement rather than a dependency.
18. As an administrator of a server without internet, I want to point the nightly fetch at a local mirror, so that I can still seed it.
19. As an administrator, I want a failed or malformed fetch to leave the last good seed in place and show up in the job monitor, so that an upstream outage never damages the catalogue.
20. As a household member, I want a refresh of the seed never to undo an alias, merge or parent I set, so that teaching Norish is permanent.
21. As a household member, I want an Ingredient the refresh no longer lists kept while anything uses it, so that no recipe line loses its food.
22. As a household member, I want Norish to mint a new Ingredient when it is not sure, rather than guess, so that "onion powder" never inherits the onion's Product Link.
23. As a household member, I want an Ingredient Norish was not sure about marked on the Ingredients page, so that I know what is worth a look.
24. As a household member, I want to merge a flagged Ingredient into the one it duplicates, so that its aliases, and the lines behind them, join the right food.
25. As a household member, I want to mark a flagged Ingredient as distinct, so that the flag goes away when Norish's doubt was unfounded.
26. As a household member, I want editing a flagged Ingredient's name or parent to clear its flag, so that looking after it counts as reviewing it.
27. As a household member, I want to undo a wrong merge by moving an alias back out, so that a mistake is one action to reverse.
28. As a household member, I want to add my own alias ("ajuin") to any Ingredient, including a seeded one, so that my household's words are understood.
29. As a household member, I want to set or change an Ingredient's parent, so that "cherry tomatoes" can sit under "tomatoes".
30. As a household member, I want the Decision to propose a parent when it mints a variant, so that the tree grows without me.
31. As a Dutch-speaking household member, I want Ingredients shown in Dutch on the Ingredients page, the Pantry and search, falling back to English, so that the catalogue is in my language.
32. As an administrator, I want to choose whether everyone, the household or only the owner may edit an Ingredient, so that the catalogue's openness matches my instance.
33. As an administrator, I want seeded Ingredients and aliases editable only by administrators, so that a stray rename of "onion" never reaches every household.
34. As a household member, I want to be refused a merge unless I may edit both Ingredients, so that I cannot change what someone else's Ingredient means.
35. As a household member, I want to see a housemate's merge, alias move or parent change at once, so that our lists file and cover the same way.
36. As a user, I want a Data sources page crediting Open Food Facts, so that I know where the catalogue came from.
37. As a user, I want to download the ingredient catalogue in a machine-readable form, so that the data Norish derived from Open Food Facts stays open.
38. As an administrator upgrading, I want every existing ingredient, Product Link, Aisle Link, store preference and Pantry Ingredient carried over, so that nothing my household taught Norish is lost.
39. As an administrator of an instance without AI, I want resolution to still match exact and preparation-stripped names, so that deduplication works without a model.
40. As an administrator, I want the language-model resolution prompt editable like every other Prompt, so that I can tune it.

## Implementation Decisions

**Vocabulary and decisions on record.** CONTEXT.md gains **Ingredient**, **Ingredient Alias**, **Parent Ingredient** and **Flagged Ingredient** under Recipes (Ingredient Linking stays; "Ingredient Name" is retired in favour of Ingredient Alias), and Pantry Ingredient, Product Link, Aisle Link and Grocery are rewritten to be about an Ingredient rather than a folded name. Two ADRs:

- *Ingredient identity is an alias pointing at an Ingredient* (groceries or recipes area): references point at aliases, links key on Ingredients, merges move aliases. It supersedes ADR-0036 and amends ADR-0031's "an aisle is a fact about a name".
- *The catalogue is seeded from Open Food Facts under ODbL*: accepting share-alike on the catalogue tables, the notice and export duties, and why CIQUAL/USDA/NEVO are not used (macros are out of scope; NEVO's terms forbid redistribution).

**Schema.**

- `ingredients` keeps one row per food: a canonical (English where known) name, a nullable parent Ingredient, a nullable owner (null for seeded rows), a flagged marker, and the Open Food Facts entry id for seeded rows. The case-insensitive unique name stays.
- A new `ingredient_aliases` table: text, its fold, an optional locale, the Ingredient it points at, a nullable owner (null for seeded aliases), and whether it came from the seed. The fold is unique, so one spelling means one food instance-wide.
- `recipe_ingredients`, `pantry_ingredients`, `groceries` and `recurring_groceries` point at an alias. Recipe lines gain their as-written text as a column, because the Ingredient's name is no longer what they display. Groceries and recurring groceries keep their free-text name as the as-written text.
- `store_product_links` and `aisle_links` are keyed by (store, Ingredient), and `ingredient_store_preferences` by (user, Ingredient), replacing `normalizedName`.
- The pantry's unique (user, ingredient) and the procedure's one-per-household rule move to the Ingredient.

**Migration.** Every existing `ingredients` row becomes an Ingredient with its name as an alias. A startup backfill (following the existing ingredient-name backfill) runs the resolution order over existing rows once the seed is present, merging where resolution is sure and flagging where it is not. Product Links, Aisle Links and store preferences move from their folded name to the Ingredient whose alias has that fold. Where two links collide on the same (store, Ingredient), the one most recently updated wins. A fold no alias matches mints an Ingredient for it, so no link is dropped.

**The resolver: one deep module in `packages/shared-server`** (`packages/api` was first named, but the tRPC routers, queue workers and archive importer all save recipes and none may import `@norish/api`)**.** It is the only thing that mints Ingredients or aliases, and every caller goes through it: recipe save and import, pantry add, grocery create and rename, and recurring grocery create and rename. The parser keeps emitting names without minting. Its interface, in words:

- *resolve(texts, locale?)*: as-written texts in, one alias per text out. The order is:
  1. an exact alias match on the fold;
  2. the fold with the text after the first comma and any bracketed text removed;
  3. a Decision under a new Decision Use, *ingredient resolution*;
  4. a new Ingredient with the text as its first alias.

  At step 3, the Decision's state is the text and its candidates are the Ingredients whose aliases share words with it. It answers *match X*, *new* or *new, child of X*, and a Clear Case above a named threshold constant is acted on. Below the threshold, or when the Decision Model is unconfigured or switched off for this use, a language-model request under a new administrator-editable Prompt answers the same question. Without AI, step 3 is skipped. A new Ingredient minted after an unsure answer, or without step 3, is flagged. A *child of X* answer sets the parent, and when that answer was unsure the Ingredient is flagged too. When sure, step 3 adds the text as an alias of X, so the next occurrence is a step-1 match.
- *addAlias*, *removeAlias*, *moveAlias* (the unmerge), *merge(source, target)*, *markDistinct*, *rename*, *setParent* and *delete* (refused while anything points at the Ingredient): each checks the edit policy and each clears the flag where the stories say so. A merge moves every alias of the source to the target and deletes the source. Where both have a Product Link, Aisle Link or store preference at the same Store, the target's is kept. A parent change that would form a cycle is refused.
- *ingredientFor(alias)* and *aisleFor(store, alias)*, the latter falling back to the parent's Aisle Link. Product Link lookup has no parent fallback.
- *covers(pantryAlias, lineAlias)*: true when both resolve to the same Ingredient, or when the pantry's Ingredient is a descendant of the line's. It is used where the Pantry is consulted on adding a recipe.

**Open Food Facts seed.**

- A pure parser turns the taxonomy file into entries: id, parent ids, and names per language (every language, additives included).
- An apply step upserts only seeded Ingredients and seeded aliases. It never touches owned rows, owned aliases, merges or parents set by users. An entry the file no longer lists is kept while anything points at it.
- A new scheduled task on the existing midnight cron fetches the file with a conditional request. The whole file is parsed and validated before anything is applied, and a failure leaves the last good seed and is reported through the instrumented processor like every worker. First boot enqueues a fetch at once.
- One env var holds the source URL, defaulting to the taxonomy file on Open Food Facts' GitHub. It lands in `.env.example`, a configuration page and the Upgrade notes.

**Edit policy.** A new instance-wide ingredient permission policy with one level, `edit` (everyone, household or owner; default household), set by the administrator beside the recipe permission policy. There is no view level, because Ingredients are always visible (a hidden Ingredient would split the shared catalogue and leave recipes pointing at food their readers cannot see).

- Renaming, re-parenting and deleting an Ingredient follow `edit` on the Ingredient.
- Adding an alias is open to everyone.
- Moving or removing an alias follows `edit` on the alias.
- Merging needs `edit` on both Ingredients.
- Ownerless (seeded) Ingredients and aliases are editable only by administrators, and an administrator bypasses the policy as it does for recipes.

The owner of an Ingredient is whoever's action minted it, and the owner of an alias is whoever added it.

**Ingredients page.** A user-facing page under settings: a searchable list of Ingredients in the viewer's locale (English fallback), each with its aliases, parent and flag, plus a "flagged" filter. The actions are merge into…, move alias to…, mark distinct, rename, set parent, and add alias. Actions the viewer may not take are hidden.

**Translations.** Seeded aliases carry their locale. Surfaces that show an Ingredient rather than a line (the Ingredients page, the Pantry, and ingredient search) show the alias in the viewer's locale, falling back to the canonical name. Recipe lines and grocery lines always show their as-written text.

**Realtime and offline.** Every catalogue edit — merge, alias move, rename, parent change, deletion, and a spelling added or removed or a flag cleared — publishes one broadcast *ingredients changed* event, so open Ingredients pages converge too. Clients refetch ingredient-derived data, and handlers merge by id, so a client receiving its own change back is a no-op. An offline grocery carries only its as-written text, and the server resolves it on Replay.

**Licence surfaces.** A Data sources page carries the ODbL notice with Open Food Facts and the ODbL hyperlinked. It also offers a JSON export of Ingredients, aliases and parents to any signed-in user.

**Docs and release notes.** The Target Version's release notes, an `apps/docs` page for the Ingredients page and the Data sources page (with screenshots), and the env var's configuration and Upgrade notes.

## Testing Decisions

A good test here states a fact a person would recognise, through the resolver's public interface or the browser, and never asserts which table a row landed in. For example: "after merging 'uien' into 'onion', the onion Aisle files a grocery typed 'uien'".

- **The resolver, against a real database** (the main seam). The tests live in `packages/shared-server` beside the resolver (the upgrade backfill's in `packages/api`) and use the testcontainers harness, so the existing test gate runs them. The Decision is mocked at `decide` as the one AI seam, following the store-lookup product-decision test, and the language-model fallback is mocked at the runtime likewise. They cover:
  - each rung of the resolution order and the Clear Case threshold boundary;
  - flagged mints: unsure, no AI, and unsure child-of;
  - locale aliases;
  - merge, alias move, and merge collisions;
  - parent fallback for Aisles, no fallback for Product Links;
  - pantry coverage in both directions;
  - cycle refusal;
  - the upgrade migration of existing links and pantry rows.
- **The seed.** The parser is tested as a pure function over a fixture excerpt of the taxonomy file. The apply step is tested against the database: owned rows untouched, dropped-but-referenced entries kept, and a malformed file applying nothing. The producer test asserts the new task is registered, as it does for every scheduled task.
- **The edit policy, at the tRPC caller level** with mocked repositories, like the existing groceries, pantry and aisles router tests. It covers the everyone/household/owner matrix, admin-only seeded rows, and merge needing both.
- **One browser spec in the `ai` project.** A Dutch "ui" in the Pantry leaves an English recipe's "onion" off the list. A flagged Ingredient shows on the Ingredients page, and merging it into the Ingredient that holds an Aisle Link files its grocery in that Aisle. It seeds its own catalogue rather than fetching, and follows the pantry and grocery-aisles specs' patterns, including their shared-database traps.

## Out of Scope

- Macros per Ingredient, grams per piece, density, and any change to recipe Nutrition Information: dropped for this plan.
- CIQUAL, USDA and NEVO data.
- A structured preparation field; preparation stays in the as-written text.
- Translating recipe lines, grocery lines or recipe text.
- Product Link fallback to a parent, and grouping groceries by parent.
- A view policy for Ingredients.
- The mobile app (parked).
- Moving the repository tests in `packages/db` into a gate.

## Further Notes

- The ODbL reading behind the licence surfaces is interpretation from the licence text and OpenStreetMap's community guidelines, not settled law: household members probably count as the public, a single-user instance probably not. Offering the export to everyone covers both cases.
- A fold is unique across aliases, so the same spelling can never mean two foods. A seeded alias shared by two Open Food Facts entries goes to the first entry, and the collision is logged.
- The resolution Prompt makes twelve administrator-editable Prompts. The Decision has none, per ADR-0035.
