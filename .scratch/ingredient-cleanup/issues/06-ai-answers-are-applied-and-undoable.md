# 06: AI's answers are applied and can be undone

**What to build:** When AI is asked about a food, it no longer leaves a suggestion; it makes the change. The review pass (today's Ask AI and Fix catalogue round) applies every answer: merge into a known food, parent, Plain Name, or a food of its own. A sure answer raises no flag. An unsure answer is applied too, and flags its food.

Every change is an **AI Change**, stored with what Undo needs, and listed on a new **Changed by AI** view on the Ingredients page:
- unsure changes come first, with **Keep** and **Undo**;
- sure changes come after, with **Undo**;
- each row names its food.

**Keep** clears the flag and counts as a person's decision, so AI won't ask about that food again. **Undo**, per kind:
- merge: the moved translations go back out to a food of their own, carrying their lines;
- parent: the former parent comes back;
- Plain Name: the former name comes back, and the name is settled.

An undone change is remembered, so AI never makes it again. Undo and Keep follow the food's edit policy. A flagged food stays marked in the Ingredients list, and the mark opens its unsure changes.

The suggestions table, the Suggestions panel and Confirm all are removed. Ask AI and Fix catalogue stay as triggers until 07.

See `CONTEXT.md` (Flagged Ingredient, AI Change, Plain Name) and ADR-0037's first 2026-10-17 amendment.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] A sure merge answer merges and records a sure AI Change, with no flag.
- [x] An unsure parent answer sets the parent, flags the food and lists the change under Keep and Undo.
- [x] Undo per kind restores the prior state: the merged translations and their lines are back on a food of their own, the old parent is back, the old name is back and settled.
- [x] The same question asked again after an Undo does not repeat the undone change.
- [x] Keep clears the flag, and a later round skips the food.
- [x] Foods a person kept distinct, renamed or parented, and seeded foods, are not asked about.
- [x] The suggestions table is dropped by a migration. The Suggestions panel, Confirm all and their translations are gone.
- [x] Browser: Ask AI on a flagged food (AI stub) merges it, the merge shows on Changed by AI, and Undo puts it back. The two suggestion scenarios in the catalogue spec are rewritten to this.
- [x] Pass tests run against a real database with AI mocked at the runtime, replacing the review, suggestion and plain-name tests. All `CONTRIBUTING.md` gates pass.

## Comments

2026-10-19, implemented:

- `ingredient_ai_changes` (migration 0078) holds each change with what Undo needs as JSON; the suggestions table is dropped. Undo per kind: a merge's spellings move back out to a new food named as before, carrying their lines; a parent goes back to where the food was before AI (past any parent change it replaced); a Plain Name goes back, still settled.
- Undo memory: a merge undone means those spellings never merge into that food again; a parent undone means that food never goes under that parent again. A Plain Name undone settles the name, so AI never names the food again.
- AI skips a food a person kept distinct, parented or named. "Named" needed a new `ingredients.name_chosen`, set by a person's rename: `name_settled` is also set by AI's own Plain Name, so it cannot say who named the food.
- Keep on a parent or a Plain Name marks the food kept distinct. Keep on a merge only lifts the flag the merge raised: the food it joined is often seeded, so marking it would edit a food only an administrator may edit. Undo of a sure change leaves every flag alone.
- An unsure "a food of its own" records no change, since nothing changed: the food stays flagged `ai-unsure`, with Mark distinct as before.
- A parent the words of a new food's name guessed (mint, startup recheck) is an unsure parent change marked `fromWords`, replacing the `words` suggestion.
- Keep and Undo take the tree lock before the change row, as the pass does; the other order deadlocked against a pass on the same food (`ai-changes.test.ts` reproduces it).
- Ask AI, Find parent and both rounds now run the one pass (`askAIAbout`), which goes on to the Plain Name after a non-merge answer. Fix catalogue offers "Check flagged ingredients" and "Clean names".

2026-10-19, Mike's review:

- A Plain Name is always a sure change: a rename says nothing about which food it is, so it never flags (CONTEXT.md, Plain Name and Flagged Ingredient, say so now).
- The seed is always right: a flagged own food it adopts loses its flag, and AI's unsure merges into it become sure, still listed with Undo (`catalogue-seed.test.ts`).
- Find parent with AI and Find parents with AI are "Check with AI" and "Check these with AI", since they run the whole question. A flagged food's panel shows only its flag's Ask AI, which is the same question.
- The release notes and the Ingredients docs page are ticket 09's, with the other tickets' notes.

Open, from the review (not done, for Mike):

- An unsure "kind of X" at import files the food and flags it, but records no change behind the flag (rung 3's mint, ticket 07's ground).
- `estimateCleanTokens` moved from `plain-names.ts` to `review.ts` to break an import cycle.

