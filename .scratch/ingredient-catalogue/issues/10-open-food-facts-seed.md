# 10: Open Food Facts seed

**What to build:** The catalogue is seeded from the Open Food Facts ingredients taxonomy: every entry, additives included, with names in every language and parent links. The pieces:

- **Parser:** a pure function that turns the file into entries.
- **Apply step:** upserts only seeded Ingredients, seeded aliases (with their locale) and seeded parents. It never touches owned rows, owned aliases, merges or user-set parents. An entry the file no longer lists is kept while anything points at it. A seeded alias already held by another Ingredient stays where it is, and the collision is logged.
- **Nightly fetch:** a new scheduled task on the midnight cron fetches the file with a conditional request, and first boot enqueues a fetch at once. The whole file is validated before anything is applied. A failure keeps the last good seed and shows in the job monitor through the instrumented processor.
- **Source URL:** one env var, defaulting to the taxonomy on Open Food Facts' GitHub.
- **Backfill:** once a seed is applied, existing Ingredients are run through the full resolution order once, merging where sure and flagging where not.
- **ODbL duties:** a **Data sources** page with the Open Food Facts credit and an ODbL link, and a JSON download of Ingredients, aliases and parents for any signed-in user.

**Blocked by:** 06, 09

**Status:** done

- [x] Parser tests use a fixture excerpt of the taxonomy file.
- [x] Apply tests run against the database: owned rows untouched, dropped-but-referenced entries kept, alias collision logged, and a malformed file applies nothing.
- [x] The scheduled-tasks producer test asserts the new task is registered, and the worker is wrapped in the instrumented processor.
- [x] The env var is in `.env.example`, a configuration page and the Upgrade notes.
- [x] The backfill merges a pre-existing "onions" into the seeded "onion" and runs once.
- [x] The Data sources page and the export work.
- [x] An ADR records _the catalogue is seeded from Open Food Facts under ODbL_.

## Comments

- The startup backfill from 01-04 (`packages/api/src/startup/backfill-ingredient-aliases.ts`) is not this pass and cannot become it: it only visits rows that have no alias yet, so after the upgrade it never touches an existing Ingredient again, and it runs before any seed exists. The seed-time pass needs its own "run once" marker (for example a server-config key written when it finishes) and should walk Ingredients, not references: resolve each Ingredient's own-name alias against the seeded aliases and merge through the resolver's `merge` from 08, so aliases move and nothing that points at them does. Remember that groceries, recurring groceries, pantry rows and recipe lines keep the alias's Ingredient beside the alias (see 04's comments); the merge has to re-point those columns too.
- Done. The parser (`shared-server/src/ingredients/seed/parse-taxonomy.ts`) reads the file's real shape: blank-line blocks, `< lang: name` parents (found by any of the parent's names), `lang: a, b` names with `\,` as an escaped comma, `xx:` as every language (locale null), `prop:lang:` lines skipped. A line that is none of these (an HTML error page) makes the file malformed. Entry ids follow Open Food Facts' own keys (`en:onion`). The real file (2026-09-28): 5,695 entries, 69,360 spellings; applying it takes 3–4 s, and a second apply changes nothing.
- The apply step (`db/src/repositories/ingredient-seed.ts`) finds an entry's Ingredient by `off_id`, else by the Ingredient holding its name as a spelling or a name, which it **adopts** (sets `off_id`, keeps the owner). An entry whose name another entry's Ingredient holds was merged there by a person, and stays merged: a refresh never re-mints it. A parent is placed only where no person chose one: `parent_chosen` (set by `setParent`, whether setting or clearing) replaces 09's plain nullable check, so a parent a person cleared stays cleared. Spellings two entries share go to the first and are reported with the collisions.
- A dropped entry is removed only when nothing uses it: no reference through any of its spellings, no link or preference, no spelling a person added, no child.
- The one-time pass (`mergeExistingIntoSeed`) does **not** ask the language model, a deviation from "the full resolution order": it would be one model request per existing Ingredient at boot. It uses rungs 1 and 2 against the seed: a pre-existing Ingredient whose spellings (or stripped spellings) the seed gives to exactly one entry is merged into it, and one the seed gives to several is flagged. It runs after the first applied seed and is recorded in `ingredient_seed_state.mergedExisting`.
- The task `ingredient-catalogue-refresh` runs on the midnight cron and is enqueued at **every** boot rather than only the first: the fetch is conditional (`If-None-Match`/`If-Modified-Since` from the last applied file), so asking again costs one small request, and a boot that never managed to apply retries on its own. The validators are stored only after an apply succeeds.
- `INGREDIENT_CATALOGUE_URL` defaults to the taxonomy on GitHub; empty turns the fetch off.
- The Data sources "page" is a card on the Ingredients settings tab, not a route of its own: the data it credits is that catalogue, and a new route would need its own offline handling. The export is `GET /export/ingredients` (signed-in users; owners left out).
- Upgrade notes cover the carry-over and the env var; the release-notes feature entry and the docs pages with screenshots are 12's.
