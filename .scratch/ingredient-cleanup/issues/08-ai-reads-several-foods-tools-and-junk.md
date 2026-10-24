# 08: AI reads a name as several foods, a tool or nothing

**What to build:** AI's question about a name gains three answers, both at import (rung 3) and in the background pass:

- **Several foods**, with how they're joined. Acted on only when AI is sure: "Dijon or yellow mustard" becomes two mustards as alternatives. Unsure, the name stays one food. On an existing food, a sure split moves every line, grocery, recurring grocery and pantry entry that points at it, and then removes the joined food.
- **A tool** ("taart- of springvorm (doorsnede 26 cm)", "deegroller"). The line stays in the recipe, names no food and never goes on the list. An existing tool food is deleted, its lines keep their text, and the deletion is an AI Change whose Undo re-mints the food and points its rows back at it.
- **Names nothing** ("melted", "roughly chopped", "overnight and drained"). The text has already been cleaned (01), so this is real junk. A sure answer deletes the recipe line as a Junk Line, at import (the line isn't stored) or from an existing recipe. It's recorded as an AI Change whose Undo puts the line back at its position and remembers its text as not junk.

An unsure tool or junk answer mints or keeps the food, flagged with that reason. Its flag offers **Delete as junk**, which deletes the food and its recipe lines, each one restorable from Changed by AI. AI never deletes a Grocery or a Pantry Ingredient a person typed: one that names nothing stays and points at no food.

See `CONTEXT.md` (Junk Line, AI Change) and ADR-0037's 2026-10-17 amendments.

**Blocked by:** 01, 04, 07

**Status:** done

- [x] A sure "several foods" answer splits "Dijon or yellow mustard" into two alternatives. An unsure one leaves one food.
- [x] A sure split of an existing joined food re-points all its rows and removes the food.
- [x] A sure tool answer keeps "deegroller" in its recipe with no food, and it is skipped when the recipe is added to the groceries.
- [x] A sure junk answer removes "melted" from "snickers ice cream bars", lists it on Changed by AI, and Undo restores it at its position. Asked again, it is not deleted.
- [x] Junk at import: the line is not stored, and the AI Change lists it.
- [x] An unsure junk answer flags the food with Delete as junk. Using it deletes the food and its lines, each restorable.
- [x] A typed grocery that AI says names nothing stays on the list.
- [x] Resolver and pass tests cover each answer, sure and unsure, against a real database with AI mocked at the runtime.
- [x] Browser: a junk line deleted by the AI stub is restored from Changed by AI.
- [x] All `CONTRIBUTING.md` gates pass.

## Comments

2026-10-19, implemented:

- Rung 3 has three more answers. The Decision offers "a tool" and "nothing"; its "several foods" defers to the language model, which alone names the parts (`parts`, `joined`). The thorough question also compares a name its reading calls no food, with no candidates, so the pass can hear "tool" or "nothing".
- At import a tool names no food, sure or not (Mike, 2026-10-20: "unsure tool deleting is also fine"; the pass deletes it the same way). Sure: several resolves each part as a text of its own (a part AI calls several again is minted whole, flagged); nothing is a Junk Line, which the recipe write leaves out and records under its recipe (`ingredient_ai_changes.recipe_id`, migration 0079). Unsure, those two are flagged mints: `ai-unsure` for several, `ai-junk` for nothing. A Grocery or Pantry text names the first food of several (only that part is resolved), and no food for a tool or nothing.
- In the pass, sure: a split re-points every line (the parts in its food's place, joined unless it was already), grocery and recurring grocery (the first part; "together" adds a row per other part, named for it) and Pantry Ingredient (each part), then deletes the food. A tool deletes the food as a `tool` AI Change. Nothing deletes its lines as Junk Lines, a change each, and the food, as a `not-a-food` change where anything else still named it (a joined line, a grocery). Undo mints the food again under its own ids and points its rows back; a Junk Line comes back at its order, with those of its foods still there.
- Memory: an undone tool or not-a-food keeps AI off that food. An undone Junk Line remembers its clean spelling: AI's "nothing" for it then names no food at import, and leaves the food alone in the pass.
- AI never deletes a food a Pantry Ingredient names, since a Pantry Ingredient cannot name no food: the food stays, flagged with the doubt.
- On an `ai-junk` flag the panel's Delete is Delete as junk (`remove` with `asJunk`, the same dialog). A tool a Pantry Ingredient keeps raises `ai-junk` too. It deletes lines only in recipes the person may edit; the rest lose the food, as with Delete.
- A Junk Line is listed only to those who may see its recipe, and undone under the recipe's edit policy.
- The `ai` E2E run had one red on the first run (a Redis stall under swap: every worker's socket timed out at once, 8.2 of 9.2 GB swap used). The file then passed 36/36 with `--repeat-each=3`.

2026-10-19, review fixes:

- The prompt and the Decision keep anything bought in a shop out of "tool" and "nothing" (baking paper, foil, toilet paper, dish soap), since non-food purchases stay Ingredients; "baking paper" had been a tool example.
- The pass resolves a split's parts as import does (a part split again is minted whole, flagged), and checks again that no person decided about the food before minting them.
- A typed text AI splits resolves only its first part, so no part is minted that nothing names.
- One place deletes and records Junk Lines (`deleteJunkLines`) and one builds them (`junkLine`); the split and the deleted-food snapshot read `rowsNaming`; `distinctFoods` (shared) replaces four copies of the dedupe. The AI Change table and its Undo types moved to `schema/ingredient-ai-changes.ts`, so `DeletedLine` takes its join and system from the enums. `mayEditIngredientRow` is `mayEditOwnedRow`, since a Junk Line's recipe policy uses it too. A text kept as no Junk Line is skipped explicitly, not dressed as a tool.
- Not changed: the module headers of `resolver.ts` and `ingredient-resolution.ts` stay long (a phrase in each was updated); the four words for junk (`nothing`, `not-a-food`, `ai-junk`, Junk Line) are the spec's; the switches on an answer's kind differ per layer (parse, sureness, act at import, act on a food).

2026-10-20, after talking it through with Mike:

- An unsure tool is deleted like a sure one ("unsure tool deleting is also fine"). Non-food purchases stay Ingredients, as the prompt already says.
- The pass compares a name with the foods sharing a word with AI's English name for it, after the name's own word matches, and looks up the other names AI says a shop sells it under (`otherNames` in the reading). Sending the whole catalogue instead was ruled out on size and on wrong "same" answers.
- A slip of the fingers ("barmezaan" for "parmezaan") finds its food without AI, by the grocery product rule (`@norish/shared/lib/name-slips`, shared with `chooseUnmistakable`). With AI on it only puts that food before AI; with AI off or failing it is taken. ADR-0037 amended.
- The catalogue E2E spec passed 12/12 (its plain-name stub reads an English name no other spec's foods share, since the pass now searches its words). In `--repeat-each=3` one red, in "a food's name, parent and translations land together with Save": Apply was clicked while the picker's list was open, and the click only closed it. Seven more runs of that scenario passed, with the Mac at 8.5 of 9.2 GB swap; not reproduced, so not fixed.

2026-10-20, reversed: Mike ruled that keeping the catalogue never changes a recipe. A line naming nothing stays as written and points at no food; only its food is deleted. Ticket 13 takes the Junk Line deletion out of the code, which still deletes lines until then.

Also 2026-10-20: "tool" and "nothing" become one answer, "not a food", acted on sure or not (Mike: "one not a food"). Ticket 13 does that too.

Open, for Mike:

- AI never deletes a food a Pantry Ingredient names, against the spec's "leaves groceries and pantry rows pointing at no food": a Pantry Ingredient has no text of its own, so with no food it would name nothing. The food stays, flagged.
- A name no known food shares a word with is not asked about at import (rung 3's rule, to keep a shopper's add fast), so its Junk Line goes in the pass moments after the mint, not at import.
- A typed grocery or pantry text that only AI can split stays one row naming its first food; the words already split the common ones ("zout en peper"). Splitting it into rows would ask AI before `typedParts`, which today asks nothing.
- A split is not an AI Change, so it has no Undo: putting a grocery split in two back together needs the rows the split made remembered. The spec's kinds list has no split, so this follows it; say if a split should be undoable.
- A grocery split "together" that came from a recurring grocery: the extra rows recur with neither recurring row (`ponytail:` in `splitCatalogueIngredient`).

For ticket 09: release notes (AI deletes tools, junk lines and foods naming nothing, and splits names it is sure are several; Delete as junk), and the Ingredients docs page (Changed by AI lists deleted foods and lines; the `ai-junk` flag).
