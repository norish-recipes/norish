# Ingredient cleanup: AI acts, lines name several foods, junk leaves the catalogue

Status: ready-for-agent

Grilled 2026-10-17 against the production copy (425 recipes, 432 own Ingredients). Decisions are recorded in `CONTEXT.md` (Ingredient, Ingredient Alias, Ingredient Words, Plain Name, Parent Ingredient, Flagged Ingredient, AI Change, Junk Line, Ingredient Icon, Pantry Ingredient) and in ADR-0037's three amendments of 2026-10-17. Read those first; this spec does not repeat their reasoning.

Rewritten 2026-10-20 (Mike): this is catalogue work, and it never changes a recipe. A line that names nothing stays as written and points at no food once its food is removed, so the cook can still fix it. This reverses the 2026-10-17 "Junk Lines are deleted"; ticket 13 takes the deletion out of the code.

## Problem Statement

The household's catalogue fills up with things that are not foods and with foods that are two foods, and the person keeping it tidy does the work AI could have done.

- **Too many flags.** Mike marked 129 of his 432 own Ingredients distinct by hand. Among them were toilet paper, floor cleaner, "deegroller", "chopped", "melted", "sambal or fresh chili" and "wraps of pitabroodjes". A name that shares no word with a known food is flagged without AI being asked at all. After a food is minted, AI only ever suggests, so every answer still needs a person's click.
- **AI waits for a person.** Nothing asks AI about a food after it is minted unless a person starts a round, and a round only covers flagged foods. A food AI could not reach at import (time-out, refused key) stays flagged forever.
- **Joined names are one food.** "zout en peper", "boter of olie" and "water of kokosmelk" each became a food of their own. Their price, aisle, pantry check and nutrition are therefore wrong.
- **Junk spellings.** The Ingredients page shows translations no recipe wrote: "gyoza vellen )", "baking soda )", "cooked pasta of choice )". The bracket stripping cut "((ontdooid)" out of "gyoza vellen ((ontdooid))" and left the ")". Every new text also becomes a translation of its own ("gyoza vellen ((ontdooid))", "12 gyoza vellen"): 71,609 of them. The seed brought "3wu)" (Open Food Facts' Akan for honey) and two amaranth spellings ending in wiki markup.
- **Junk lines.** "melted", "roughly chopped" and "overnight and drained" are lines of their own in "snickers ice cream bars", whose caption wrapped mid-line. "Voor de salade:" and 10 other colon lines were matched to foods (lettuce).
- **Nothing can be deleted.** Deleting a food or a translation that anything uses is refused. The only way out is to merge it into something else. One-off purchases ("Action - 4/5 x grote doos") stay in the catalogue forever.

## Solution

1. **AI acts by itself, and everything can be undone.** For every food someone's action minted, and that no person kept distinct, renamed or parented, AI asks the thorough question (read the name, then compare) in the background and applies the answer:
   - **merge** into a known food;
   - **parent**;
   - **Plain Name**;
   - **a food of its own**;
   - **not a food**: kitchen equipment the cook has, a preparation or fragment, a note (the food is deleted; its lines keep their text and point at no food).

   A sure answer raises no flag. An unsure answer is applied too, and flags its food. Each one is an **AI Change** on a new **Changed by AI** list beside the Ingredients:
   - it is listed for a month (an unsure one stays until a person keeps or undoes it);
   - unsure changes come first, with **Keep** and **Undo**;
   - sure changes come after, with **Undo**;
   - an Undo is remembered, so AI never makes that change again.

   The pass runs:
   - after each mint;
   - once when the release first starts;
   - nightly for foods AI could not answer for.

   Drawing an icon becomes a job of its own after the pass, for foods that still exist and show none. Suggestions, Confirm all, Ask AI, Find parent with AI and the Fix catalogue round are removed. Draw icons stays. Flagged foods stay marked in the Ingredients list as today.
2. **A recipe line may name several foods.** "zout en peper" points at zout and peper, needed together. "boter of olie" points at boter and olie, as alternatives. The line keeps its text. A Grocery and a Pantry Ingredient still name one food each, so a text naming several becomes one of them per food.
   - **When a name is split:** never when it is known whole ("mac and cheese" stays one). The words split it at an "and" or an "or" of any language when every part is a known food. "of" counts as "or" only when the parts are not all English, so "juice of a lemon" stays one. AI splits the rest, and only when it is sure.
   - **Alternatives:** the line is in the pantry when any alternative is kept. Otherwise its first alternative goes on the list. Nutrition counts the first.
   - **Foods needed together:** each one gets the line's full amount.
   - **Display:** the line shows its first food's icon.
3. **Spellings are clean names.** A text with preparation, brackets or an amount points at the clean spelling it reduces to, and is never added as a translation of its own. Double brackets are stripped whole. Before a text is read, stray punctuation, prices and notes are stripped. The seed's spellings keep their brackets, because there a bracket tells two foods apart ("paprika (vrucht)" is bell pepper); the seed loses only its stray marks. A translation a person types in the panel is stored clean, as a recipe text is read, so a recipe can match it.
4. **Junk leaves the catalogue, never the recipe.**
   - A line that still names nothing once cleaned and read stays in its recipe as written and points at no food. A food it minted is deleted by AI, sure or not, with Undo. The cook fixes the line, if at all.
   - A colon line with no amount names no food, and keeps its text: old ones are not turned into Headings (Mike, 2026-10-20).
   - A line naming a tool is the same: AI answers "not a food" for both (Mike, 2026-10-20).
   - A Grocery or Pantry Ingredient a person typed is never deleted; it points at no food when it names none.
5. **Delete always works, and unused foods leave.**
   - Deleting a food or a translation is no longer refused. A deleted food's recipe lines and Groceries keep their text and point at no food, and its Pantry Ingredients go. What a removed translation wrote keeps its food, under another of the food's spellings.
   - A food someone's action minted is deleted once no recipe line, Grocery, recurring grocery or Pantry Ingredient has named it for three months. A seeded food is never deleted, by this or by AI.
   - Recurring groceries learn "yearly" / "jaarlijks", so a yearly purchase keeps its food.
6. **One cleanup when the release first starts:**
   - seeded stray marks are cleaned;
   - variant translations are removed, and the lines behind them are resolved again from their own text;
   - "gyoza vellen )"-style translations get their clean text;
   - foods whose name is joined are split and removed, even one a person kept distinct; a food holding a joined spelling a person merged in ("kruidenmix") stays;
   - the AI pass is queued for every food no person has decided about.

## User Stories

1. As a home cook, I want "zout en peper" in a recipe to mean salt and pepper, so that each is priced, filed and checked against my pantry on its own.
2. As a home cook, I want "boter of olie" to count as in the pantry when I keep either one, so that neither goes on the list for nothing.
3. As a home cook, I want an "or" line I don't have to put its first alternative on the list, so that I buy one thing, not both.
4. As a home cook, I want "2 el boter en suiker" to put 2 el of each on the list, so that the amounts match how recipes write "each".
5. As a home cook, I want "mac and cheese", "half and half" and "sweet and sour sauce" to stay one food, so that splitting never breaks a real product.
6. As a Dutch cook, I want "water of kokosmelk" read as alternatives, so that Dutch "of" means "or".
7. As an English cook, I want "juice of a lemon" read as one food, so that English "of" never splits a name.
8. As a cook, I want "Dijon or yellow mustard" split only when AI is sure, so that a guess never leaves me with two wrong foods.
9. As a cook, I want a line naming several foods to show its first food's icon, so that the list stays as calm as before.
10. As a cook reading nutrition, I want an "or" line counted as its first food and an "and" line counted at its full amount for each food, so that the total reflects the recipe.
11. As a shopper, I want "zout en peper" typed on the list to become two groceries, so that each lands in its own aisle with its own price.
12. As a household member, I want "zout en peper" added to the pantry to keep salt and pepper separately, so that each covers recipes on its own.
13. As a household member, I want the joined foods I already have split when the new version first starts, so that I don't have to fix them one by one.
14. As the person keeping the catalogue, I want AI to merge, parent, rename and file foods by itself when it is sure, so that I stop clicking "distinct" on toilet paper.
15. As the person keeping the catalogue, I want AI to apply an unsure answer too and flag it, so that the catalogue is right more often and I only check.
16. As the person keeping the catalogue, I want one Changed by AI list with every change from the last month, so that nothing AI does is hidden.
17. As the person keeping the catalogue, I want Undo on every AI Change, so that a wrong merge, parent, name or deletion is one click to reverse.
18. As the person keeping the catalogue, I want an undone change remembered, so that AI never makes it again.
19. As the person keeping the catalogue, I want Keep on an unsure change, so that I can confirm it and clear the flag.
20. As the person keeping the catalogue, I want a flagged food still marked in the Ingredients list, so that I find what needs a look where I already look.
21. As the person keeping the catalogue, I want the AI pass to run in the background after every new food, so that I never start a round.
22. As the person keeping the catalogue, I want foods AI couldn't reach retried nightly, so that a time-out at import doesn't leave a flag forever.
23. As the person keeping the catalogue, I want AI to leave alone the foods I kept distinct, renamed or parented, so that my decisions stand.
24. As an administrator, I want AI never to touch seeded foods, so that the curated catalogue stays as shipped.
25. As an administrator, I want icons drawn only after AI is done, so that no drawing is wasted on a food about to be merged or deleted.
26. As an administrator, I want the AI pass to follow the AI switch and the Decision Model's ingredient resolution use, so that it runs where rung 3 already does and nowhere else.
27. As a cook, I want "gyoza vellen ((ontdooid))" and "12 gyoza vellen" to point at the translation "gyoza vellen", so that the catalogue shows one clean translation.
28. As the person keeping the catalogue, I want "gyoza vellen )", "baking soda )" and "cooked pasta of choice )" gone, so that the translations read like food names.
29. As an administrator, I want seeded translations with stray marks ("3wu)", "|चौलाई}}") cleaned, so that the seed shows no broken text.
30. As an administrator, I want seeded translations like "paprika (vrucht)" kept as written, so that the brackets still tell two foods apart.
31. As the person keeping the catalogue, I want a translation I type in the panel stored clean, so that a recipe writing it the same way finds it.
32. As a cook, I want a recipe save to keep the food of every line I didn't change, so that saving never re-asks AI or moves an untouched line.
33. As a cook, I want my recipe lines kept as written, even "melted" and "overnight and drained", so that I can fix my recipes myself.
34. As the person keeping the catalogue, I want a food AI deleted listed on Changed by AI with Undo, so that a food AI deleted wrongly comes back with its lines.
35. As a cook, I want "Voor de salade:" to name no food, so that it stops posing as lettuce.
36. As a cook, I want "taart- of springvorm (doorsnede 26 cm)" kept in the recipe but never on the grocery list, so that I still know which tin I need.
37. As the person keeping the catalogue, I want AI to delete a food it thinks is not a food even when unsure, so that the catalogue clears itself and Undo still brings the food back.
38. As a shopper, I want a grocery I typed never deleted by AI, so that the list holds what I wrote even when it isn't a food.
39. As a shopper, I want a typed grocery that names nothing to stay on the list without a food, so that it doesn't add junk to the catalogue.
40. As the person keeping the catalogue, I want to delete a food a recipe still uses, so that a non-food leaves the catalogue without a merge.
41. As a cook, I want the lines of a deleted food to keep their text, so that my recipe still reads the same.
42. As the person keeping the catalogue, I want the delete dialog to say how many lines, groceries and pantry entries it unlinks, so that I know what I'm doing.
43. As the person keeping the catalogue, I want to remove a translation a line uses, so that a wrong translation can go without a merge.
44. As a household member, I want a deleted food's Pantry Ingredient to go with it, so that the Pantry holds only foods.
45. As the person keeping the catalogue, I want a one-off purchase deleted once nothing has named it for three months, so that the catalogue doesn't collect one-offs.
46. As a shopper, I want a recurring grocery to keep its food alive, so that the dishwasher salt keeps its aisle between trips.
47. As a shopper, I want to set a grocery to recur yearly ("yearly", "jaarlijks"), so that a yearly purchase keeps its food and aisle.
48. As an administrator, I want the cleanup to run once by itself when the release first starts, so that an upgrade needs no manual step.
49. As an administrator on a server with AI off, I want the words-only rules (cleaning, and/or splits, colon lines naming no food, clean translations, delete, cleanup) to work, so that a server without AI still gets most of the fix.
50. As an administrator on a server with AI off, I want foods flagged when nothing could answer for them, so that I can still find them.

## Implementation Decisions

**Storage**

- A recipe line's foods move into a child table of their own: one row per food, in order, each pointing at an Ingredient Alias. The line records how they are joined: `together` or `alternatives`, empty when it names one food or none. The line's single alias column is dropped, with no fallback. A reader that wants "the line's food" reads the first in order. Deleting an alias deletes its rows, and the line closes up.
  - Chosen over keeping the column as the first food: there is one shape, and deleting the first food needs no promotion step.
- Groceries, recurring groceries and Pantry Ingredients keep their single alias and Ingredient columns.
- A new **AI Change** table. Each row has:
  - the kind: merge, parent, plain name, mint or not-a-food;
  - the food it is listed under;
  - whether AI was sure;
  - what Undo needs, as JSON: the moved alias ids and their former food, the former parent, the former name, or a deleted food's name and spellings with the rows that pointed at them;
  - created, kept and undone timestamps.

  A row that was undone is never swept away: it is the memory AI checks before acting. A sure change is swept after a month. An unsure one stays until it is kept or undone.
- `ingredients.flagged` and `flag_reason` stay. A food is flagged while it has an unsure change that is neither kept nor undone, or while no AI could answer for it.
  - Keep clears the flag and counts as a person's decision, like keeping a food distinct, so AI no longer asks about it.
  - New flag reason `ai-junk`: a food AI says is not a food, kept because a Pantry Ingredient names it.
- `ingredients.unused_since` (a timestamp) is set and cleared by the nightly sweep. Nothing on the write paths has to touch it.
- The suggestions table is dropped. `name_settled` and `kept_distinct` stay.

**Resolver**

The resolver stays the one door. For every text it answers one of: no food; one alias; or several aliases with their join. A recipe line is always stored as written. Order of work for one text:

1. **Clean.** Strip stray punctuation, unmatched and doubled brackets, a leading "+ / - :", prices and notes. The double-bracket bug is fixed in the shared spelling keys, which the clients use too.
2. **No food.** A text that names no food by the existing rules (a heading, an amount alone, no letter or digit) stops here. So does a colon line with no amount.
3. **Rungs 1 and 2,** unchanged, on the whole text. A name known whole is never split.
4. **The words' split.** Split at the joining words, which are a new kind of Ingredient Word (and, en, und, &, or, of, oder, ou, en/of, and/or, and the rest per language). Accept the split only when every part matches by rungs 1–2. "of" is accepted only when not every part is an English spelling; that reads the alias locale, as a hint.
5. **Rung 3** (Decision, then the language model) asks the existing question, with two more possible answers: several foods (with their join, acted on only when sure); and not a food.
   - Sure answers act at once: join, mint, split, or no food for not a food.
   - An unsure "same" now joins the food and records an unsure AI Change, where today it mints a flagged duplicate.
   - "Not a food" names no food, sure or not, and mints nothing.
6. **Mint.** A new food gets only its clean spelling (plain or bare), never the text as written. A join with a known food likewise adds only the clean spelling.

**Recipe save**

A recipe save keeps the foods of every line whose text, amount and unit are unchanged since the stored line. Only changed or new lines are resolved.

**The background AI pass**

- It reuses the ingredient review queue, no longer started by a person, together with its step reporting, model ledger and job monitor. It takes a list of food ids. For each food it asks the thorough question (read, then compare), skips a food a person decided about, checks the undone AI Changes so it never repeats one, applies the answer and records an AI Change.
  - The Plain Name step runs after a "food of its own" answer, as the round does today.
  - "Several foods" on an existing food splits every line, grocery, recurring grocery and pantry entry pointing at it, then removes the joined food.
  - "Not a food" deletes the food, sure or not. Its recipe lines, groceries and recurring groceries keep their text and point at no food. A Pantry Ingredient keeps the food, flagged (ticket 08's open items).
- **Who triggers it:**
  - the minted-food port (which today feeds the new-ingredients queue);
  - the one-time cleanup at first start;
  - the nightly scheduled task, for foods flagged because AI was unavailable or its key was refused.

  It follows the AI switch. The Decision is used where the ingredient resolution Decision Use is on, and the language model otherwise.
- **The new-ingredients queue is deleted.** Its naming moves into the pass. Its drawing moves to the existing ingredient icons queue, enqueued at the end of a pass for the foods that still exist and show no icon, when the administrator's "Draw an icon" option is on.
- **Config.** The "Clean the name" option under Automatic for new ingredients goes, because naming is part of the pass. "Draw an icon" stays.
- **Undo, per kind:**
  - merge: the moved spellings go back out to a food of their own, carrying their lines;
  - parent: the former parent comes back;
  - plain name: the former name comes back, and the name is settled;
  - not-a-food: the food is re-minted with its spellings, and its rows point at it again.

  Undo follows the existing edit policy for the food.

**Catalogue edits**

- **Delete** an Ingredient in use: allowed. Recipe lines lose that food from their list; groceries and recurring groceries keep their text and point at no food; Pantry Ingredients are deleted. The confirm dialog shows the counts.
- **Remove** a translation in use: allowed. Its line food rows, groceries, recurring groceries and Pantry Ingredients move to another spelling of the same food: the one whose fold is the food's name, else the oldest. Nothing loses its food, and nothing moves to a parent. A wrong translation is fixed with Move, which carries its lines to the right food.
- **The unused-food sweep** is a new scheduled task beside the existing ones. Every night it sets or clears `unused_since` on own foods by whether a recipe line, Grocery, recurring grocery or Pantry Ingredient points at them, and deletes those unused for 90 days. Seeded foods are skipped. The same task sweeps AI Changes, and enqueues the nightly retry.
- **The one-time cleanup** runs at startup, after the seed, once per cleanup version recorded in the ingredient seed state, the way the recheck pass is versioned:
  1. clean stray marks in seeded spellings;
  2. give dirty spellings with a clean fold ("gyoza vellen )") their clean text;
  3. remove every non-seeded spelling that is not its own clean name, re-resolving the rows behind it from their own text with AI off;
  4. split foods whose name is joined (lines, pantry, recurring groceries) by the words, and remove the joined food; a food's other spellings are not read;
  5. enqueue the AI pass for every own food no person has decided about.

  Old translations can't be told apart as hand-typed or minted, so step 3 treats them alike.
- **The seed** applies the same stray-mark cleaning to new data; balanced brackets in seeded spellings stay.

**Readers**

- **Pantry coverage:** an "alternatives" line is covered when any of its foods is. A "together" line is checked food by food.
- **Add to groceries:** the panel shows one row per food it will add: each food of a "together" line with the line's amount, the first alternative of an "alternatives" line, and lines with no food are skipped as today.
- **Nutrition:** an "alternatives" line counts its first food. A "together" line counts each food at the line's full amount.
- **Icons:** the first food's icon.
- **Uses:** the "where used" panel and the in-use counts include a line under every food it names.

**Groceries and pantry**

- **Groceries:** create, rename and the recurring create run the resolver. When a text names several foods, it becomes several rows, each with its part as its text. A typed text that names nothing is kept and points at no food, and nothing is minted for it. That closes today's gap, where a typed ")" mints a food.
- **Pantry:** an add whose text names several foods adds one Pantry Ingredient per food. A text that names nothing is refused, as today.

**Recurrence**

"year" joins day, week and month in the recurrence parser, calculator and formatter, with the unit words of every language.

**UI**

- The Ingredients page gets a **Changed by AI** view: unsure changes on top with Keep and Undo, sure ones below with Undo, deleted foods included by name.
- Flagged foods stay marked in the Ingredients list as today; the mark opens the food's unsure changes.
- These are removed: Ask AI, Find parent with AI, Fix catalogue, the Suggestions panel and Confirm all.

**Docs**

- ADR-0037 is amended (done).
- Release notes for the target version and the Ingredients docs page are updated, with a screenshot of Changed by AI.
- The upgrade note says the one-time cleanup runs by itself.

## Testing Decisions

A good test drives the system through the same door a household does: hand texts to the resolver, run the pass on a food, call a catalogue edit or tRPC procedure, or click in the browser. It then asserts on what a household sees: which foods a line names, what the list holds, what Changed by AI shows. It never asserts on internal calls. AI is always mocked at the AI runtime's `decide` and `generateStructured`, never deeper.

- **The resolver**, against a real database (prior art: `resolver.test.ts`, `resolver-ai.test.ts`). Cleaning and double brackets: "gyoza vellen ((ontdooid))" and "12 gyoza vellen" name one translation, "gyoza vellen". Mints add only the clean spelling. The and/or/of split, with "mac and cheese", "juice of a lemon", "boter of olie" and "water of kokosmelk" as cases from the real set. AI split only when sure. "Not a food", sure or not, storing the line as written with no food. Unsure "same" joins and records an AI Change. A colon line is no food. A recipe save keeps unchanged lines' foods.
- **The background pass**, against a real database (prior art: `review.test.ts`, `plain-names.test.ts`, which it replaces, and the ingredient review worker test). Every answer kind applies and records its AI Change. Unsure answers flag. Keep and Undo per kind, including a deleted food's lines pointing at it again. An undone change is never made again. Decided and seeded foods are skipped. The icon job is enqueued only for foods that survive without an icon.
- **Catalogue edits** (prior art: `catalogue.test.ts`, `recheck-mints.test.ts`, `catalogue-seed.test.ts`). Deleting in use unlinks lines and groceries and removes pantry rows. The unused-food sweep across 90 days, with recurring groceries keeping a food alive and seeded foods never deleted. The one-time cleanup, step by step, on a scenario modelled on the real data. The seed's stray-mark cleaning keeps "paprika (vrucht)".
- **Pure readers** in `@norish/shared`, in their existing unit tests: spelling-key cleaning, pantry coverage for alternatives, nutrition first and each, recurrence "yearly".
- **The browser,** in `ingredient-catalogue.e2e.ts` (`ai` project, AI stack fixture):
  - a recipe with "zout en peper" puts two groceries on the list;
  - an AI merge shows on Changed by AI, and Undo takes it back;
  - deleting a food a grocery uses works, and the grocery keeps its text.

  The two scenarios built on suggestions (Ask AI's round, Clean names) are rewritten for applied changes. The Fix catalogue modal's component test goes with the modal.
- Every flaky result is a bug to fix, never a re-run.

## Out of Scope

- Recording a recipe's language. The "of" rule reads spelling locales as a hint, and nothing more.
- Joining wrapped fragments back onto the line above, or removing them: the recipe is the cook's to fix.
- A "never a food" memory for texts a person deleted by hand. Add it if junk keeps coming back.
- Reviewing seeded foods with AI.
- Hiding non-food purchases (toilet paper) from the Ingredients list. They stay foods so their aisle and price are remembered.
- The quick-import extension and the parked mobile app.
- Changing the parser's newline split. The caption that wrapped is the source's own text.

## Further Notes

- Choices not put to Mike, taken as the lean reading:
  - the AI pass follows the AI switch with no opt-in of its own, since rung 3 already runs that way;
  - the "Clean the name" option is dropped;
  - unsure AI Changes outlive the month until handled;
  - old hand-typed variant translations are collapsed with the rest, since they can't be told apart.
- Measured on the production copy (`norish` on :5432): 432 own Ingredients, 129 kept distinct, 4 still flagged. About 585 lines contain a joining word of some language. 11 colon lines, and 4 fragment lines in one recipe. 58 seeded spellings with brackets, of which 3 are junk.
- The `ai` E2E project shares a database with other specs. Seed scenario foods under unique names.
