# 09: The first start cleans up, documented

**What to build:** When a server first starts this release, one pass cleans what earlier versions left. It runs at startup after the seed, once per cleanup version recorded in the ingredient seed state, the same way the recheck pass is versioned:

1. Seeded spellings lose their stray marks ("3wu)", "|चौलाई}}"). Balanced brackets stay.
2. A dirty translation whose fold is already clean ("gyoza vellen )", "baking soda )") gets its clean text.
3. Every non-seeded translation that is not its own clean name ("gyoza vellen ((ontdooid))") is removed. The rows behind it are re-resolved from their own text with AI off. Old hand-typed translations can't be told apart from minted ones, so they are treated alike.
4. Joined names on recipe lines, Pantry Ingredients and recurring groceries are split by the words, and the joined food is removed, even one a person kept distinct.
5. The AI pass is queued for every own food no person has decided about.

Then the docs:
- the target version's release notes, with an upgrade note saying this runs by itself;
- the release notes also name ticket 02's changes: delete always works (the dialog's counts), own foods unused for 90 days are deleted nightly, and groceries can repeat yearly;
- an upgrade note that recurrence words an administrator edited before this release are replaced once by the shipped ones, which now carry years and seven more languages; words edited after it stay;
- the release notes also name ticket 05's change: a typed grocery, recurring grocery or Pantry entry naming several foods ("zout en peper") becomes one per food, and one offering alternatives ("boter of olie") its first on the list and each in the Pantry; and an upgrade note that `POST /api/v1/groceries` now answers with a list, a grocery per food the name names;
- the release notes also name ticket 06's change: AI makes its answer about a food (merge, parent, Plain Name) itself, sure or not, and lists it on Changed by AI with Undo, and Keep for an unsure one; Suggestions and Confirm all are gone;
- the release notes also name ticket 04's change: a recipe line naming several foods ("zout en peper", "boter of olie") points at each, for the pantry, the add-to-groceries panel and nutrition; and an upgrade note that Ingredient Words an administrator edited keep no joining words (`together`, `alternatives`) until added or the defaults restored;
- the Ingredients page in the docs, rewritten for applied changes, Changed by AI and delete;
- screenshots shot as whole panel windows off a running instance.

Colon lines are not turned into Headings (Mike, 2026-10-20: "Lets not ship that"): that would rewrite recipe text, and they already name no food (ticket 01).

**Blocked by:** 01, 02, 05, 07, 08, 13

**Status:** done

- [x] A scenario modelled on the production data covers each step: "gyoza vellen )", "gyoza vellen ((ontdooid))", "3wu)", "paprika (vrucht)", "zout en peper" kept distinct, an undecided own food.
- [x] After step 2, "gyoza vellen )" is the one spelling "gyoza vellen", on the same food: no second spelling and no second food appear (Mike, 2026-10-20).
- [x] The pass runs once; a second start does nothing.
- [x] Release notes, the upgrade note and the Ingredients docs page are updated. Changed by AI and the delete dialog have fresh screenshots. No real people's names appear in them.
- [x] All `CONTRIBUTING.md` gates pass, and the docs site builds.

## Comments

2026-10-20, implemented (after ticket 13, Mike: "Do 13 first, then 09"):

- `cleanUpCatalogueOnFirstStart` (`shared-server/ingredients/seed/first-start-cleanup.ts`) runs at boot right after the recheck, once per `CLEANUP_VERSION` (1), recorded as `cleanupVersion` in the ingredient seed state only once the whole pass is through. Its repository side is `db/repositories/ingredient-cleanup.ts`; the resolver gained `cleanSpellingOf` and `partsByWordsOf`.
- "Its own clean name" is the spelling a mint adds today (`cleanAlias`: plain, else bare). Step 2 rewrites the text of a spelling whose fold already is that name.
- Step 3 deviation, the non-destructive reading: where no spelling holds the clean name yet, the variant takes it in place, so its food keeps its rows instead of a re-resolve minting a second food. Otherwise the variant goes and its lines, groceries and recurring groceries are resolved again from their own text, with AI off, minting for the row's owner. A Pantry Ingredient has no text, so it stays with the spelling the removal moves it to. A food left with no spelling joins the food holding its clean name ("zout naar smaak" into zout), or is deleted where the name names nothing (")"); a kept-distinct food is treated alike, as the spec says of old translations.
- Step 4 splits own foods only (a seeded food is never deleted), by the words alone, through `splitCatalogueIngredient`, as AI's sure split does.
- Step 5 queues one pass over every askable own food. The boot wrapper (`api/startup/clean-up-catalogue.ts`) starts the queues early for it; with AI off nothing is queued, and the nightly retry only covers unanswered flags.
- Speed: 1,800 removed spellings with a line each took 4 s on this Mac, so the production copy's ~71k would hold the first boot ~2.5 min. Each round of 200 commits, so a boot cut short resumes. Marked `ponytail:` for ticket 12 to measure.
- Docs: release notes (three features, four fixes, five upgrade notes), the Ingredients page rewritten (AI keeps the catalogue, Changed by AI, Deleting), the New ingredients section of the AI provider page. Screenshots `ingredients-changed-by-ai.png`, `ingredients-delete.png` (whole 1100x820 windows at 1.5x) and `admin-automatic-ingredients.png` (the row, as before) from the `ai` harness with staged rows; the owner is "AI E2E Owner". The old `ingredients-clean-names.png` and `ingredients-ask-ai.png` stay, as the 0.25 versioned docs show them.
- The `ai` catalogue spec had one red on its first run: "a food nothing uses can be deleted" saw the panel stay mounted after Delete, during a 15 s stall in which every Redis socket timed out (swap at 8.8 of 10 GB). It then passed 24/24 with `--repeat-each=2`; not reproduced, so not fixed.

2026-10-20, after the review: step 4 decides by the food's name only, not its translations (Mike). An own food a person merged a joined name into stays as it is, and a food named by a joined name is still split. The test runs it in three languages: "kruidenmix" holding "zout en peper", "seasoning" holding "salt and pepper", "Gewürzmischung" holding "Salz und Pfeffer".

On the production copy, 61 of 64 joined spellings on own foods sit on a food whose name is joined, and none sits on a real mix. Joined spellings that step 3 removes ("Snuf zout en peper") still split, since step 3 resolves their rows again by the words. What deleting such a mix should do to its lines is ticket 19.
